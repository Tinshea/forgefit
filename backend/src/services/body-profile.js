// Résolution de l'état corporel de l'utilisateur.
//
// ┌─ POURQUOI CE SERVICE EXISTE ──────────────────────────────────────┐
// │ Le poids, la taille, le taux de masse grasse et la masse maigre   │
// │ peuvent venir de trois endroits : une mesure d'appareil, une      │
// │ valeur saisie dans le profil, ou une déduction.                   │
// │                                                                    │
// │ Chaque route qui refaisait cet arbitrage dans son coin produisait │
// │ un résultat différent : la page Profil affichait un métabolisme   │
// │ de base calculé sur la masse maigre mesurée (1776 kcal) pendant   │
// │ que la page Nutrition utilisait la valeur saisie (1742 kcal).     │
// │ Deux chiffres pour la même grandeur, dans la même application.    │
// │                                                                    │
// │ Toute lecture de l'état corporel passe désormais par ici.          │
// └────────────────────────────────────────────────────────────────────┘

import { query } from '../db.js';
import { deriveMetrics } from './anthropometry.js';
import { summarizeLoad } from './training-load.js';

/** Mesures de composition corporelle publiées par les appareils. */
const BODY_METRICS = [
  'weight', 'body_fat', 'lean_mass', 'muscle_mass',
  'bone_mass', 'body_water', 'visceral_fat', 'bmi', 'height', 'waist',
];

/** Dernière mesure connue pour chaque type. */
async function loadMeasurements(userId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (metric_type)
            metric_type, magnitude, unit, source, recorded_at
       FROM health_metrics
      WHERE user_id = $1 AND metric_type = ANY($2) AND magnitude IS NOT NULL
      ORDER BY metric_type, recorded_at DESC`,
    [userId, BODY_METRICS],
  );

  return Object.fromEntries(rows.map((r) => [r.metric_type, {
    value: Number(r.magnitude),
    unit: r.unit,
    source: r.source,
    recorded_at: r.recorded_at,
  }]));
}

const num = (v) => (v == null ? null : Number(v));

/**
 * État corporel consolidé.
 *
 * Ordre de priorité, du plus fiable au moins fiable :
 *   1. mesure d'appareil la plus récente ;
 *   2. valeur saisie dans le profil ;
 *   3. déduction (masse maigre depuis le taux de masse grasse).
 *
 * Une balance pèse chaque matin ; une valeur tapée une fois reste figée
 * pour toujours.
 */
export async function resolveBodyProfile(userId, { trainingMinutes = 0 } = {}) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.display_name, u.sex, u.birth_date, u.locale,
            u.bodyweight_kg, u.height_cm,
            n.goal, n.activity, n.lean_mass_kg, n.body_fat_pct,
            n.kcal_override, n.protein_override_g, n.fat_override_g, n.fiber_target_g,
            n.day_split_pct, n.bmr_method, n.measured_bmr
       FROM users u
       LEFT JOIN nutrition_profiles n ON n.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  const p = rows[0];
  if (!p) return null;

  const measured = await loadMeasurements(userId);

  const pick = (metric, stored) => {
    if (measured[metric]) return { value: measured[metric].value, origin: 'mesuré', ...measured[metric] };
    if (stored != null) return { value: Number(stored), origin: 'saisi' };
    return null;
  };

  const weight = pick('weight', p.bodyweight_kg);
  const height = pick('height', p.height_cm);
  const bodyFat = pick('body_fat', p.body_fat_pct);
  const lean = pick('lean_mass', p.lean_mass_kg);

  const derived = deriveMetrics({
    weightKg: weight?.value ?? null,
    heightCm: height?.value ?? null,
    bodyFatPct: bodyFat?.value ?? null,
    leanMassKg: lean?.value ?? null,
    birthDate: p.birth_date,
    sex: p.sex,
    trainingMinutes,
    // Le choix de formule suit l'état corporel : sans lui, la page
    // Profil afficherait un métabolisme de base calculé autrement que
    // celui qui sert réellement aux cibles.
    bmrMethod: p.bmr_method ?? 'auto',
    measuredBmr: num(p.measured_bmr),
  });

  return {
    user: {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      sex: p.sex,
      birth_date: p.birth_date,
      locale: p.locale,
      age: derived.age,
    },
    // Valeurs retenues pour tous les calculs.
    body: {
      weight_kg: weight?.value ?? null,
      height_cm: height?.value ?? null,
      body_fat_pct: bodyFat?.value ?? null,
      lean_mass_kg: lean?.value ?? derived.lean_mass_kg,
      fat_mass_kg: derived.fat_mass_kg,
    },
    sources: {
      weight,
      height,
      body_fat: bodyFat,
      lean_mass: lean ?? (derived.lean_mass_kg != null
        ? { value: derived.lean_mass_kg, origin: 'déduit du taux de masse grasse' }
        : null),
    },
    // Mesures secondaires des balances à impédance : suivies pour la
    // tendance, jamais utilisées dans un calcul — leur fiabilité est
    // trop faible pour asseoir un objectif dessus.
    composition: {
      muscle_mass: measured.muscle_mass ?? null,
      bone_mass: measured.bone_mass ?? null,
      body_water: measured.body_water ?? null,
      visceral_fat: measured.visceral_fat ?? null,
      waist: measured.waist ?? null,
      bmi_measured: measured.bmi ?? null,
    },
    goals: {
      goal: p.goal ?? 'maintien',
      activity: p.activity ?? 'leger',
      fiber_target_g: num(p.fiber_target_g) ?? 30,
      kcal_override: num(p.kcal_override),
      protein_override_g: num(p.protein_override_g),
      fat_override_g: num(p.fat_override_g),
      day_split_pct: Number(p.day_split_pct ?? 0),
      // 'auto' plutôt que NULL vers l'extérieur : l'interface a besoin
      // d'une valeur à sélectionner dans une liste.
      bmr_method: p.bmr_method ?? 'auto',
      measured_bmr: num(p.measured_bmr),
    },
    derived,
  };
}

/**
 * Minutes d'entraînement du jour.
 *
 * Mesurées sur la DURÉE DE SÉANCE, pas sur la somme des durées de
 * séries : seules les séries chronométrées (étirements, gainage) en
 * portent une. Une séance de musculation de 75 minutes était comptée
 * pour zéro, ce qui annulait le supplément d'hydratation les jours où
 * il était justement nécessaire.
 */
export async function trainingMinutesToday(userId) {
  const { rows: [row] } = await query(
    `SELECT COALESCE(SUM(
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, now()) - s.started_at)) / 60
            ), 0)::numeric AS minutes
       FROM workout_sessions s
      WHERE s.user_id = $1 AND s.started_at >= date_trunc('day', now())`,
    [userId],
  );
  return Number(row?.minutes) || 0;
}

/** Séances du jour, pour distinguer un jour d'entraînement d'un jour de repos. */
export async function trainingToday(userId) {
  const { rows: [row] } = await query(
    `SELECT COUNT(*)::int AS sessions,
            COALESCE(SUM(
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, now()) - s.started_at)) / 60
            ), 0)::numeric AS minutes
       FROM workout_sessions s
      WHERE s.user_id = $1 AND s.started_at >= date_trunc('day', now())`,
    [userId],
  );
  return {
    sessions: Number(row?.sessions ?? 0),
    minutes: Math.round(Number(row?.minutes ?? 0)),
    is_training_day: Number(row?.sessions ?? 0) > 0,
  };
}

/**
 * Charge d'entraînement observée sur une fenêtre glissante.
 *
 * Sert à confronter l'activité DÉCLARÉE dans le profil à celle
 * réellement enregistrée : le multiplicateur d'activité est l'entrée la
 * plus lourde du calcul nutritionnel, et la seule qu'on choisit une fois
 * sans jamais la revoir.
 */
export async function observedLoad(userId, days = 28) {
  const { rows: [row] } = await query(
    `SELECT COUNT(*)::int AS sessions,
            COALESCE(SUM(
              EXTRACT(EPOCH FROM (COALESCE(s.ended_at, s.started_at) - s.started_at)) / 60
            ), 0)::numeric AS minutes,
            COUNT(*) FILTER (WHERE s.ended_at IS NULL)::int AS open_sessions,
            COUNT(DISTINCT (s.started_at AT TIME ZONE 'UTC')::date)::int AS training_days
       FROM workout_sessions s
      WHERE s.user_id = $1
        AND s.started_at > now() - ($2 || ' days')::interval`,
    [userId, days],
  );
  return summarizeLoad(row, days);
}
