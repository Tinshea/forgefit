import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';

export const workoutsRouter = Router();


/** GET /api/workouts — sessions recentes avec resume. */
workoutsRouter.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { rows } = await query(
    `SELECT s.id, s.title, s.started_at, s.ended_at, s.notes,
            s.perceived_exertion,
            COUNT(ws.id)::int                       AS set_count,
            COALESCE(SUM(ws.volume_kg), 0)::numeric AS volume_kg,
            COUNT(DISTINCT ws.exercise_id)::int     AS exercise_count
       FROM workout_sessions s
       LEFT JOIN workout_sets ws ON ws.session_id = s.id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.started_at DESC
      LIMIT $2`,
    [userOf(req), limit],
  );

  res.json({ items: rows });
}));

/** POST /api/workouts — ouvre une seance. */
workoutsRouter.post('/', asyncHandler(async (req, res) => {
  const { title, notes, started_at: startedAt } = req.body ?? {};

  const { rows } = await query(
    `INSERT INTO workout_sessions (user_id, title, notes, started_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
     RETURNING id, title, started_at, notes`,
    [userOf(req), title ?? null, notes ?? null, startedAt ?? null],
  );

  res.status(201).json(rows[0]);
}));

/** GET /api/workouts/:id — seance detaillee. */
workoutsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT s.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ws.id,
                  'exercise_id', ws.exercise_id,
                  'name_fr', e.name_fr,
                  'gif_url', e.gif_url,
                  'target', e.target,
                  'set_index', ws.set_index,
                  'weight_kg', ws.weight_kg,
                  'reps', ws.reps,
                  'rpe', ws.rpe,
                  'duration_s', ws.duration_s,
                  'is_warmup', ws.is_warmup,
                  'volume_kg', ws.volume_kg,
                  'completed_at', ws.completed_at
                ) ORDER BY ws.completed_at
              ) FILTER (WHERE ws.id IS NOT NULL),
              '[]'::json
            ) AS sets
       FROM workout_sessions s
       LEFT JOIN workout_sets ws ON ws.session_id = s.id
       LEFT JOIN exercises e     ON e.id = ws.exercise_id
      WHERE s.id = $1 AND s.user_id = $2
      GROUP BY s.id`,
    [req.params.id, userOf(req)],
  );

  if (!rows.length) throw notFound('Séance introuvable');
  res.json(rows[0]);
}));

/** PATCH /api/workouts/:id — cloture / annotation. */
workoutsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { ended_at: endedAt, notes, perceived_exertion: rpe, title } = req.body ?? {};

  const { rows } = await query(
    `UPDATE workout_sessions
        SET ended_at           = COALESCE($3::timestamptz, ended_at),
            notes              = COALESCE($4, notes),
            perceived_exertion = COALESCE($5::smallint, perceived_exertion),
            title              = COALESCE($6, title)
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
    [req.params.id, userOf(req), endedAt ?? null, notes ?? null, rpe ?? null, title ?? null],
  );

  if (!rows.length) throw notFound('Séance introuvable');
  res.json(rows[0]);
}));

/**
 * POST /api/workouts/:id/sets — enregistre une serie.
 *
 * Chemin critique du mode Terrain : doit rester en une requete, sans
 * aller-retour de validation cote client.
 */
workoutsRouter.post('/:id/sets', asyncHandler(async (req, res) => {
  const {
    exercise_id: exerciseId, weight_kg: weightKg, reps, rpe,
    duration_s: durationS, distance_m: distanceM, is_warmup: isWarmup,
  } = req.body ?? {};

  if (!exerciseId) throw badRequest('exercise_id est requis');
  if (reps == null && durationS == null && distanceM == null) {
    throw badRequest('Une série doit porter au moins reps, duration_s ou distance_m');
  }

  const row = await withTransaction(async (client) => {
    const owned = await client.query(
      'SELECT 1 FROM workout_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, userOf(req)],
    );
    if (!owned.rows.length) throw notFound('Séance introuvable');

    // set_index calcule cote serveur : le client hors-ligne ne peut pas
    // le connaitre de facon fiable, et la contrainte d'unicite le refuse.
    const next = await client.query(
      `SELECT COALESCE(MAX(set_index), 0) + 1 AS idx
         FROM workout_sets
        WHERE session_id = $1 AND exercise_id = $2`,
      [req.params.id, exerciseId],
    );

    const inserted = await client.query(
      `INSERT INTO workout_sets
         (session_id, exercise_id, set_index, weight_kg, reps, rpe,
          duration_s, distance_m, is_warmup)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, FALSE))
       RETURNING *`,
      [
        req.params.id, exerciseId, next.rows[0].idx,
        weightKg ?? null, reps ?? null, rpe ?? null,
        durationS ?? null, distanceM ?? null, isWarmup ?? null,
      ],
    );
    return inserted.rows[0];
  });

  res.status(201).json(row);
}));

/** DELETE /api/workouts/:id/sets/:setId */
workoutsRouter.delete('/:id/sets/:setId', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM workout_sets ws
      USING workout_sessions s
      WHERE ws.id = $1 AND ws.session_id = s.id
        AND s.id = $2 AND s.user_id = $3`,
    [req.params.setId, req.params.id, userOf(req)],
  );

  if (!rowCount) throw notFound('Série introuvable');
  res.status(204).end();
}));

/**
 * GET /api/workouts/last/:exerciseId — derniere performance connue.
 * Preremplit la saisie sur le terrain : l'utilisateur confirme au lieu
 * de saisir.
 */
workoutsRouter.get('/last/:exerciseId', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ws.weight_kg, ws.reps, ws.rpe, ws.completed_at
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
      WHERE s.user_id = $1 AND ws.exercise_id = $2 AND ws.is_warmup = FALSE
      ORDER BY ws.completed_at DESC
      LIMIT 1`,
    [userOf(req), req.params.exerciseId],
  );

  res.json(rows[0] ?? null);
}));
