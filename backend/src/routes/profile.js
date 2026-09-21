import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest, userOf } from '../lib/http.js';
import { ageFrom } from '../services/anthropometry.js';
import {
  resolveBodyProfile, trainingMinutesToday, observedLoad,
} from '../services/body-profile.js';
import { reviewActivity, multiplierDriftKcal } from '../services/training-load.js';
import {
  GOAL_SETTINGS, ACTIVITY_MULTIPLIERS, ACTIVITY_LABELS, computeTargets,
} from '../services/nutrition.js';

export const profileRouter = Router();


/**
 * Construit la charge utile du profil.
 *
 * L'état corporel vient de `resolveBodyProfile`, partagé avec la route
 * Nutrition — c'est la seule façon de garantir que les deux écrans
 * affichent le même métabolisme de base.
 */
async function buildProfile(userId) {
  const trainingMinutes = await trainingMinutesToday(userId);
  const resolved = await resolveBodyProfile(userId, { trainingMinutes });
  if (!resolved) return null;

  const { user, body, sources, composition, goals, derived } = resolved;

  // Le niveau d'activité est l'entrée la plus lourde du calcul de
  // dépense — et la seule qu'on choisit une fois sans jamais la revoir.
  // On la confronte donc aux séances réellement enregistrées, là où
  // elle se règle.
  const load = await observedLoad(userId, 28);

  const nutrition = computeTargets({
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
    bmrMethod: goals.bmr_method,
    measuredBmr: goals.measured_bmr,
  });

  // Ce qui manque, et ce que ça débloque : une liste de champs vides ne
  // dit pas pourquoi les remplir.
  const gaps = [];
  if (!body.height_cm) {
    gaps.push({
      field: 'height_cm', label: 'Taille',
      unlocks: 'IMC, FFMI, et l’estimation de dépense sans taux de masse grasse',
    });
  }
  if (!body.weight_kg) {
    gaps.push({
      field: 'bodyweight_kg', label: 'Poids',
      unlocks: 'standards de force, objectifs nutritionnels, hydratation',
      hint: 'Une balance connectée à Santé le renseigne automatiquement.',
    });
  }
  if (!user.birth_date) {
    gaps.push({
      field: 'birth_date', label: 'Date de naissance',
      unlocks: 'estimation de dépense par Mifflin-St Jeor',
    });
  }
  if (body.body_fat_pct == null && sources.lean_mass?.origin !== 'mesuré') {
    gaps.push({
      field: 'body_fat_pct', label: 'Taux de masse grasse',
      unlocks: 'FFMI, et les formules assises sur la masse maigre '
        + '(Katch-McArdle, Cunningham)',
      hint: 'Une balance à impédance reliée à Santé le renseigne automatiquement.',
    });
  }
  if (user.sex === 'unspecified') {
    gaps.push({
      field: 'sex', label: 'Sexe',
      unlocks: 'standards de force adaptés et estimation de dépense',
    });
  }

  return {
    identity: user,
    morphology: { ...body, sources, composition },
    goals,
    derived: {
      bmi: derived.bmi,
      ffmi: derived.ffmi,
      bmr: derived.bmr,
      hydration: derived.hydration,
    },
    nutrition_targets: nutrition.targets,
    nutrition_method: nutrition.method,
    gaps,
    // Confrontation du niveau déclaré à la charge enregistrée, affichée
    // là où ce niveau se règle : un écart d'un cran vaut plusieurs
    // centaines de kilocalories par jour.
    activity_check: {
      ...reviewActivity({ declared: goals.activity, load }),
      kcal_hint: multiplierDriftKcal(
        nutrition.breakdown?.bmr,
        goals.activity,
        reviewActivity({ declared: goals.activity, load }).observed,
      ),
    },
    options: {
      goals: Object.entries(GOAL_SETTINGS).map(([key, v]) => ({
        key, label: v.label, note: v.note,
        protein_per_kg: v.proteinPerKg, fat_per_kg: v.fatPerKg,
        calorie_factor: v.calorieFactor,
      })),
      activities: Object.entries(ACTIVITY_MULTIPLIERS).map(([key, multiplier]) => ({
        key, multiplier, label: ACTIVITY_LABELS[key],
      })),
      sexes: [
        { key: 'male', label: 'Homme' },
        { key: 'female', label: 'Femme' },
        { key: 'unspecified', label: 'Non précisé' },
      ],
    },
  };
}

/** GET /api/profile */
profileRouter.get('/', asyncHandler(async (req, res) => {
  const profile = await buildProfile(userOf(req));
  if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
  return res.json(profile);
}));

/** PUT /api/profile */
profileRouter.put('/', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const b = req.body ?? {};

  if (b.sex && !['male', 'female', 'unspecified'].includes(b.sex)) {
    throw badRequest(`Sexe inconnu : ${b.sex}`);
  }
  if (b.goal && !GOAL_SETTINGS[b.goal]) throw badRequest(`Objectif inconnu : ${b.goal}`);
  if (b.activity && !ACTIVITY_MULTIPLIERS[b.activity]) {
    throw badRequest(`Niveau d’activité inconnu : ${b.activity}`);
  }
  if (b.height_cm != null && !(b.height_cm > 50 && b.height_cm < 260)) {
    throw badRequest('Taille hors bornes (50 à 260 cm)');
  }
  if (b.bodyweight_kg != null && !(b.bodyweight_kg > 20 && b.bodyweight_kg < 400)) {
    throw badRequest('Poids hors bornes (20 à 400 kg)');
  }
  if (b.body_fat_pct != null && !(b.body_fat_pct >= 3 && b.body_fat_pct < 70)) {
    throw badRequest('Taux de masse grasse hors bornes (3 à 70 %)');
  }
  if (b.birth_date != null) {
    const age = ageFrom(b.birth_date);
    if (age == null || age < 10 || age > 110) throw badRequest('Date de naissance invalide');
  }

  await query(
    `UPDATE users SET
       display_name  = COALESCE($2, display_name),
       sex           = COALESCE($3::sex, sex),
       birth_date    = COALESCE($4::date, birth_date),
       bodyweight_kg = COALESCE($5, bodyweight_kg),
       height_cm     = COALESCE($6, height_cm),
       updated_at    = now()
     WHERE id = $1`,
    [
      userId, b.display_name ?? null, b.sex ?? null, b.birth_date ?? null,
      b.bodyweight_kg ?? null, b.height_cm ?? null,
    ],
  );

  // Une valeur saisie ici est aussi une MESURE : elle rejoint
  // l'historique, sinon les courbes ignoreraient les saisies manuelles
  // et la valeur ne primerait jamais sur une ancienne pesée.
  const asMeasurement = [
    ['weight', b.bodyweight_kg, 'kg'],
    ['body_fat', b.body_fat_pct, '%'],
    ['height', b.height_cm, 'cm'],
    ['lean_mass', b.lean_mass_kg, 'kg'],
  ];
  for (const [type, value, unit] of asMeasurement) {
    if (value == null) continue;
    await query(
      `INSERT INTO health_metrics (user_id, metric_type, recorded_at, source, unit, value)
       VALUES ($1, $2, now(), 'profil', $3, $4::jsonb)`,
      [userId, type, unit, JSON.stringify({ value: Number(value) })],
    );
  }

  const hasNutritionField = ['goal', 'activity', 'lean_mass_kg', 'body_fat_pct',
    'kcal_override', 'protein_override_g', 'fat_override_g', 'fiber_target_g']
    .some((k) => b[k] !== undefined);

  if (hasNutritionField) {
    await query(
      `INSERT INTO nutrition_profiles
         (user_id, goal, activity, lean_mass_kg, body_fat_pct,
          kcal_override, protein_override_g, fat_override_g, fiber_target_g, updated_at)
       VALUES ($1, COALESCE($2::nutrition_goal,'maintien'),
               COALESCE($3::activity_level,'leger'),
               $4, $5, $6, $7, $8, COALESCE($9, 30), now())
       ON CONFLICT (user_id) DO UPDATE SET
         goal               = COALESCE($2::nutrition_goal, nutrition_profiles.goal),
         activity           = COALESCE($3::activity_level, nutrition_profiles.activity),
         lean_mass_kg       = COALESCE($4, nutrition_profiles.lean_mass_kg),
         body_fat_pct       = COALESCE($5, nutrition_profiles.body_fat_pct),
         kcal_override      = COALESCE($6, nutrition_profiles.kcal_override),
         protein_override_g = COALESCE($7, nutrition_profiles.protein_override_g),
         fat_override_g     = COALESCE($8, nutrition_profiles.fat_override_g),
         fiber_target_g     = COALESCE($9, nutrition_profiles.fiber_target_g),
         updated_at         = now()`,
      [
        userId, b.goal ?? null, b.activity ?? null,
        b.lean_mass_kg ?? null, b.body_fat_pct ?? null,
        b.kcal_override ?? null, b.protein_override_g ?? null,
        b.fat_override_g ?? null, b.fiber_target_g ?? null,
      ],
    );
  }

  // Profil recalculé : l'interface voit l'effet immédiat sur tous les
  // indices dérivés.
  return res.json(await buildProfile(userId));
}));
