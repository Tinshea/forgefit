import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import {
  computeTargets, scaleFood, validateFoodCoherence,
  GOAL_SETTINGS, ACTIVITY_MULTIPLIERS, ACTIVITY_LABELS,
} from '../services/nutrition.js';
import { resolveBodyProfile } from '../services/body-profile.js';
import { findByBarcode, searchByName, OffUnavailable } from '../services/openfoodfacts.js';

export const nutritionRouter = Router();

const MEALS = ['matin', 'midi', 'soir', 'collation'];

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
async function targetsFor(userId) {
  const resolved = await resolveBodyProfile(userId);
  if (!resolved) return { targets: null, note: 'Profil introuvable.' };

  const { body, user, goals } = resolved;

  return computeTargets({
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
    },
  });
}));

/** PUT /api/nutrition/profile */
nutritionRouter.put('/profile', asyncHandler(async (req, res) => {
  const {
    goal, activity, lean_mass_kg: leanMass, body_fat_pct: bodyFat,
    kcal_override: kcalOverride, protein_override_g: proteinOverride,
    fat_override_g: fatOverride, fiber_target_g: fiberTarget,
  } = req.body ?? {};

  if (goal && !GOAL_SETTINGS[goal]) {
    throw badRequest(`Objectif inconnu : ${goal}`);
  }
  if (activity && !ACTIVITY_MULTIPLIERS[activity]) {
    throw badRequest(`Niveau d’activité inconnu : ${activity}`);
  }

  await query(
    `INSERT INTO nutrition_profiles
       (user_id, goal, activity, lean_mass_kg, body_fat_pct,
        kcal_override, protein_override_g, fat_override_g, fiber_target_g, updated_at)
     VALUES ($1,
             COALESCE($2::nutrition_goal, 'maintien'),
             COALESCE($3::activity_level, 'leger'),
             $4, $5, $6, $7, $8, COALESCE($9, 30), now())
     ON CONFLICT (user_id) DO UPDATE SET
       goal               = COALESCE(EXCLUDED.goal, nutrition_profiles.goal),
       activity           = COALESCE(EXCLUDED.activity, nutrition_profiles.activity),
       lean_mass_kg       = COALESCE($4, nutrition_profiles.lean_mass_kg),
       body_fat_pct       = COALESCE($5, nutrition_profiles.body_fat_pct),
       kcal_override      = $6,
       protein_override_g = $7,
       fat_override_g     = $8,
       fiber_target_g     = COALESCE($9, nutrition_profiles.fiber_target_g),
       updated_at         = now()`,
    [
      userOf(req), goal ?? null, activity ?? null,
      leanMass ?? null, bodyFat ?? null,
      kcalOverride ?? null, proteinOverride ?? null, fatOverride ?? null,
      fiberTarget ?? null,
    ],
  );

  res.json(await targetsFor(userOf(req)));
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

  const [entries, byMeal, totals, computed] = await Promise.all([
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
    targetsFor(userId),
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
