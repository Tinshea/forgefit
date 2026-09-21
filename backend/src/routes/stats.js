import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, userOf } from '../lib/http.js';
import { computeReadiness } from '../services/scoring.js';
import { computeRadar } from '../services/radar.js';
import { hydrationTarget } from '../services/anthropometry.js';
import { resolveBodyProfile } from '../services/body-profile.js';
import { computeTargets } from '../services/nutrition.js';
import { computeAdherence } from '../services/adherence.js';
import { weeklyStreak } from '../services/streak.js';
import {
  distributeLoad, getSport, CATEGORIES, CATEGORY_ORDER,
} from '../services/sports.js';
import { sessionLoad, loadSummary, dailySeries } from '../services/session-load.js';
import { progression } from '../services/gamification.js';
import { weekStart } from '../services/streak.js';
import { AEROBIC } from '../services/evidence.js';
import { isoDate } from '../services/scheduling.js';
import {
  percentileFor, loadForPercentile, standardsFor, matchLift,
  estimateOneRepMax, oneRepMaxConfidence, REFERENCE_POPULATION,
} from '../services/strength-standards.js';

export const statsRouter = Router();

/**
 * GET /api/stats/radar — les 6 axes + rang global.
 * ?days=90 (fenêtre de force) ; la fenêtre de capacité reste à 7 jours.
 *
 * Le calcul vit dans services/radar.js : le générateur de programme en
 * a besoin lui aussi, et une route ne doit pas être la seule porte
 * d'entrée d'une logique métier.
 */
statsRouter.get('/radar', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 90, 365);
  const radar = await computeRadar(userOf(req), days);
  // internal_scores ne sert qu'au générateur : hors contrat public.
  const { internal_scores: _ignored, ...payload } = radar;
  res.json(payload);
}));

/**
 * GET /api/stats/bodymap — charge et fatigue par muscle.
 *
 * La vue muscle_load_recent applique une decroissance exponentielle
 * (demi-vie 48 h). On normalise ici sur le muscle le plus sollicite :
 * la heatmap est une lecture RELATIVE de l'equilibre du corps, pas une
 * mesure absolue comparable entre utilisateurs.
 */
statsRouter.get('/bodymap', asyncHandler(async (req, res) => {
  const userId = userOf(req);

  const [gym, sportRows] = await Promise.all([
    query(
      `SELECT muscle, volume_14d, fatigue_raw, set_count, last_trained_at
         FROM muscle_load_recent
        WHERE user_id = $1
        ORDER BY fatigue_raw DESC`,
      [userId],
    ),
    // Séances de sport closes des 14 derniers jours, avec leur charge de
    // Foster. Les séances de musculation en sont exclues : leur
    // sollicitation est déjà décrite, muscle par muscle, par les séries
    // réellement enregistrées.
    query(
      `SELECT s.sport_key, s.ended_at,
              s.perceived_exertion AS rpe,
              ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0)::int AS minutes
         FROM workout_sessions s
        WHERE s.user_id = $1
          AND s.ended_at IS NOT NULL
          AND s.ended_at > now() - interval '14 days'
          AND s.sport_key IS NOT NULL
          AND s.sport_key <> 'musculation'
          AND s.perceived_exertion IS NOT NULL`,
      [userId],
    ),
  ]);

  const rows = gym.rows;
  const maxFatigue = rows.reduce((m, r) => Math.max(m, Number(r.fatigue_raw) || 0), 0);
  const maxVolume = rows.reduce((m, r) => Math.max(m, Number(r.volume_14d) || 0), 0);

  const muscles = rows.map((r) => ({
    muscle: r.muscle,
    volume_14d: Math.round(Number(r.volume_14d) || 0),
    set_count: r.set_count,
    last_trained_at: r.last_trained_at,
    fatigue: maxFatigue > 0
      ? Math.round((Number(r.fatigue_raw) / maxFatigue) * 100) / 100
      : 0,
    volume_ratio: maxVolume > 0
      ? Math.round((Number(r.volume_14d) / maxVolume) * 100) / 100
      : 0,
    hours_since: r.last_trained_at
      ? Math.round((Date.now() - new Date(r.last_trained_at).getTime()) / 36e5)
      : null,
  }));

  // Index global de fatigue : moyenne ponderee, alimente la Readiness.
  const fatigueIndex = muscles.length
    ? muscles.reduce((s, m) => s + m.fatigue, 0) / muscles.length
    : 0;

  // --- Sollicitation issue des autres sports --------------------------
  //
  // Même décroissance exponentielle que la vue SQL (demi-vie 48 h) :
  // deux sources qui vieillissent différemment se compareraient mal.
  const HALF_LIFE_H = 48;
  const sportLoad = new Map();
  const sportLast = new Map();
  const sportsSeen = new Map();

  for (const row of sportRows.rows) {
    const load = sessionLoad({ rpe: row.rpe, minutes: row.minutes });
    if (!load) continue;
    const ageH = (Date.now() - new Date(row.ended_at).getTime()) / 36e5;
    const decayed = load * Math.exp((-Math.LN2 * ageH) / HALF_LIFE_H);

    sportsSeen.set(row.sport_key, (sportsSeen.get(row.sport_key) ?? 0) + load);
    for (const part of distributeLoad(row.sport_key, decayed)) {
      sportLoad.set(part.muscle, (sportLoad.get(part.muscle) ?? 0) + part.load);
      const prev = sportLast.get(part.muscle);
      if (!prev || new Date(row.ended_at) > new Date(prev)) {
        sportLast.set(part.muscle, row.ended_at);
      }
    }
  }

  const maxSport = [...sportLoad.values()].reduce((m, v) => Math.max(m, v), 0);
  const sportMuscles = [...sportLoad.entries()]
    .map(([muscle, load]) => ({
      muscle,
      load_au: Math.round(load),
      ratio: maxSport > 0 ? Math.round((load / maxSport) * 100) / 100 : 0,
      last_trained_at: sportLast.get(muscle) ?? null,
    }))
    .sort((a, b) => b.load_au - a.load_au);

  // --- Carte unifiée ---------------------------------------------------
  //
  // ┌─ POURQUOI UN MAXIMUM ET NON UNE SOMME ──────────────────────────┐
  // │ Les deux sources n'ont PAS la même unité : la musculation est   │
  // │ mesurée en tonnage (kg soulevés), les autres sports en charge   │
  // │ de Foster (RPE × minutes). Les additionner reviendrait à        │
  // │ additionner des kilomètres et des litres.                       │
  // │                                                                  │
  // │ Chaque source est donc normalisée SÉPARÉMENT sur son propre     │
  // │ maximum — ce sont déjà des cartes relatives —, puis on retient  │
  // │ la plus forte des deux en disant d'où elle vient. On ne prétend │
  // │ pas quantifier une sollicitation totale ; on répond à « ce      │
  // │ muscle a-t-il beaucoup travaillé, et à cause de quoi ».         │
  // └──────────────────────────────────────────────────────────────────┘
  const byMuscle = new Map();
  for (const m of muscles) {
    byMuscle.set(m.muscle, {
      muscle: m.muscle, gym: m.fatigue, sport: 0, last_trained_at: m.last_trained_at,
    });
  }
  for (const m of sportMuscles) {
    const entry = byMuscle.get(m.muscle)
      ?? { muscle: m.muscle, gym: 0, sport: 0, last_trained_at: null };
    entry.sport = m.ratio;
    if (!entry.last_trained_at
      || new Date(m.last_trained_at) > new Date(entry.last_trained_at)) {
      entry.last_trained_at = m.last_trained_at;
    }
    byMuscle.set(m.muscle, entry);
  }

  const combined = [...byMuscle.values()]
    .map((e) => ({
      ...e,
      load: Math.max(e.gym, e.sport),
      source: e.sport > e.gym ? 'sport' : e.gym > 0 ? 'musculation' : 'sport',
      hours_since: e.last_trained_at
        ? Math.round((Date.now() - new Date(e.last_trained_at).getTime()) / 36e5)
        : null,
    }))
    .sort((a, b) => b.load - a.load);

  res.json({
    muscles,
    fatigue_index: Math.round(fatigueIndex * 100) / 100,
    trained_muscles: muscles.length,
    // Nouvelles clés, ADDITIVES : les consommateurs existants de
    // `muscles` continuent de lire exactement ce qu'ils lisaient.
    sport_muscles: sportMuscles,
    sports_recent: [...sportsSeen.entries()]
      .map(([sport, load]) => ({ sport, load: Math.round(load) }))
      .sort((a, b) => b.load - a.load),
    combined,
    combined_note: 'Musculation et autres sports n’ont pas la même unité — '
      + 'tonnage d’un côté, RPE × durée de l’autre. Chaque source est '
      + 'normalisée sur elle-même, puis la plus forte est retenue. La carte '
      + 'dit quel muscle a le plus travaillé, pas combien.',
  });
}));

/**
 * GET /api/stats/readiness — score de disponibilite du jour.
 * Croise fatigue musculaire (logs) et metriques IoT (JSONB).
 */
statsRouter.get('/readiness', asyncHandler(async (req, res) => {
  const userId = userOf(req);

  // Derniere valeur + ligne de base 30 jours, en une passe par type.
  const { rows: metrics } = await query(
    `SELECT DISTINCT ON (metric_type)
            metric_type, magnitude, recorded_at
       FROM health_metrics
      WHERE user_id = $1
        AND magnitude IS NOT NULL
        AND recorded_at > now() - INTERVAL '3 days'
      ORDER BY metric_type, recorded_at DESC`,
    [userId],
  );

  const { rows: baselines } = await query(
    `SELECT metric_type, AVG(magnitude)::numeric AS baseline
       FROM health_metrics
      WHERE user_id = $1
        AND magnitude IS NOT NULL
        AND recorded_at > now() - INTERVAL '30 days'
      GROUP BY metric_type`,
    [userId],
  );

  const latest = Object.fromEntries(metrics.map((m) => [m.metric_type, Number(m.magnitude)]));
  const base = Object.fromEntries(baselines.map((b) => [b.metric_type, Number(b.baseline)]));

  const { rows: fatigueRows } = await query(
    `SELECT fatigue_raw FROM muscle_load_recent WHERE user_id = $1`,
    [userId],
  );
  const maxFatigue = fatigueRows.reduce((m, r) => Math.max(m, Number(r.fatigue_raw) || 0), 0);
  const avgFatigue = fatigueRows.length
    ? fatigueRows.reduce((s, r) => s + (Number(r.fatigue_raw) || 0), 0) / fatigueRows.length
    : 0;
  const fatigueIndex = maxFatigue > 0 ? avgFatigue / maxFatigue : null;

  const { rows: hydration } = await query(
    `SELECT COALESCE(SUM(magnitude), 0)::numeric AS total_ml
       FROM health_metrics
      WHERE user_id = $1 AND metric_type = 'hydration'
        AND recorded_at >= date_trunc('day', now())
        AND recorded_at <  date_trunc('day', now()) + INTERVAL '1 day'`,
    [userId],
  );

  const { rows: weightRows } = await query(
    `SELECT COALESCE(
       (SELECT magnitude FROM health_metrics
         WHERE user_id = $1 AND metric_type = 'weight' AND magnitude IS NOT NULL
         ORDER BY recorded_at DESC LIMIT 1),
       (SELECT bodyweight_kg FROM users WHERE id = $1)
     ) AS weight_kg`,
    [userId],
  );
  const hydrationGoal = hydrationTarget(Number(weightRows[0]?.weight_kg) || null);

  const { rows: mobility } = await query(
    `SELECT COALESCE(SUM(ws.duration_s), 0)::numeric / 60 AS minutes
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
       JOIN exercises e        ON e.id = ws.exercise_id
      WHERE s.user_id = $1 AND e.axis IN ('mobility', 'flexibility')
        AND ws.completed_at > now() - INTERVAL '7 days'`,
    [userId],
  );

  const readiness = computeReadiness({
    fatigueIndex,
    sleepHours: latest.sleep ?? null,
    hrvMs: latest.hrv ?? null,
    hrvBaselineMs: base.hrv ?? null,
    restingHr: latest.resting_hr ?? null,
    restingHrBaseline: base.resting_hr ?? null,
    // Objectif proportionnel au poids, pas une constante : la même
    // quantité d'eau ne représente pas le même effort d'hydratation à
    // 60 kg et à 95 kg.
    hydrationRatio: Number(hydration[0].total_ml) / hydrationGoal.ml,
    mobilityMinutes7d: Number(mobility[0].minutes),
  });

  res.json({
    ...readiness,
    signals: {
      sleep_hours: latest.sleep ?? null,
      hrv_ms: latest.hrv ?? null,
      hrv_baseline_ms: base.hrv ? Math.round(base.hrv * 10) / 10 : null,
      resting_hr: latest.resting_hr ?? null,
      fatigue_index: fatigueIndex === null ? null : Math.round(fatigueIndex * 100) / 100,
      hydration_ml: Number(hydration[0].total_ml),
      mobility_minutes_7d: Math.round(Number(mobility[0].minutes)),
    },
  });
}));

/** GET /api/stats/summary — bandeau du tableau de bord. */
statsRouter.get('/summary', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM workout_sessions
         WHERE user_id = $1 AND started_at > now() - INTERVAL '7 days')  AS sessions_7d,
       (SELECT COALESCE(SUM(ws.volume_kg), 0)::numeric
          FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id
         WHERE s.user_id = $1 AND ws.completed_at > now() - INTERVAL '7 days') AS volume_7d,
       (SELECT COUNT(*)::int FROM workout_sets ws
          JOIN workout_sessions s ON s.id = ws.session_id
         WHERE s.user_id = $1 AND ws.completed_at > now() - INTERVAL '7 days') AS sets_7d,
       (SELECT COUNT(DISTINCT recorded_at::date)::int FROM health_metrics
         WHERE user_id = $1 AND recorded_at > now() - INTERVAL '30 days')  AS health_days_30d`,
    [userId],
  );
  res.json(rows[0]);
}));

/**
 * GET /api/stats/trends?days=90
 *
 * Séries alignées sur un axe temporel commun, pour les graphiques de
 * tendance. Agrégées en base : rapatrier des milliers de lignes pour
 * les moyenner côté client serait absurde.
 */
statsRouter.get('/trends', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const days = Math.min(Number(req.query.days) || 90, 365);
  const d = String(days);

  const [composition, nutrition, training, targets] = await Promise.all([
    // Composition corporelle : poids, masse grasse, masse maigre.
    query(
      `SELECT date_trunc('day', recorded_at)::date AS day,
              AVG(magnitude) FILTER (WHERE metric_type = 'weight')::numeric(6,2)    AS weight_kg,
              AVG(magnitude) FILTER (WHERE metric_type = 'body_fat')::numeric(5,2)  AS body_fat_pct,
              AVG(magnitude) FILTER (WHERE metric_type = 'lean_mass')::numeric(6,2) AS lean_mass_kg
         FROM health_metrics
        WHERE user_id = $1 AND magnitude IS NOT NULL
          AND metric_type IN ('weight', 'body_fat', 'lean_mass')
          AND recorded_at > now() - ($2 || ' days')::interval
        GROUP BY 1 ORDER BY 1`,
      [userId, d],
    ),
    query(
      `SELECT consumed_on AS day, kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur
         FROM nutrition_daily
        WHERE user_id = $1 AND consumed_on > CURRENT_DATE - ($2 || ' days')::interval
        ORDER BY consumed_on`,
      [userId, d],
    ),
    query(
      `SELECT date_trunc('day', ws.completed_at)::date AS day,
              SUM(ws.volume_kg)::numeric(12,2) AS volume_kg,
              COUNT(*)::int                    AS sets
         FROM workout_sets ws
         JOIN workout_sessions s ON s.id = ws.session_id
        WHERE s.user_id = $1 AND ws.is_warmup = FALSE
          AND ws.completed_at > now() - ($2 || ' days')::interval
        GROUP BY 1 ORDER BY 1`,
      [userId, d],
    ),
    targetsForTrends(userId),
  ]);

  // Masse grasse en kg : plus parlant qu'un pourcentage pour suivre une
  // perte, et permet d'empiler avec la masse maigre.
  const compositionRows = composition.rows.map((r) => {
    const weight = r.weight_kg == null ? null : Number(r.weight_kg);
    const lean = r.lean_mass_kg != null
      ? Number(r.lean_mass_kg)
      : (weight != null && r.body_fat_pct != null
        ? Math.round(weight * (1 - Number(r.body_fat_pct) / 100) * 100) / 100
        : null);
    return {
      day: r.day,
      weight_kg: weight,
      body_fat_pct: r.body_fat_pct == null ? null : Number(r.body_fat_pct),
      lean_mass_kg: lean,
      fat_mass_kg: weight != null && lean != null
        ? Math.round((weight - lean) * 100) / 100
        : null,
    };
  });

  /** Tendance : seconde moitié de la fenêtre contre première moitié. */
  const trendOf = (rows, key) => {
    const vals = rows.map((r) => Number(r[key])).filter(Number.isFinite);
    if (vals.length < 4) return null;
    const half = Math.floor(vals.length / 2);
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const older = avg(vals.slice(0, half));
    const newer = avg(vals.slice(half));
    return {
      delta: Math.round((newer - older) * 100) / 100,
      pct: older === 0 ? null : Math.round(((newer - older) / Math.abs(older)) * 1000) / 10,
    };
  };

  res.json({
    window_days: days,
    composition: compositionRows,
    nutrition: nutrition.rows,
    training: training.rows,
    targets: targets ?? null,
    trends: {
      weight: trendOf(compositionRows, 'weight_kg'),
      lean_mass: trendOf(compositionRows, 'lean_mass_kg'),
      fat_mass: trendOf(compositionRows, 'fat_mass_kg'),
      kcal: trendOf(nutrition.rows, 'kcal'),
      protein: trendOf(nutrition.rows, 'protein_g'),
      volume: trendOf(training.rows, 'volume_kg'),
    },
  });
}));

/** Cibles courantes, pour tracer les lignes de référence. */
async function targetsForTrends(userId) {
  const resolved = await resolveBodyProfile(userId);
  if (!resolved) return null;
  const { body, user, goals } = resolved;
  const computed = computeTargets({
    leanMassKg: body.lean_mass_kg,
    weightKg: body.weight_kg,
    heightCm: body.height_cm,
    age: user.age,
    sex: user.sex,
    goal: goals.goal,
    activity: goals.activity,
    kcalOverride: goals.kcal_override,
    proteinOverrideG: goals.protein_override_g,
    fatOverrideG: goals.fat_override_g,
    fiberTargetG: goals.fiber_target_g,
  });
  return computed.targets;
}

/** Paliers nommés, dans l'ordre des tables de standards. */
const LEVELS = ['Débutant', 'Novice', 'Intermédiaire', 'Avancé', 'Élite'];
const LEVEL_PERCENTILES = [5, 20, 50, 80, 95];

const LIFT_LABELS = {
  bench_press: 'Développé couché', squat: 'Squat', deadlift: 'Soulevé de terre',
  overhead_press: 'Développé militaire', barbell_row: 'Rowing', pull_up: 'Traction',
  dip: 'Dips', front_squat: 'Squat avant', hip_thrust: 'Hip thrust',
  leg_press: 'Presse à cuisses', bicep_curl: 'Curl biceps',
  lat_pulldown: 'Tirage vertical', push_up: 'Pompes',
};

/**
 * GET /api/stats/benchmark
 *
 * Situe chaque mouvement de référence face à la population : ratio,
 * percentile, palier atteint, et la charge exacte qui ferait basculer
 * au palier suivant. C'est cette dernière qui rend le classement
 * actionnable plutôt que décoratif.
 */
statsRouter.get('/benchmark', asyncHandler(async (req, res) => {
  const userId = userOf(req);

  const { rows: profileRows } = await query(
    'SELECT sex, bodyweight_kg FROM users WHERE id = $1',
    [userId],
  );
  const profile = profileRows[0];
  const bodyweightKg = Number(profile?.bodyweight_kg) || null;
  const sex = profile?.sex ?? 'unspecified';

  if (!bodyweightKg) {
    return res.json({
      items: [], bodyweight_kg: null,
      note: 'Renseigne ton poids de corps : tous les standards en dépendent.',
    });
  }

  const { rows } = await query(
    `SELECT e.name_fr, ws.weight_kg, ws.reps, ws.completed_at
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
       JOIN exercises e        ON e.id = ws.exercise_id
      WHERE s.user_id = $1 AND ws.is_warmup = FALSE AND ws.reps > 0
        AND ws.completed_at > now() - INTERVAL '365 days'`,
    [userId],
  );

  // Meilleure performance par mouvement de référence.
  const best = new Map();
  for (const r of rows) {
    const lift = matchLift(r.name_fr);
    if (!lift) continue;
    const weight = Number(r.weight_kg) || 0;
    const reps = Number(r.reps);
    const oneRm = estimateOneRepMax(weight, reps) ?? 0;
    const result = percentileFor({
      lift, sex, bodyweightKg, oneRepMaxKg: oneRm, addedWeightKg: weight,
    });
    if (!result) continue;

    const prev = best.get(lift);
    if (!prev || result.percentile > prev.percentile) {
      const confidence = oneRepMaxConfidence(reps);
      best.set(lift, {
        lift,
        label: LIFT_LABELS[lift] ?? lift,
        one_rep_max_kg: Math.round(oneRm * 10) / 10,
        ratio: Math.round(result.ratio * 100) / 100,
        percentile: Math.round(result.percentile * 10) / 10,
        level: result.level,
        z: Math.round(result.z * 100) / 100,
        // Un 1RM extrapolé depuis 12 répétitions vaut moins qu'un
        // vrai 1RM : le classement doit dire sur quoi il repose.
        estimated_from: { weight_kg: weight, reps },
        confidence,
        confidence_note: reps === 1
          ? 'Charge réellement soulevée en une répétition.'
          : `Extrapolé depuis ${reps} répétitions — fiabilité `
            + `${Math.round(confidence * 100)} %.`,
        last_at: r.completed_at,
      });
    }
  }

  const items = [...best.values()]
    .map((item) => {
      const standards = standardsFor(item.lift, sex) ?? [];

      // Charge correspondant à chaque palier, pour CE poids de corps.
      const ladder = standards.map((ratio, i) => ({
        level: LEVELS[i],
        ratio: Math.round(ratio * 100) / 100,
        kg: Math.round(ratio * bodyweightKg * 10) / 10,
        percentile: LEVEL_PERCENTILES[i],
        reached: item.ratio >= ratio,
      }));

      const next = ladder.find((l) => !l.reached) ?? null;

      return {
        ...item,
        ladder,
        next_level: next
          ? {
            level: next.level,
            kg: next.kg,
            delta_kg: Math.round((next.kg - item.one_rep_max_kg) * 10) / 10,
          }
          : null,
        // Charge à viser pour gagner 10 points de percentile.
        next_percentile_kg: Math.round(
          (loadForPercentile({
            lift: item.lift, sex, bodyweightKg,
            percentile: Math.min(99, item.percentile + 10),
          }) ?? 0) * 10,
        ) / 10,
      };
    })
    .sort((a, b) => b.percentile - a.percentile);

  const average = items.length
    ? Math.round((items.reduce((s, i) => s + i.percentile, 0) / items.length) * 10) / 10
    : null;

  return res.json({
    items,
    bodyweight_kg: bodyweightKg,
    sex,
    average_percentile: average,
    covered_lifts: items.length,
    // La base du classement voyage avec le classement : un percentile
    // sans sa population de référence est ininterprétable.
    reference: REFERENCE_POPULATION,
  });
}));


/**
 * Séances closes d'une fenêtre, avec leur charge et leur sport.
 *
 * Mutualisé par le bilan de charge et la progression : deux requêtes
 * séparées finissaient toujours par compter des choses légèrement
 * différentes.
 */
async function loadedSessions(userId, days, tz) {
  const { rows } = await query(
    `SELECT s.id,
            (s.started_at AT TIME ZONE $3)::date::text AS date,
            s.started_at,
            COALESCE(s.sport_key, 'musculation') AS sport_key,
            s.perceived_exertion AS rpe,
            ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0)::int AS minutes
       FROM workout_sessions s
      WHERE s.user_id = $1
        AND s.ended_at IS NOT NULL
        AND s.started_at >= now() - ($2::int || ' days')::interval
      ORDER BY s.started_at`,
    [userId, days, tz],
  );

  return rows.map((r) => {
    const sport = getSport(r.sport_key);
    return {
      ...r,
      sport: r.sport_key,
      category: sport?.category ?? null,
      label: sport?.label ?? r.sport_key,
      met: sport?.met ?? null,
      // Sans RPE, pas de charge. On ne la devine pas : une séance non
      // notée est une donnée manquante, pas une séance facile.
      load: sessionLoad({ rpe: r.rpe, minutes: r.minutes }),
    };
  });
}

/**
 * GET /api/stats/load?days=56&tz=
 *
 * Charge d'entraînement, toutes disciplines confondues. C'est la vue
 * qui manquait : l'application savait compter des séries, elle ne
 * savait pas dire qu'une semaine avait été lourde.
 */
statsRouter.get('/load', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const days = Math.min(365, Math.max(28, Number(req.query.days) || 56));

  const tz = String(req.query.tz ?? 'UTC');
  if (!/^[\w/+-]{1,64}$/.test(tz)) {
    return res.status(400).json({ error: `Fuseau horaire invalide : ${tz}` });
  }

  const sessions = await loadedSessions(userId, days, tz);
  const rated = sessions.filter((s) => s.load > 0);

  const from = isoDate(new Date(Date.now() - days * 86_400_000));
  const to = isoDate(new Date());
  const summary = loadSummary(rated, { from, to });

  return res.json({
    ...summary,
    timezone: tz,
    // Sans RPE, une séance ne pèse rien dans le bilan. Le dire évite de
    // chercher pourquoi une grosse semaine paraît vide.
    unrated_sessions: sessions.length - rated.length,
    categories: Object.fromEntries(
      CATEGORY_ORDER.map((k) => [k, { label: CATEGORIES[k].label, icon: CATEGORIES[k].icon }]),
    ),
    method: [
      'Charge d’une séance = RPE × durée en minutes (Foster, 2001).',
      'La monotonie est la charge quotidienne moyenne divisée par son '
      + 'écart-type, jours de repos compris — les retirer la ferait chuter '
      + 'artificiellement.',
      'Le rapport aigu/chronique est calculé DÉCOUPLÉ : les 7 derniers jours '
      + 'sont exclus de la base de comparaison, ce qui répond à la principale '
      + 'critique faite à la formule usuelle.',
      'Une séance sans RPE ne compte pas : une donnée manquante n’est pas un '
      + 'effort nul.',
    ],
  });
}));

/**
 * GET /api/stats/progression?tz=
 *
 * Niveau, XP et distinctions. Chaque point vient d'une charge
 * réellement enregistrée — rien n'est attribué pour avoir ouvert
 * l'application.
 */
statsRouter.get('/progression', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const tz = String(req.query.tz ?? 'UTC');
  if (!/^[\w/+-]{1,64}$/.test(tz)) {
    return res.status(400).json({ error: `Fuseau horaire invalide : ${tz}` });
  }

  // Une année : assez long pour que les paliers aient un sens, assez
  // court pour que la requête reste immédiate.
  const WINDOW = 365;
  const [sessions, { rows: [program] }] = await Promise.all([
    loadedSessions(userId, WINDOW, tz),
    query(
      `SELECT days_per_week FROM programs
        WHERE user_id = $1 AND is_active LIMIT 1`,
      [userId],
    ),
  ]);

  const rated = sessions.filter((s) => s.load > 0);
  const today = isoDate(new Date());
  const from = isoDate(new Date(Date.now() - WINDOW * 86_400_000));
  const days = dailySeries(rated, { from, to: today });

  const streak = weeklyStreak({
    sessionDates: sessions.map((s) => s.date),
    perWeek: program?.days_per_week ?? 0,
    today,
  });

  // --- Agrégats servant aux distinctions -------------------------------
  const bySport = new Map();
  for (const s of sessions) bySport.set(s.sport, (bySport.get(s.sport) ?? 0) + 1);

  const recentCutoff = isoDate(new Date(Date.now() - 28 * 86_400_000));
  const categoriesRecent = new Set(
    sessions.filter((s) => s.date >= recentCutoff && s.category).map((s) => s.category),
  );

  // Semaines OMS : 150 minutes d'activité modérée, l'intensité vigoureuse
  // comptant double (équivalence retenue par les recommandations).
  const whoByWeek = new Map();
  for (const s of sessions) {
    if (!(s.minutes > 0) || !(s.met >= 3)) continue;
    const key = weekStart(s.date);
    const credited = s.met >= 6 ? s.minutes * AEROBIC.vigorousEquivalence : s.minutes;
    whoByWeek.set(key, (whoByWeek.get(key) ?? 0) + credited);
  }
  const whoWeeks = [...whoByWeek.values()]
    .filter((m) => m >= AEROBIC.weeklyMinutesFloor).length;

  // Reprises : un écart de 14 jours ou plus entre deux séances closes.
  let comebacks = 0;
  for (let i = 1; i < sessions.length; i += 1) {
    const gap = (Date.parse(`${sessions[i].date}T00:00:00Z`)
      - Date.parse(`${sessions[i - 1].date}T00:00:00Z`)) / 86_400_000;
    if (gap >= 14) comebacks += 1;
  }

  const stats = {
    days,
    sessions: rated,
    sports_practised: bySport.size,
    categories_recent: categoriesRecent.size,
    best_streak: streak.best,
    who_weeks: whoWeeks,
    total_load: rated.reduce((n, s) => n + s.load, 0),
    total_sessions: sessions.length,
    top_sport_sessions: Math.max(0, ...bySport.values()),
  };

  const result = progression({ ...stats, comebacks });

  return res.json({
    ...result,
    window_days: WINDOW,
    streak,
    unrated_sessions: sessions.length - rated.length,
    category_labels: Object.fromEntries(
      CATEGORY_ORDER.map((k) => [k, { label: CATEGORIES[k].label, icon: CATEGORIES[k].icon }]),
    ),
    // Le niveau reflète un CUMUL DE TRAVAIL, pas une aptitude. Le dire
    // évite qu'il soit lu comme un classement de performance.
    caveat: 'Le niveau mesure le travail accumulé sur douze mois glissants, '
      + 'pas ta condition physique. L’application ne mesure ni ta VO₂max ni ta '
      + 'force relative, et un niveau élevé ne dit rien de ton niveau sportif.',
  });
}));

/**
 * GET /api/stats/streak?tz=
 *
 * Régularité tenue, en semaines. Pas en jours : un programme à quatre
 * séances impose trois jours de repos, et une série quotidienne
 * pousserait à s'entraîner contre son propre plan.
 */
statsRouter.get('/streak', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const tz = String(req.query.tz ?? 'UTC');
  if (!/^[\w/+-]{1,64}$/.test(tz)) {
    return res.status(400).json({ error: `Fuseau horaire invalide : ${tz}` });
  }

  const [{ rows: [program] }, { rows: sessions }] = await Promise.all([
    query(
      `SELECT days_per_week FROM programs
        WHERE user_id = $1 AND is_active LIMIT 1`,
      [userId],
    ),
    query(
      // Une séance OUVERTE ne compte pas : seule une séance close
      // atteste qu'elle a eu lieu.
      `SELECT (started_at AT TIME ZONE $2)::date::text AS local_date
         FROM workout_sessions
        WHERE user_id = $1 AND ended_at IS NOT NULL
          AND started_at >= now() - interval '1 year'`,
      [userId, tz],
    ),
  ]);

  return res.json({
    timezone: tz,
    ...weeklyStreak({
      sessionDates: sessions.map((r) => r.local_date),
      perWeek: program?.days_per_week ?? 0,
      today: isoDate(new Date()),
    }),
  });
}));

/**
 * GET /api/stats/adherence?weeks=8&tz=
 *
 * Ce qui était prévu face à ce qui a été fait. L'application savait dire
 * ce qu'on avait fait ; elle ne savait pas dire ce qu'on avait RATÉ — et
 * c'est la seule information qui explique une progression qui stagne.
 */
statsRouter.get('/adherence', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const weeks = Math.min(26, Math.max(1, Number(req.query.weeks) || 8));

  const tz = String(req.query.tz ?? 'UTC');
  if (!/^[\w/+-]{1,64}$/.test(tz)) {
    return res.status(400).json({ error: `Fuseau horaire invalide : ${tz}` });
  }

  const { rows: [program] } = await query(
    `SELECT id, name, weeks, starts_on::text AS starts_on
       FROM programs WHERE user_id = $1 AND is_active LIMIT 1`,
    [userId],
  );

  const today = isoDate(new Date());
  // La fenêtre part du DÉBUT DU CYCLE, pas d'il y a N semaines : un
  // programme lancé il y a trois semaines n'a pas huit semaines
  // d'adhérence à montrer, et les afficher vides serait trompeur.
  const from = program
    ? [program.starts_on, isoDate(new Date(Date.now() - weeks * 7 * 86_400_000))]
      .sort().at(-1)
    : isoDate(new Date(Date.now() - weeks * 7 * 86_400_000));

  const [days, sessions] = await Promise.all([
    program
      ? query(
        `SELECT id, weekday, title FROM program_days
          WHERE program_id = $1 AND weekday IS NOT NULL ORDER BY weekday`,
        [program.id],
      )
      : { rows: [] },
    query(
      `SELECT s.id, s.program_day_id,
              (s.started_at AT TIME ZONE $3)::date::text AS local_date
         FROM workout_sessions s
        WHERE s.user_id = $1
          AND (s.started_at AT TIME ZONE $3)::date >= $2::date`,
      [userId, from, tz],
    ),
  ]);

  return res.json({
    from,
    to: today,
    timezone: tz,
    ...computeAdherence({
      program,
      days: days.rows,
      sessions: sessions.rows,
      from,
      to: today,
      today,
    }),
  });
}));
