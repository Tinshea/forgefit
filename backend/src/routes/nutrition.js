import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import {
  computeTargets, scaleFood, validateFoodCoherence,
  GOAL_SETTINGS, ACTIVITY_MULTIPLIERS, ACTIVITY_LABELS,
} from '../services/nutrition.js';
import { resolveBodyProfile, observedLoad, trainingToday } from '../services/body-profile.js';
import {
  dayTypeFactors, reviewActivity, multiplierDriftKcal,
} from '../services/training-load.js';
import { findByBarcode, searchByName, OffUnavailable } from '../services/openfoodfacts.js';
import { reviewTargets, REFERENCES as NUTRITION_REFERENCES } from '../services/nutrition-evidence.js';
import { suggestMeals } from '../services/meal-planner.js';
import { BMR_FORMULAS } from '../services/anthropometry.js';
import { calibrateTdee, explainCalibration, MIN_DAYS } from '../services/tdee-calibration.js';

export const nutritionRouter = Router();

const MEALS = ['matin', 'midi', 'soir', 'collation'];

/** Clés acceptées pour `bmr_method`, 'mesure' compris. */
const BMR_METHOD_KEYS = new Set([...Object.keys(BMR_FORMULAS), 'mesure']);

const FOOD_FIELDS = `
  id, user_id, name, brand, barcode, source, reference_qty, unit,
  kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, nutriscore,
  category, image_url, meta
`;

// ---------------------------------------------------------------------
// Profil et objectifs
// ---------------------------------------------------------------------

/**
 * Cibles journalières.
 *
 * L'état corporel vient de `resolveBodyProfile`, partagé avec la route
 * Profil : deux résolutions séparées produisaient deux métabolismes de
 * base différents pour le même utilisateur.
 */
async function targetsFor(userId, { dayType = null } = {}) {
  const resolved = await resolveBodyProfile(userId);
  if (!resolved) return { targets: null, note: 'Profil introuvable.' };

  const { body, user, goals } = resolved;

  // Répartition entraînement / repos. Elle ne s'applique que si l'on
  // sait de quel type est le jour ET que l'utilisateur l'a activée.
  let dayFactor = 1;
  let split = null;
  if (goals.day_split_pct > 0 && dayType) {
    const load = await observedLoad(userId, 28);
    split = dayTypeFactors({
      trainingDaysPerWeek: load.training_days_per_week,
      shiftPct: goals.day_split_pct,
    });
    dayFactor = dayType === 'entrainement' ? split.training : split.rest;
  }

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
    dayFactor,
    dayType,
    bmrMethod: goals.bmr_method,
    measuredBmr: goals.measured_bmr,
  });

  return { ...computed, split };
}

/** GET /api/nutrition/profile — profil, cibles et méthode de calcul. */
nutritionRouter.get('/profile', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const resolved = await resolveBodyProfile(userId);
  const computed = await targetsFor(userId);

  res.json({
    profile: resolved
      ? {
        ...resolved.goals,
        lean_mass_kg: resolved.body.lean_mass_kg,
        body_fat_pct: resolved.body.body_fat_pct,
        bodyweight_kg: resolved.body.weight_kg,
        height_cm: resolved.body.height_cm,
      }
      : null,
    ...computed,
    options: {
      goals: Object.entries(GOAL_SETTINGS).map(([key, v]) => ({
        key, label: v.label, note: v.note,
        protein_per_kg: v.proteinPerKg, fat_per_kg: v.fatPerKg,
        calorie_factor: v.calorieFactor,
      })),
      activities: Object.entries(ACTIVITY_MULTIPLIERS).map(([key, multiplier]) => ({
        key, multiplier, label: ACTIVITY_LABELS[key],
      })),
      // Les formules sont renvoyées CALCULÉES sur le profil courant, pas
      // en abstrait : choisir entre « Katch-McArdle » et « Cunningham »
      // n'a aucun sens tant qu'on ne voit pas que l'une donne 1 742 kcal
      // et l'autre 1 897.
      bmr_methods: resolved?.derived?.bmr_methods?.methods ?? [],
      bmr_spread: resolved?.derived?.bmr_methods?.spread ?? null,
    },
  });
}));

/** PUT /api/nutrition/profile */
nutritionRouter.put('/profile', asyncHandler(async (req, res) => {
  const {
    goal, activity, lean_mass_kg: leanMass, body_fat_pct: bodyFat,
    kcal_override: kcalOverride, protein_override_g: proteinOverride,
    fat_override_g: fatOverride, fiber_target_g: fiberTarget,
    day_split_pct: daySplit,
    bmr_method: bmrMethod, measured_bmr: measuredBmr,
  } = req.body ?? {};

  if (goal && !GOAL_SETTINGS[goal]) {
    throw badRequest(`Objectif inconnu : ${goal}`);
  }
  if (activity && !ACTIVITY_MULTIPLIERS[activity]) {
    throw badRequest(`Niveau d’activité inconnu : ${activity}`);
  }
  // 'auto' est l'absence de choix : il s'écrit NULL en base, et la
  // contrainte CHECK le refuserait tel quel.
  const methodValue = bmrMethod === 'auto' ? null : (bmrMethod ?? null);
  if (methodValue && !BMR_METHOD_KEYS.has(methodValue)) {
    throw badRequest(`Méthode de calcul inconnue : ${bmrMethod}. Attendu : auto, `
      + `${[...BMR_METHOD_KEYS].join(', ')}.`);
  }
  if (methodValue === 'mesure' && !(measuredBmr > 0)) {
    throw badRequest('La méthode « mesure » exige une valeur de métabolisme de base. '
      + 'Lance une calibration ou saisis ta mesure.');
  }
  if (measuredBmr != null && measuredBmr !== '' && !(measuredBmr > 500 && measuredBmr < 5000)) {
    throw badRequest('Le métabolisme de base mesuré doit être compris entre 500 et '
      + '5 000 kcal.');
  }
  if (daySplit != null && !(daySplit >= 0 && daySplit <= 30)) {
    throw badRequest(
      'day_split_pct doit être compris entre 0 et 30 %. Au-delà, les jours de repos '
      + 'descendraient sous un apport raisonnable.',
    );
  }

  await query(
    `INSERT INTO nutrition_profiles
       (user_id, goal, activity, lean_mass_kg, body_fat_pct,
        kcal_override, protein_override_g, fat_override_g, fiber_target_g,
        day_split_pct, bmr_method, measured_bmr, updated_at)
     VALUES ($1,
             COALESCE($2::nutrition_goal, 'maintien'),
             COALESCE($3::activity_level, 'leger'),
             $4, $5, $6, $7, $8, COALESCE($9, 30), COALESCE($10, 0),
             $11, $12, now())
     ON CONFLICT (user_id) DO UPDATE SET
       -- Les PARAMÈTRES BRUTS, pas EXCLUDED : celui-ci porte déjà le
       -- COALESCE de l'INSERT, si bien qu'une mise à jour partielle
       -- écrasait l'objectif par « maintien » et l'activité par
       -- « léger ». Modifier un seul champ réinitialisait les deux
       -- entrées les plus structurantes du calcul.
       goal               = COALESCE($2::nutrition_goal, nutrition_profiles.goal),
       activity           = COALESCE($3::activity_level, nutrition_profiles.activity),
       lean_mass_kg       = COALESCE($4, nutrition_profiles.lean_mass_kg),
       body_fat_pct       = COALESCE($5, nutrition_profiles.body_fat_pct),
       kcal_override      = $6,
       protein_override_g = $7,
       fat_override_g     = $8,
       fiber_target_g     = COALESCE($9, nutrition_profiles.fiber_target_g),
       day_split_pct      = COALESCE($10, nutrition_profiles.day_split_pct),
       -- 'auto' doit pouvoir REVENIR à NULL : un COALESCE rendrait le
       -- choix automatique impossible à réactiver une fois une formule
       -- fixée. D'où le drapeau explicite plutôt qu'un test sur NULL.
       bmr_method         = CASE WHEN $13 THEN $11 ELSE nutrition_profiles.bmr_method END,
       measured_bmr       = CASE WHEN $14 THEN $12 ELSE nutrition_profiles.measured_bmr END,
       updated_at         = now()`,
    [
      userOf(req), goal ?? null, activity ?? null,
      leanMass ?? null, bodyFat ?? null,
      kcalOverride ?? null, proteinOverride ?? null, fatOverride ?? null,
      fiberTarget ?? null, daySplit ?? null,
      methodValue, measuredBmr === '' ? null : (measuredBmr ?? null),
      bmrMethod !== undefined, measuredBmr !== undefined,
    ],
  );

  res.json(await targetsFor(userOf(req)));
}));

/**
 * GET /api/nutrition/calibration?days=42
 *
 * La dépense énergétique RÉELLE, déduite du journal et des pesées.
 *
 * C'est la seule mesure de cette application qui ne repose sur aucune
 * équation de population : le bilan énergétique est une identité
 * comptable, pas une corrélation. Quand assez de données existent, elle
 * bat toutes les formules ; quand elles manquent, elle le dit et
 * n'invente rien.
 */
nutritionRouter.get('/calibration', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  // 42 jours par défaut : trois cycles hebdomadaires complets, assez
  // long pour noyer les oscillations hydriques, assez court pour que la
  // composition corporelle n'ait pas trop changé.
  const days = Math.min(Math.max(Number(req.query.days) || 42, MIN_DAYS), 180);

  const resolved = await resolveBodyProfile(userId);
  if (!resolved) throw notFound('Profil introuvable.');

  const [intake, weights, computed] = await Promise.all([
    query(
      `SELECT consumed_on::text AS date, kcal::float AS kcal
         FROM nutrition_daily
        WHERE user_id = $1 AND consumed_on >= CURRENT_DATE - $2::int
        ORDER BY consumed_on`,
      [userId, days],
    ),
    query(
      // Une seule pesée par jour : plusieurs mesures le même jour
      // pondéreraient ce jour-là dans la régression sans rien apporter.
      `SELECT DISTINCT ON (recorded_at::date)
              recorded_at::date::text AS date, magnitude::float AS weight_kg
         FROM health_metrics
        WHERE user_id = $1 AND metric_type = 'weight'
          AND magnitude IS NOT NULL
          AND recorded_at >= now() - ($2::int || ' days')::interval
        ORDER BY recorded_at::date, recorded_at DESC`,
      [userId, days],
    ),
    targetsFor(userId),
  ]);

  const declaredMultiplier = ACTIVITY_MULTIPLIERS[resolved.goals.activity] ?? null;
  const result = calibrateTdee({
    intake: intake.rows,
    weights: weights.rows,
    predictedTdee: computed.breakdown?.tdee ?? null,
    bmr: computed.breakdown?.bmr ?? null,
  });

  res.json({
    window_days: days,
    ...result,
    declared_activity: resolved.goals.activity,
    declared_multiplier: declaredMultiplier,
    explanation: explainCalibration(result, { declaredMultiplier }),
    method: [
      'Bilan énergétique : ce qui est stocké est ce qui est mangé moins ce '
      + 'qui est dépensé.',
      'Tendance de poids par régression linéaire sur toutes les pesées — pas '
      + 'par différence entre la première et la dernière, qu’un jour de '
      + 'rétention d’eau suffirait à fausser.',
      'Conversion : 7 700 kcal par kilogramme (Wishnofsky, 1958). '
      + 'Approximation valable pour une variation surtout adipeuse.',
      'Les jours non journalisés sont EXCLUS de la moyenne, pas comptés à '
      + 'zéro. Au-delà de 20 % de jours manquants, le calcul est refusé.',
    ],
    caveat: 'Cette estimation vaut pour la période observée. Un changement de '
      + 'poids important, de niveau d’activité ou de saison la périme : '
      + 'relance-la de temps en temps.',
  });
}));

// ---------------------------------------------------------------------
// Catalogue d'aliments
// ---------------------------------------------------------------------

/**
 * GET /api/nutrition/foods?q=...&source=off
 *
 * Interroge TOUJOURS la base locale d'abord. Open Food Facts n'est
 * consulté que sur demande explicite, et son indisponibilité n'est pas
 * une erreur de l'application.
 */
nutritionRouter.get('/foods', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const q = String(req.query.q ?? '').trim();
  const limit = Math.min(Number(req.query.limit) || 40, 100);

  const category = String(req.query.category ?? '').trim();

  const { rows } = await query(
    `SELECT ${FOOD_FIELDS}
       FROM foods
      WHERE (user_id IS NULL OR user_id = $1)
        AND ($2 = '' OR immutable_unaccent(name) ILIKE immutable_unaccent('%' || $2 || '%'))
        AND ($4 = '' OR category = $4::food_category)
      ORDER BY
        -- Les aliments personnels d'abord : ce sont ceux qu'on mange.
        (user_id IS NOT NULL) DESC,
        ${q ? 'similarity(name, $2) DESC,' : ''}
        name
      LIMIT $3`,
    [userId, q, limit, category],
  );

  const { rows: counts } = await query(
    `SELECT category::text AS category, COUNT(*)::int AS count
       FROM foods
      WHERE user_id IS NULL OR user_id = $1
      GROUP BY 1 ORDER BY 2 DESC`,
    [userId],
  );

  const payload = { items: rows, categories: counts, source: 'local' };

  // Complément réseau, uniquement si demandé et si le local ne suffit pas.
  if (req.query.source === 'off' && q.length >= 3) {
    try {
      payload.openfoodfacts = await searchByName(q, 10);
    } catch (err) {
      if (err instanceof OffUnavailable) {
        payload.openfoodfacts = [];
        payload.openfoodfacts_error = err.message;
      } else throw err;
    }
  }

  res.json(payload);
}));

/**
 * GET /api/nutrition/foods/barcode/:code
 *
 * Cherche d'abord localement (produit déjà scanné), puis chez OFF.
 */
nutritionRouter.get('/foods/barcode/:code', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const code = String(req.params.code).replace(/\D/g, '');

  const local = await query(
    `SELECT ${FOOD_FIELDS} FROM foods
      WHERE barcode = $1 AND (user_id IS NULL OR user_id = $2)
      ORDER BY (user_id IS NOT NULL) DESC LIMIT 1`,
    [code, userId],
  );
  if (local.rows.length) {
    return res.json({ food: local.rows[0], source: 'local' });
  }

  try {
    const food = await findByBarcode(code);
    if (!food) return res.status(404).json({ error: 'Produit inconnu d’Open Food Facts' });
    // Non enregistré ici : l'utilisateur confirme d'abord, ce qui évite
    // de polluer son catalogue à chaque scan raté.
    return res.json({ food, source: 'openfoodfacts' });
  } catch (err) {
    if (err instanceof OffUnavailable) {
      return res.status(503).json({
        error: err.message,
        hint: 'Saisis le produit à la main : le journal reste utilisable.',
      });
    }
    throw err;
  }
}));

/** POST /api/nutrition/foods — crée un aliment personnel. */
nutritionRouter.post('/foods', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  if (!b.name) throw badRequest('name est requis');
  if (b.kcal == null) throw badRequest('kcal est requis');

  const check = validateFoodCoherence(b);

  const { rows } = await query(
    `INSERT INTO foods
       (user_id, name, brand, barcode, source, reference_qty, unit,
        kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, nutriscore, meta,
        category, image_url)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,100),COALESCE($7,'g'),
             $8,COALESCE($9,0),COALESCE($10,0),COALESCE($11,0),COALESCE($12,0),
             $13,$14,COALESCE($15::jsonb,'{}'::jsonb),
             COALESCE($16::food_category,'autre'),$17)
     RETURNING ${FOOD_FIELDS}`,
    [
      userOf(req), b.name, b.brand ?? null, b.barcode ?? null,
      b.source ?? 'manual', b.reference_qty ?? null, b.unit ?? null,
      b.kcal, b.fat_g ?? null, b.carbs_g ?? null, b.protein_g ?? null,
      b.fiber_g ?? null, b.price_eur ?? null, b.nutriscore ?? null,
      b.meta ? JSON.stringify(b.meta) : null,
      b.category ?? null,
      // Photo du produit : renseignée par Open Food Facts au scan.
      b.image_url ?? b.meta?.image_url ?? null,
    ],
  );

  // La fiche est enregistrée même incohérente — c'est peut-être un
  // aliment atypique — mais l'avertissement remonte.
  res.status(201).json({ food: rows[0], coherence: check });
}));

/** DELETE /api/nutrition/foods/:id — aliments personnels uniquement. */
nutritionRouter.delete('/foods/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM foods WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Aliment introuvable ou non modifiable');
  res.status(204).end();
}));

// ---------------------------------------------------------------------
// Journal alimentaire
// ---------------------------------------------------------------------

/** GET /api/nutrition/day?date=YYYY-MM-DD */
nutritionRouter.get('/day', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const date = req.query.date ?? null;

  // Le type de jour détermine l'objectif calorique quand la répartition
  // entraînement / repos est activée. Il se lit sur les séances du jour,
  // pas sur une case à cocher.
  const training = await trainingToday(userId);
  const dayType = training.is_training_day ? 'entrainement' : 'repos';

  const [entries, byMeal, totals, computed, load] = await Promise.all([
    query(
      `SELECT id, meal, food_id, food_name, quantity, unit,
              kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, note
         FROM food_entries
        WHERE user_id = $1 AND consumed_on = COALESCE($2::date, CURRENT_DATE)
        ORDER BY
          CASE meal WHEN 'matin' THEN 1 WHEN 'midi' THEN 2
                    WHEN 'soir' THEN 3 ELSE 4 END,
          created_at`,
      [userId, date],
    ),
    query(
      `SELECT meal, kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, entries
         FROM nutrition_daily_by_meal
        WHERE user_id = $1 AND consumed_on = COALESCE($2::date, CURRENT_DATE)`,
      [userId, date],
    ),
    query(
      `SELECT kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, entries
         FROM nutrition_daily
        WHERE user_id = $1 AND consumed_on = COALESCE($2::date, CURRENT_DATE)`,
      [userId, date],
    ),
    targetsFor(userId, { dayType }),
    observedLoad(userId, 28),
  ]);

  const consumed = totals.rows[0] ?? {
    kcal: 0, fat_g: 0, carbs_g: 0, protein_g: 0, fiber_g: 0, price_eur: 0, entries: 0,
  };
  const t = computed.targets;

  res.json({
    date: date ?? new Date().toISOString().slice(0, 10),
    entries: entries.rows,
    // Le tableur affichait un récapitulatif par repas : on le reprend.
    by_meal: MEALS.map((meal) => byMeal.rows.find((r) => r.meal === meal)
      ?? { meal, kcal: 0, fat_g: 0, carbs_g: 0, protein_g: 0, fiber_g: 0, price_eur: 0, entries: 0 }),
    consumed,
    targets: t,
    // « Restant » du tableur : ce qu'il reste à manger dans la journée.
    remaining: t
      ? {
        kcal: Math.round((t.kcal - Number(consumed.kcal)) * 10) / 10,
        protein_g: Math.round((t.protein_g - Number(consumed.protein_g)) * 10) / 10,
        fat_g: Math.round((t.fat_g - Number(consumed.fat_g)) * 10) / 10,
        carbs_g: Math.round((t.carbs_g - Number(consumed.carbs_g)) * 10) / 10,
        fiber_g: Math.round((t.fiber_g - Number(consumed.fiber_g)) * 10) / 10,
      }
      : null,
    breakdown: computed.breakdown ?? null,
    method: computed.method ?? null,
    warnings: computed.warnings ?? [],
    // Confrontation des cibles aux repères publiés. Des CONSTATS, pas
    // des corrections : les cibles restent celles de l'utilisateur, et
    // les corriger en douce rendrait le calcul invérifiable.
    review: reviewTargets({
      targets: t,
      goal: computed.inputs?.goal,
      leanMassKg: computed.inputs?.lean_mass_kg,
      weightKg: computed.inputs?.weight_kg,
    }),
    // Le lien avec l'entraînement. Le multiplicateur d'activité inclut
    // déjà les séances : on ne rajoute aucune calorie, on confronte le
    // déclaré au réalisé et on répartit le total à somme constante.
    training: {
      ...training,
      day_type: dayType,
      load,
      split: computed.split,
      activity: {
        ...reviewActivity({ declared: computed.inputs?.activity, load }),
        kcal_hint: multiplierDriftKcal(
          computed.breakdown?.bmr,
          computed.inputs?.activity,
          reviewActivity({ declared: computed.inputs?.activity, load }).observed,
        ),
      },
    },
  });
}));

/** POST /api/nutrition/entries — enregistre un aliment consommé. */
nutritionRouter.post('/entries', asyncHandler(async (req, res) => {
  const {
    food_id: foodId, meal, quantity, consumed_on: consumedOn, note,
    // Saisie libre, sans passer par le catalogue.
    food_name: freeName, kcal, fat_g: fat, carbs_g: carbs,
    protein_g: protein, fiber_g: fiber, price_eur: price, unit,
  } = req.body ?? {};

  if (!meal || !MEALS.includes(meal)) {
    throw badRequest(`meal doit valoir : ${MEALS.join(', ')}`);
  }
  if (!(Number(quantity) > 0)) throw badRequest('quantity doit être positive');

  let row;
  if (foodId) {
    const { rows } = await query(
      `SELECT ${FOOD_FIELDS} FROM foods
        WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [foodId, userOf(req)],
    );
    if (!rows.length) throw notFound('Aliment introuvable');
    const food = rows[0];
    const scaled = scaleFood(food, quantity);
    row = {
      food_id: food.id, food_name: food.name, unit: food.unit, ...scaled,
    };
  } else {
    if (!freeName) throw badRequest('food_id ou food_name est requis');
    if (kcal == null) throw badRequest('kcal est requis pour une saisie libre');
    row = {
      food_id: null, food_name: freeName, unit: unit ?? 'g',
      kcal, fat_g: fat ?? 0, carbs_g: carbs ?? 0,
      protein_g: protein ?? 0, fiber_g: fiber ?? 0, price_eur: price ?? null,
    };
  }

  const { rows: inserted } = await query(
    `INSERT INTO food_entries
       (user_id, consumed_on, meal, food_id, food_name, quantity, unit,
        kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, note)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      userOf(req), consumedOn ?? null, meal, row.food_id, row.food_name,
      quantity, row.unit, row.kcal, row.fat_g, row.carbs_g,
      row.protein_g, row.fiber_g, row.price_eur, note ?? null,
    ],
  );

  res.status(201).json(inserted[0]);
}));

/** DELETE /api/nutrition/entries/:id */
nutritionRouter.delete('/entries/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM food_entries WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Entrée introuvable');
  res.status(204).end();
}));

/**
 * POST /api/nutrition/entries/copy — recopie un jour entier.
 *
 * L'alimentation est très répétitive : recopier la veille évite de
 * ressaisir quinze lignes identiques chaque matin.
 */
nutritionRouter.post('/entries/copy', asyncHandler(async (req, res) => {
  const { from, to, meal } = req.body ?? {};
  if (!from) throw badRequest('from (date source) est requis');

  const copied = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO food_entries
         (user_id, consumed_on, meal, food_id, food_name, quantity, unit,
          kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, note)
       SELECT user_id, COALESCE($3::date, CURRENT_DATE), meal, food_id, food_name,
              quantity, unit, kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, note
         FROM food_entries
        WHERE user_id = $1 AND consumed_on = $2::date
          AND ($4::meal_slot IS NULL OR meal = $4::meal_slot)
       RETURNING id`,
      [userOf(req), from, to ?? null, meal ?? null],
    );
    return rows.length;
  });

  res.status(201).json({ copied });
}));

/** GET /api/nutrition/history?days=30 — tendances. */
nutritionRouter.get('/history', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const userId = userOf(req);

  const [nutrition, weight] = await Promise.all([
    query(
      `SELECT consumed_on AS day, kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur
         FROM nutrition_daily
        WHERE user_id = $1 AND consumed_on > CURRENT_DATE - ($2 || ' days')::interval
        ORDER BY consumed_on`,
      [userId, String(days)],
    ),
    // Le poids vit dans health_metrics : une balance connectée l'y écrit
    // déjà, il n'y a pas de raison de le dupliquer côté nutrition.
    query(
      `SELECT date_trunc('day', recorded_at)::date AS day,
              AVG(magnitude)::numeric(6,2) AS weight_kg
         FROM health_metrics
        WHERE user_id = $1 AND metric_type = 'weight'
          AND recorded_at > now() - ($2 || ' days')::interval
        GROUP BY 1 ORDER BY 1`,
      [userId, String(days)],
    ),
  ]);

  const avg = (key) => {
    const vals = nutrition.rows.map((r) => Number(r[key])).filter(Number.isFinite);
    return vals.length
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
      : null;
  };

  res.json({
    window_days: days,
    nutrition: nutrition.rows,
    weight: weight.rows,
    averages: {
      kcal: avg('kcal'),
      protein_g: avg('protein_g'),
      fat_g: avg('fat_g'),
      carbs_g: avg('carbs_g'),
      fiber_g: avg('fiber_g'),
      price_eur: avg('price_eur'),
    },
    days_logged: nutrition.rows.length,
  });
}));

// =====================================================================
// Recettes et suggestions
//
// Le journal sait compter ce qui a été mangé ; il ne sait rien proposer.
// Ces routes comblent ce trou : des plats composés d'aliments du
// catalogue, classés selon ce qu'il RESTE à manger dans la journée.
// =====================================================================

const RECIPE_FIELDS = `
  r.id, r.slug, r.name, r.meals, r.servings, r.prep_minutes, r.tags,
  r.steps, r.note, r.source, r.user_id,
  m.kcal, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g, m.price_eur,
  m.ingredient_count
`;

/** Recettes visibles : catalogue commun + recettes personnelles. */
const RECIPE_SCOPE = '(r.user_id IS NULL OR r.user_id = $1)';

/** Ingrédients d'une recette, dans l'ordre. */
async function loadIngredients(recipeId) {
  const { rows } = await query(
    `SELECT ri.id, ri.quantity, ri.position, ri.optional,
            f.id AS food_id, f.name, f.brand, f.category, f.image_url,
            f.reference_qty, f.unit,
            -- Macros DE LA QUANTITÉ utilisée, pas de la référence : la
            -- conversion refaite côté client divergerait de la vue.
            (f.kcal      * ri.quantity / f.reference_qty)::numeric(8,2) AS kcal,
            (f.protein_g * ri.quantity / f.reference_qty)::numeric(8,2) AS protein_g,
            (f.carbs_g   * ri.quantity / f.reference_qty)::numeric(8,2) AS carbs_g,
            (f.fat_g     * ri.quantity / f.reference_qty)::numeric(8,2) AS fat_g,
            (f.fiber_g   * ri.quantity / f.reference_qty)::numeric(8,2) AS fiber_g,
            (f.price_eur * ri.quantity / f.reference_qty)::numeric(8,3) AS price_eur
       FROM recipe_ingredients ri
       JOIN foods f ON f.id = ri.food_id
      WHERE ri.recipe_id = $1
      ORDER BY ri.position`,
    [recipeId],
  );
  return rows;
}

/**
 * GET /api/nutrition/recipes
 * Filtres : meal, q, tag, max_kcal, min_protein
 */
nutritionRouter.get('/recipes', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    meal, q, tag, max_kcal: maxKcal, min_protein: minProtein,
  } = req.query;

  if (meal && !MEALS.includes(String(meal))) {
    throw badRequest(`Repas inconnu : ${meal}. Attendu : ${MEALS.join(', ')}`);
  }

  const conditions = [RECIPE_SCOPE];
  const params = [userId];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replace('?', `$${params.length}`));
  };

  if (meal) add('?::meal_slot = ANY(r.meals)', meal);
  if (tag) add('? = ANY(r.tags)', tag);
  if (q) add('immutable_unaccent(lower(r.name)) LIKE immutable_unaccent(lower(?))', `%${q}%`);
  if (maxKcal) add('m.kcal <= ?', Number(maxKcal));
  if (minProtein) add('m.protein_g >= ?', Number(minProtein));

  const { rows } = await query(
    `SELECT ${RECIPE_FIELDS}
       FROM recipes r
       JOIN recipe_macros m ON m.recipe_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.protein_g DESC, r.name`,
    params,
  );

  const { rows: tags } = await query(
    `SELECT DISTINCT unnest(r.tags) AS tag FROM recipes r
      WHERE ${RECIPE_SCOPE} ORDER BY 1`,
    [userId],
  );

  res.json({ total: rows.length, tags: tags.map((x) => x.tag), items: rows });
}));

/** GET /api/nutrition/recipes/:id — fiche complète avec ingrédients. */
nutritionRouter.get('/recipes/:id', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const { rows } = await query(
    `SELECT ${RECIPE_FIELDS}
       FROM recipes r
       JOIN recipe_macros m ON m.recipe_id = r.id
      WHERE r.id = $2 AND ${RECIPE_SCOPE}`,
    [userId, req.params.id],
  );
  if (!rows.length) throw notFound('Recette introuvable');

  res.json({ ...rows[0], ingredients: await loadIngredients(req.params.id) });
}));

/**
 * GET /api/nutrition/suggestions?meal=&date=
 *
 * Classe les recettes du repas demandé selon ce qu'il RESTE à manger.
 * Une suggestion qui ignore le journal du jour n'est qu'un livre de
 * cuisine : celle-ci part du budget restant et du nombre de repas encore
 * à prendre.
 */
nutritionRouter.get('/suggestions', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const meal = String(req.query.meal ?? 'midi');
  const date = req.query.date ?? null;

  if (!MEALS.includes(meal)) {
    throw badRequest(`Repas inconnu : ${meal}. Attendu : ${MEALS.join(', ')}`);
  }

  const [targetsResult, totals, byMeal, profile, recipes] = await Promise.all([
    targetsFor(userId),
    query(
      `SELECT kcal, protein_g, carbs_g, fat_g, fiber_g FROM nutrition_daily
        WHERE user_id = $1 AND consumed_on = COALESCE($2::date, CURRENT_DATE)`,
      [userId, date],
    ),
    query(
      `SELECT meal FROM nutrition_daily_by_meal
        WHERE user_id = $1 AND consumed_on = COALESCE($2::date, CURRENT_DATE)`,
      [userId, date],
    ),
    resolveBodyProfile(userId),
    query(
      `SELECT ${RECIPE_FIELDS}
         FROM recipes r
         JOIN recipe_macros m ON m.recipe_id = r.id
        WHERE ${RECIPE_SCOPE} AND $2::meal_slot = ANY(r.meals)`,
      [userId, meal],
    ),
  ]);

  const targets = targetsResult.targets;
  if (!targets) {
    throw badRequest(
      'Aucune cible calculée : renseigne ton poids et ta taille dans le profil.',
    );
  }

  const consumed = totals.rows[0] ?? {};
  const remaining = {
    kcal: targets.kcal - Number(consumed.kcal ?? 0),
    protein_g: targets.protein_g - Number(consumed.protein_g ?? 0),
    carbs_g: targets.carbs_g - Number(consumed.carbs_g ?? 0),
    fat_g: targets.fat_g - Number(consumed.fat_g ?? 0),
    fiber_g: targets.fiber_g - Number(consumed.fiber_g ?? 0),
  };

  // Repas encore à prendre, celui-ci compris. Un repas déjà renseigné
  // est considéré comme pris : sans cela, le budget du dîner serait
  // calculé comme s'il restait un petit-déjeuner à manger.
  const taken = new Set(byMeal.rows.map((x) => x.meal));
  const mealsLeft = MEALS.filter((x) => x === meal || !taken.has(x)).length;

  const suggestions = suggestMeals({
    recipes: recipes.rows,
    remaining,
    mealsLeft,
    bodyweightKg: profile?.body?.weight_kg ?? null,
    limit: Number(req.query.limit) || 6,
  });

  res.json({
    meal,
    date: date ?? new Date().toISOString().slice(0, 10),
    remaining,
    ...suggestions,
    sources: [
      { key: 'schoenfeld2018distribution', ...NUTRITION_REFERENCES.schoenfeld2018distribution },
    ],
  });
}));

/**
 * POST /api/nutrition/entries/recipe
 * Corps : { recipe_id, meal, portion, consumed_on }
 *
 * Enregistre les INGRÉDIENTS, pas la recette : le journal reste une
 * liste d'aliments, et supprimer une recette du catalogue ne doit pas
 * effacer ce qui a été mangé.
 */
nutritionRouter.post('/entries/recipe', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    recipe_id: recipeId, meal, portion = 1, consumed_on: consumedOn,
  } = req.body ?? {};

  if (!recipeId) throw badRequest('recipe_id est requis');
  if (!meal || !MEALS.includes(meal)) {
    throw badRequest(`meal est requis et doit valoir : ${MEALS.join(', ')}`);
  }
  if (!(portion > 0 && portion <= 10)) {
    throw badRequest('portion doit être comprise entre 0 (exclu) et 10');
  }

  const inserted = await withTransaction(async (client) => {
    const { rows: [recipe] } = await client.query(
      `SELECT r.id, r.name, r.servings FROM recipes r
        WHERE r.id = $2 AND (r.user_id IS NULL OR r.user_id = $1)`,
      [userId, recipeId],
    );
    if (!recipe) throw notFound('Recette introuvable');

    const ingredients = await loadIngredients(recipeId);
    if (!ingredients.length) throw badRequest('Cette recette n’a aucun ingrédient');

    const rows = [];
    for (const ing of ingredients) {
      // `loadIngredients` rend déjà les macros DE LA QUANTITÉ inscrite
      // dans la recette, pour `servings` portions. Passer à `portion`
      // portions est donc une simple règle de trois — refaire la
      // conversion depuis `reference_qty` la ferait deux fois.
      const factor = portion / recipe.servings;
      const scale = (v) => Math.round(Number(v ?? 0) * factor * 100) / 100;

      const { rows: [row] } = await client.query(
        `INSERT INTO food_entries
           (user_id, consumed_on, meal, food_id, food_name, quantity, unit,
            kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, note)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7,
                 $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, food_name, quantity, unit, kcal, protein_g`,
        [
          userId, consumedOn ?? null, meal, ing.food_id, ing.name,
          scale(ing.quantity), ing.unit,
          scale(ing.kcal), scale(ing.fat_g), scale(ing.carbs_g),
          scale(ing.protein_g), scale(ing.fiber_g),
          ing.price_eur == null ? null : scale(ing.price_eur),
          // La note rattache la ligne à sa recette : sans elle, le
          // journal affiche six aliments sans dire qu'ils forment un plat.
          `${recipe.name}${portion === 1 ? '' : ` · ${portion} portion(s)`}`,
        ],
      );
      rows.push(row);
    }
    return { recipe, rows };
  });

  res.status(201).json({
    recipe: inserted.recipe.name,
    entries: inserted.rows.length,
    items: inserted.rows,
  });
}));
