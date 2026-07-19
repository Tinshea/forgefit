import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import { buildProgram, suggestLoad, GOAL_PRESETS } from '../services/program-builder.js';
import { matchLift, estimateOneRepMax } from '../services/strength-standards.js';
import { computeRadar } from '../services/radar.js';

export const programsRouter = Router();


/**
 * Sélectionne des exercices pour un axe.
 *
 * Deux exigences qui se contredisent :
 *  - couvrir des muscles DIFFÉRENTS (ne pas empiler trois variantes de
 *    biceps dans une même séance) ;
 *  - remplir la séance même quand l'axe compte peu de muscles cibles
 *    (la poussée n'en a que quatre : pectoraux, deltoïdes, triceps,
 *    dentelé).
 *
 * D'où le classement par `ROW_NUMBER() OVER (PARTITION BY target)` : on
 * prend d'abord le meilleur mouvement de chaque muscle, puis le
 * deuxième de chaque muscle, et ainsi de suite. La séance se remplit
 * sans jamais concentrer le volume sur un seul muscle.
 *
 * Le classement interne privilégie les mouvements FONDAMENTAUX : ce sont
 * ceux qui rapportent le plus, et les seuls pour lesquels on sait
 * proposer une charge (ils ont un standard de force).
 */
const FUNDAMENTAL_PATTERN =
  '(developpe couche|developpe militaire|developpe vertical|squat|souleve de terre'
  + '|rowing|traction|dips|tirage vertical|presse a cuisses|hip thrust|fente'
  + '|curl|extension|elevation|pompe)';

async function pickExercises(axis, count) {
  const { rows } = await query(
    `WITH ranked AS (
       SELECT id, name_fr, target, equipment, discipline, gif_url,
              CASE WHEN immutable_unaccent(lower(name_fr)) ~ $3 THEN 0 ELSE 1 END AS is_basic,
              CASE equipment
                WHEN 'barbell' THEN 1 WHEN 'dumbbell' THEN 2
                WHEN 'body weight' THEN 3 WHEN 'cable' THEN 4
                ELSE 5
              END AS equip_rank,
              ROW_NUMBER() OVER (
                PARTITION BY target
                ORDER BY
                  CASE WHEN immutable_unaccent(lower(name_fr)) ~ $3 THEN 0 ELSE 1 END,
                  CASE equipment
                    WHEN 'barbell' THEN 1 WHEN 'dumbbell' THEN 2
                    WHEN 'body weight' THEN 3 WHEN 'cable' THEN 4
                    ELSE 5
                  END,
                  length(name_fr)
              ) AS rank_in_target
         FROM exercises
        WHERE axis = $1
          AND ($1 IN ('mobility','flexibility')
               OR equipment IN ('barbell','dumbbell','cable','body weight',
                                'leverage machine','kettlebell','ez barbell'))
     )
     SELECT id, name_fr, target, equipment, discipline, gif_url
       FROM ranked
      -- Un muscle différent d'abord, puis on revient pour un second
      -- mouvement sur les mêmes muscles si la séance n'est pas remplie.
      ORDER BY rank_in_target, is_basic, equip_rank, length(name_fr)
      LIMIT $2`,
    [axis, count, FUNDAMENTAL_PATTERN],
  );
  return rows;
}

/** Dernier 1RM estimé par mouvement de référence, pour doser les charges. */
async function loadOneRepMaxes(userId) {
  const { rows } = await query(
    `SELECT e.name_fr, ws.weight_kg, ws.reps
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
       JOIN exercises e        ON e.id = ws.exercise_id
      WHERE s.user_id = $1 AND ws.is_warmup = FALSE
        AND ws.weight_kg > 0 AND ws.reps > 0
        AND ws.completed_at > now() - INTERVAL '90 days'`,
    [userId],
  );

  const best = new Map();
  for (const r of rows) {
    const lift = matchLift(r.name_fr);
    if (!lift) continue;
    const oneRm = estimateOneRepMax(Number(r.weight_kg), Number(r.reps));
    if (oneRm && oneRm > (best.get(lift) ?? 0)) best.set(lift, oneRm);
  }
  return best;
}

/**
 * POST /api/programs/generate
 * Corps : { days_per_week, goal, weeks, name }
 */
programsRouter.post('/generate', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    days_per_week: daysPerWeek = 4,
    goal = 'equilibre',
    weeks = 4,
    name,
  } = req.body ?? {};

  if (!GOAL_PRESETS[goal]) {
    throw badRequest(`Objectif inconnu : ${goal}. Attendu : ${Object.keys(GOAL_PRESETS).join(', ')}`);
  }
  if (daysPerWeek < 2 || daysPerWeek > 6) {
    throw badRequest('days_per_week doit être compris entre 2 et 6');
  }

  // Scores actuels : le programme découle du radar. `internal_scores`
  // distingue mobilité et souplesse et expose le gainage, ce que la
  // branche fusionnée du radar ne permet pas.
  const radar = await computeRadar(userId, 90);
  const scores = radar.internal_scores;

  const { days, preset, rationale } = buildProgram({ daysPerWeek, goal, scores });
  const oneRepMaxes = await loadOneRepMaxes(userId);

  const program = await withTransaction(async (client) => {
    // Un seul programme actif : l'index unique partiel l'impose, on
    // désactive donc l'ancien avant d'insérer.
    await client.query(
      'UPDATE programs SET is_active = FALSE WHERE user_id = $1 AND is_active',
      [userId],
    );

    const { rows: [created] } = await client.query(
      `INSERT INTO programs (user_id, name, goal, days_per_week, weeks, rationale)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id, name, goal, days_per_week, weeks, rationale, created_at`,
      [
        userId,
        name ?? `${preset.label} · ${daysPerWeek} j/sem`,
        goal, daysPerWeek, weeks, JSON.stringify(rationale),
      ],
    );

    for (const day of days) {
      const { rows: [dayRow] } = await client.query(
        `INSERT INTO program_days (program_id, day_index, title, focus)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [created.id, day.day_index, day.title, day.focus],
      );

      let position = 1;
      for (const slot of day.slots) {
        const picks = await pickExercises(slot.axis, slot.count);
        for (const ex of picks) {
          // Le caractère chronométré vient du PLAN (l'axe), pas de la
          // discipline de l'exercice : un axe mobilité impose du temps
          // de tenue même si l'exercice choisi est classé autrement.
          const isTimed = slot.seconds != null;
          const lift = matchLift(ex.name_fr);
          const oneRm = lift ? oneRepMaxes.get(lift) : null;

          await client.query(
            `INSERT INTO program_items
               (program_day_id, exercise_id, position, target_sets, target_reps,
                target_seconds, suggested_kg, rest_seconds, note, axis, rationale)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
            [
              dayRow.id, ex.id, position,
              slot.sets,
              slot.reps,
              slot.seconds,
              isTimed ? null : suggestLoad(oneRm, slot.intensity),
              slot.rest,
              isTimed
                ? null
                : `${slot.rir[0]}–${slot.rir[1]} reps en réserve`,
              slot.axis,
              JSON.stringify({
                axis: slot.axis,
                axis_score: slot.plan.score,
                // Le dosage se justifie en volume hebdomadaire, pas en
                // nombre d'exercices : c'est l'unité de la dose-réponse.
                weekly_sets: slot.plan.weekly_sets,
                actual_weekly_sets: slot.plan.actual_weekly_sets,
                sessions_per_week: slot.plan.sessions_per_week,
                allocation: slot.plan.label,
                why_here: `${slot.plan.note} — ${slot.plan.actual_weekly_sets} séries/semaine `
                  + `réparties sur ${slot.plan.sessions_per_week} séance(s)`,
                why_this_one: `Mouvement ${ex.equipment ?? 'libre'} ciblant ${ex.target}`,
                load_basis: isTimed
                  ? `${slot.seconds} s de tenue, ${slot.sets} séries`
                  : (oneRm
                    ? `${Math.round(slot.intensity * 100)} % d’un 1RM estimé à ${Math.round(oneRm)} kg`
                    : 'Aucun 1RM estimé : charge à ajuster pour finir à '
                      + `${slot.rir[0]}–${slot.rir[1]} reps de l’échec`),
              }),
            ],
          );
          position += 1;
        }
      }
    }

    return created;
  });

  res.status(201).json(program);
}));

/** GET /api/programs — liste. */
programsRouter.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.name, p.goal, p.days_per_week, p.weeks, p.is_active,
            p.rationale, p.created_at,
            COUNT(DISTINCT d.id)::int AS day_count,
            COUNT(i.id)::int          AS item_count
       FROM programs p
       LEFT JOIN program_days  d ON d.program_id = p.id
       LEFT JOIN program_items i ON i.program_day_id = d.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.is_active DESC, p.created_at DESC`,
    [userOf(req)],
  );
  res.json({ items: rows });
}));

/** GET /api/programs/active — le programme en cours, détaillé. */
programsRouter.get('/active', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id FROM programs WHERE user_id = $1 AND is_active LIMIT 1',
    [userOf(req)],
  );
  if (!rows.length) return res.json(null);
  return res.json(await loadProgram(rows[0].id, userOf(req)));
}));

/** GET /api/programs/:id — détail complet. */
programsRouter.get('/:id', asyncHandler(async (req, res) => {
  const program = await loadProgram(req.params.id, userOf(req));
  if (!program) throw notFound('Programme introuvable');
  res.json(program);
}));

async function loadProgram(id, userId) {
  const { rows } = await query(
    `SELECT p.id, p.name, p.goal, p.days_per_week, p.weeks, p.is_active,
            p.rationale, p.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'day_index', d.day_index,
                  'title', d.title,
                  'focus', d.focus,
                  'items', (
                    SELECT COALESCE(json_agg(
                      json_build_object(
                        'id', i.id,
                        'position', i.position,
                        'exercise_id', e.id,
                        'name_fr', e.name_fr,
                        'target', e.target,
                        'equipment', e.equipment,
                        'discipline', e.discipline,
                        'gif_url', e.gif_url,
                        'target_sets', i.target_sets,
                        'target_reps', i.target_reps,
                        'target_seconds', i.target_seconds,
                        'suggested_kg', i.suggested_kg,
                        'rest_seconds', i.rest_seconds,
                        'note', i.note,
                        'axis', i.axis,
                        'rationale', i.rationale
                      ) ORDER BY i.position
                    ), '[]'::json)
                    FROM program_items i
                    JOIN exercises e ON e.id = i.exercise_id
                    WHERE i.program_day_id = d.id
                  )
                ) ORDER BY d.day_index
              ) FILTER (WHERE d.id IS NOT NULL),
              '[]'::json
            ) AS days
       FROM programs p
       LEFT JOIN program_days d ON d.program_id = p.id
      WHERE p.id = $1 AND p.user_id = $2
      GROUP BY p.id`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/** DELETE /api/programs/:id */
programsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM programs WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Programme introuvable');
  res.status(204).end();
}));
