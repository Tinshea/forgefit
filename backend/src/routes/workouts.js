import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import { SPORTS, getSport } from '../services/sports.js';
import { sessionLoad, describeSessionLoad } from '../services/session-load.js';

export const workoutsRouter = Router();

/**
 * Colonnes de séance renvoyées partout.
 *
 * La durée et la charge sont calculées EN BASE : les recalculer dans
 * chaque route ferait diverger l'historique, le calendrier et le bilan
 * de charge à la première correction d'arrondi.
 */
const SESSION_METRICS = `
  s.sport_key, s.distance_m, s.elevation_m, s.rounds, s.ascents,
  CASE WHEN s.ended_at IS NOT NULL
       THEN ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0)::int
  END AS duration_min
`;

/** Valide et normalise les champs propres au sport pratiqué. */
function readSportFields(body = {}) {
  const {
    sport_key: sportKey, distance_m: distanceM, elevation_m: elevationM,
    rounds, ascents,
  } = body;

  if (sportKey != null && sportKey !== '' && !SPORTS[sportKey]) {
    throw badRequest(`Sport inconnu : ${sportKey}`);
  }

  const num = (v, name, { min = 0, max = Infinity } = {}) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) throw badRequest(`${name} doit être un nombre`);
    if (n < min || n > max) {
      throw badRequest(`${name} doit être compris entre ${min} et ${max}`);
    }
    return n;
  };

  return {
    sportKey: sportKey === '' ? null : (sportKey ?? null),
    distanceM: num(distanceM, 'distance_m', { max: 1_000_000 }),
    // Le dénivelé négatif est légitime : une descente n'est pas une
    // faute de saisie.
    elevationM: num(elevationM, 'elevation_m', { min: -10_000, max: 30_000 }),
    rounds: num(rounds, 'rounds', { max: 200 }),
    ascents: num(ascents, 'ascents', { max: 500 }),
  };
}

/** Enrichit une ligne de séance : sport, charge de Foster, lecture. */
export function decorateSession(row) {
  if (!row) return row;
  const sport = row.sport_key ? getSport(row.sport_key) : null;
  const minutes = row.duration_min ?? null;
  const load = sessionLoad({ rpe: row.perceived_exertion, minutes });

  return {
    ...row,
    sport: sport
      ? {
        key: sport.key,
        label: sport.label,
        category: sport.category,
        category_label: sport.category_meta?.label ?? null,
        icon: sport.category_meta?.icon ?? null,
      }
      : null,
    duration_min: minutes,
    // Null tant que la séance n'est pas close ou que le RPE manque : un
    // zéro laisserait croire à une séance sans effort.
    session_load: load,
    load_label: load ? describeSessionLoad(load)?.label : null,
  };
}


/** GET /api/workouts — sessions recentes avec resume. */
workoutsRouter.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { rows } = await query(
    `SELECT s.id, s.title, s.started_at, s.ended_at, s.notes,
            s.perceived_exertion, s.program_day_id,
            ${SESSION_METRICS},
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

  res.json({ items: rows.map(decorateSession) });
}));

/**
 * POST /api/workouts — ouvre une seance.
 *
 * `program_day_id` rattache la seance au jour de programme qu'elle
 * execute. C'est ce lien qui permet au calendrier de dire si le plan a
 * ete suivi, et au mode Terrain de guider la seance.
 */
workoutsRouter.post('/', asyncHandler(async (req, res) => {
  const {
    title, notes, started_at: startedAt, program_day_id: programDayId,
    perceived_exertion: rpe,
    // Une séance de sport se saisit APRÈS coup : on ne sort pas son
    // téléphone entre deux rounds ni au milieu d'un match. La créer
    // déjà close évite un aller-retour et, surtout, évite de laisser
    // une séance ouverte si la seconde requête échoue.
    ended_at: endedAt,
  } = req.body ?? {};

  if (endedAt && startedAt && new Date(endedAt) < new Date(startedAt)) {
    throw badRequest('La fin de séance ne peut pas précéder son début');
  }

  const fields = readSportFields(req.body ?? {});
  const userId = userOf(req);
  let resolvedTitle = title ?? null;

  // Un sport nommé fournit le titre par défaut : « Escalade en voie »
  // en dit plus que « Séance du 21/09 » trois mois plus tard.
  if (!resolvedTitle && fields.sportKey) {
    resolvedTitle = SPORTS[fields.sportKey].label;
  }

  if (programDayId) {
    // Le jour doit appartenir a un programme de CET utilisateur : sans
    // cette verification, n'importe quel identifiant rattacherait une
    // seance au programme d'un autre.
    const { rows } = await query(
      `SELECT d.id, d.title
         FROM program_days d
         JOIN programs p ON p.id = d.program_id
        WHERE d.id = $1 AND p.user_id = $2`,
      [programDayId, userId],
    );
    if (!rows.length) throw badRequest('Jour de programme introuvable');
    // Le titre du jour de programme vaut mieux qu'une date : on sait ce
    // qu'on a fait en relisant l'historique.
    resolvedTitle = resolvedTitle ?? rows[0].title;
  }

  const { rows } = await query(
    `INSERT INTO workout_sessions
       (user_id, title, notes, started_at, program_day_id,
        sport_key, distance_m, elevation_m, rounds, ascents, perceived_exertion,
        ended_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5,
             $6, $7, $8, $9, $10, $11::smallint, $12::timestamptz)
     RETURNING id, title, started_at, ended_at, notes, program_day_id,
               perceived_exertion, sport_key, distance_m, elevation_m,
               rounds, ascents,
               CASE WHEN ended_at IS NOT NULL
                    THEN ROUND(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60.0)::int
               END AS duration_min`,
    [
      userId, resolvedTitle, notes ?? null, startedAt ?? null, programDayId ?? null,
      fields.sportKey, fields.distanceM, fields.elevationM,
      fields.rounds, fields.ascents, rpe ?? null, endedAt ?? null,
    ],
  );

  res.status(201).json(decorateSession(rows[0]));
}));

/**
 * GET /api/workouts/open — la seance en cours, s'il y en a une.
 *
 * Le mode Terrain vit sur un telephone : l'onglet se ferme, l'ecran se
 * verrouille, l'application est dechargee entre deux series. Sans cette
 * route, revenir sur la page ouvrirait une SECONDE seance et couperait
 * l'historique en deux.
 *
 * Declaree avant `/:id`, qui capturerait sinon « open ».
 */
workoutsRouter.get('/open', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id FROM workout_sessions
      WHERE user_id = $1 AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [userOf(req)],
  );
  if (!rows.length) return res.json(null);
  return res.json(await loadSession(rows[0].id, userOf(req)));
}));

/** GET /api/workouts/:id — seance detaillee. */
workoutsRouter.get('/:id', asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id, userOf(req));
  if (!session) throw notFound('Séance introuvable');
  res.json(session);
}));

/** Seance complete : series enregistrees + plan du jour de programme. */
async function loadSession(id, userId) {
  const { rows } = await query(
    `SELECT s.*,
            CASE WHEN s.ended_at IS NOT NULL
                 THEN ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0)::int
            END AS duration_min,
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
    [id, userId],
  );

  if (!rows.length) return null;

  // Le plan du jour, quand la seance en execute un. Sans lui, le mode
  // Terrain ne peut ni preremplir les cibles ni dire ce qu'il reste a
  // faire : il faudrait garder son programme ouvert a cote.
  const plan = await loadDayPlan(rows[0].program_day_id);
  return { ...decorateSession(rows[0]), plan };
}

/**
 * Plan d'un jour de programme, avec le materiel d'affichage.
 *
 * Renvoie `null` pour une seance libre : c'est un cas normal, pas une
 * erreur — on peut s'entrainer sans programme.
 */
async function loadDayPlan(programDayId) {
  if (!programDayId) return null;

  const { rows } = await query(
    `SELECT d.id, d.title, d.focus, d.weekday, d.day_index,
            p.id AS program_id, p.name AS program_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', i.id,
                  'position', i.position,
                  'exercise_id', e.id,
                  'name_fr', e.name_fr,
                  'gif_url', e.gif_url,
                  'image_url', e.image_url,
                  'target', e.target,
                  'discipline', e.discipline,
                  'equipment', e.equipment,
                  'evidence_tier', e.evidence_tier::text,
                  'movement_pattern', e.movement_pattern,
                  'target_sets', i.target_sets,
                  'target_reps', i.target_reps,
                  'target_reps_max', i.target_reps_max,
                  'target_seconds', i.target_seconds,
                  'suggested_kg', i.suggested_kg,
                  'rest_seconds', i.rest_seconds,
                  'note', i.note,
                  'rationale', i.rationale
                ) ORDER BY i.position
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) AS items
       FROM program_days d
       JOIN programs p            ON p.id = d.program_id
       LEFT JOIN program_items i  ON i.program_day_id = d.id
       LEFT JOIN exercises e      ON e.id = i.exercise_id
      WHERE d.id = $1
      GROUP BY d.id, p.id`,
    [programDayId],
  );

  return rows[0] ?? null;
}

/** PATCH /api/workouts/:id — cloture / annotation. */
workoutsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { ended_at: endedAt, notes, perceived_exertion: rpe, title } = req.body ?? {};
  const fields = readSportFields(req.body ?? {});

  const { rows } = await query(
    `UPDATE workout_sessions AS s
        SET ended_at           = COALESCE($3::timestamptz, s.ended_at),
            notes              = COALESCE($4, s.notes),
            perceived_exertion = COALESCE($5::smallint, s.perceived_exertion),
            title              = COALESCE($6, s.title),
            sport_key          = COALESCE($7, s.sport_key),
            distance_m         = COALESCE($8, s.distance_m),
            elevation_m        = COALESCE($9, s.elevation_m),
            rounds             = COALESCE($10, s.rounds),
            ascents            = COALESCE($11, s.ascents)
      WHERE s.id = $1 AND s.user_id = $2
      RETURNING s.*,
                CASE WHEN s.ended_at IS NOT NULL
                     THEN ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0)::int
                END AS duration_min`,
    [
      req.params.id, userOf(req), endedAt ?? null, notes ?? null,
      rpe ?? null, title ?? null,
      fields.sportKey, fields.distanceM, fields.elevationM,
      fields.rounds, fields.ascents,
    ],
  );

  if (!rows.length) throw notFound('Séance introuvable');
  res.json(decorateSession(rows[0]));
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

/**
 * DELETE /api/workouts/:id — supprime une seance entiere.
 *
 * Une seance ouverte par erreur apparait au calendrier et fausse les
 * statistiques ; il faut pouvoir la retirer. Les series partent en
 * cascade, et `program_day_id` n'etant qu'une reference, le programme
 * n'est pas touche.
 */
workoutsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Séance introuvable');
  res.status(204).end();
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
