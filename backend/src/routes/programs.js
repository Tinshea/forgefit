import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import { buildProgram, suggestLoad, GOAL_PRESETS } from '../services/program-builder.js';
import { matchLift, estimateOneRepMax } from '../services/strength-standards.js';
import { computeRadar } from '../services/radar.js';
import {
  TEMPLATES, TEMPLATE_CATEGORIES, EQUIPMENT_PROFILES, describeTemplate, getTemplate,
} from '../services/templates.js';
import { resolveTemplate } from '../services/template-resolver.js';
import { MOVEMENT_PATTERNS, TIERS, UNRATED_NOTE } from '../services/exercise-evidence.js';
import {
  WEEKDAYS, defaultWeekdays, programWeek, dateRange, isoDate,
} from '../services/scheduling.js';
import { programVolume } from '../services/program-volume.js';

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

    // Répartition sur la semaine : un programme livré sans jours placés
    // ne peut pas apparaître au calendrier, et l'espacement fait partie
    // du dosage.
    const weekdays = defaultWeekdays(days.length);

    for (const day of days) {
      const { rows: [dayRow] } = await client.query(
        `INSERT INTO program_days (program_id, day_index, title, focus, weekday)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [created.id, day.day_index, day.title, day.focus, weekdays[day.day_index - 1] ?? null],
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
            p.rationale, p.created_at, p.origin, p.template_key, p.notes,
            p.starts_on::text AS starts_on,
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

// =====================================================================
// Modèles de programme
//
// Déclarés AVANT `/:id` : « templates » est un segment unique, Express
// le confondrait sinon avec un identifiant de programme.
// =====================================================================

/** GET /api/programs/templates — catalogue des modèles. */
programsRouter.get('/templates', asyncHandler(async (req, res) => {
  const { category } = req.query;

  const selected = category
    ? TEMPLATES.filter((t) => t.category === category)
    : TEMPLATES;

  res.json({
    categories: TEMPLATE_CATEGORIES,
    equipment_profiles: Object.entries(EQUIPMENT_PROFILES).map(([key, p]) => ({
      key, label: p.label, hint: p.hint,
    })),
    tiers: Object.entries(TIERS).map(([key, t]) => ({ key, ...t })),
    items: selected.map(describeTemplate),
  });
}));

/**
 * GET /api/programs/templates/:key — fiche détaillée, exercices résolus.
 *
 * `equipment` permet de prévisualiser le modèle avec un autre matériel
 * que celui pour lequel il a été écrit, avant de l'instancier.
 */
programsRouter.get('/templates/:key', asyncHandler(async (req, res) => {
  const template = getTemplate(req.params.key);
  if (!template) throw notFound(`Modèle inconnu : ${req.params.key}`);

  const equipmentProfile = req.query.equipment ?? template.equipment_profile;
  if (!EQUIPMENT_PROFILES[equipmentProfile]) {
    throw badRequest(
      `Profil de matériel inconnu : ${equipmentProfile}. `
      + `Attendu : ${Object.keys(EQUIPMENT_PROFILES).join(', ')}`,
    );
  }

  const described = describeTemplate(template);
  const resolved = await resolveTemplate(template, { equipmentProfile });

  res.json({
    ...described,
    selected_equipment: equipmentProfile,
    substitutions: resolved.substitutions,
    unresolved: resolved.unresolved,
    days: resolved.days.map((day) => ({
      day_index: day.day_index,
      title: day.title,
      focus: day.focus,
      items: day.items.map(({ slot, exercise, substituted }, i) => ({
        position: i + 1,
        pattern: slot.pattern,
        pattern_label: MOVEMENT_PATTERNS[slot.pattern]?.label ?? slot.pattern,
        target_sets: slot.sets,
        target_reps: slot.reps,
        target_reps_max: slot.reps_max,
        target_seconds: slot.seconds,
        rest_seconds: slot.rest,
        note: slot.note,
        substituted,
        exercise_id: exercise.id,
        name_fr: exercise.name_fr,
        target: exercise.target,
        equipment: exercise.equipment,
        gif_url: exercise.gif_url,
        evidence_tier: exercise.evidence_tier,
        evidence_note: exercise.evidence_note,
        evidence_sources: exercise.evidence_sources,
      })),
    })),
  });
}));

/**
 * POST /api/programs/from-template
 * Corps : { template_key, equipment, name, weeks, activate }
 *
 * Le modèle est COPIÉ, pas référencé : une fois instancié, le programme
 * est modifiable sans que le modèle bouge, et le modèle peut évoluer
 * sans réécrire les programmes déjà en cours.
 */
programsRouter.post('/from-template', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    template_key: templateKey,
    equipment,
    name,
    weeks,
    activate = true,
  } = req.body ?? {};

  const template = getTemplate(templateKey);
  if (!template) {
    throw badRequest(
      `Modèle inconnu : ${templateKey}. `
      + `Attendu : ${TEMPLATES.map((t) => t.key).join(', ')}`,
    );
  }

  const equipmentProfile = equipment ?? template.equipment_profile;
  if (!EQUIPMENT_PROFILES[equipmentProfile]) {
    throw badRequest(`Profil de matériel inconnu : ${equipmentProfile}`);
  }

  const described = describeTemplate(template);
  const resolved = await resolveTemplate(template, { equipmentProfile });
  const oneRepMaxes = await loadOneRepMaxes(userId);
  const preset = GOAL_PRESETS[template.goal] ?? GOAL_PRESETS.equilibre;

  const program = await withTransaction(async (client) => {
    if (activate) await deactivateAll(client, userId);

    // Le raisonnement du modèle est figé à l'instanciation : six semaines
    // plus tard, on doit encore pouvoir lire POURQUOI ces exercices, même
    // si le modèle a changé entre-temps.
    const rationale = {
      source: 'template',
      template_key: template.key,
      template_name: template.name,
      goal: template.goal,
      goal_label: described.goal_label,
      level: template.level,
      equipment_profile: equipmentProfile,
      equipment_label: EQUIPMENT_PROFILES[equipmentProfile].label,
      summary: template.summary,
      method: template.why,
      volume: described.volume,
      sources: described.sources,
      substitutions: resolved.substitutions,
      unresolved: resolved.unresolved,
      warnings: [
        ...described.volume.warnings,
        ...resolved.substitutions.map((x) => `${x.pattern_label} : ${x.reason}`),
        ...resolved.unresolved.map((x) => `${x.pattern_label} : ${x.reason}`),
      ],
      instantiated_at: new Date().toISOString(),
    };

    const { rows: [created] } = await client.query(
      `INSERT INTO programs
         (user_id, name, goal, days_per_week, weeks, rationale, is_active, origin, template_key)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'template',$8)
       RETURNING id, name, goal, days_per_week, weeks, is_active, origin, template_key, created_at`,
      [
        userId,
        name ?? template.name,
        template.goal,
        template.days_per_week,
        weeks ?? template.weeks,
        JSON.stringify(rationale),
        activate,
        template.key,
      ],
    );

    const weekdays = defaultWeekdays(resolved.days.length);

    for (const day of resolved.days) {
      const { rows: [dayRow] } = await client.query(
        `INSERT INTO program_days (program_id, day_index, title, focus, weekday)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [created.id, day.day_index, day.title, day.focus,
          weekdays[day.day_index - 1] ?? null],
      );

      let position = 1;
      for (const { slot, exercise, substituted } of day.items) {
        const isTimed = slot.seconds != null;
        const lift = matchLift(exercise.name_fr);
        const oneRm = lift ? oneRepMaxes.get(lift) : null;
        const axis = MOVEMENT_PATTERNS[slot.pattern]?.axis ?? null;

        await client.query(
          `INSERT INTO program_items
             (program_day_id, exercise_id, position, target_sets, target_reps,
              target_reps_max, target_seconds, suggested_kg, rest_seconds, note,
              axis, rationale)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [
            dayRow.id, exercise.id, position,
            slot.sets, slot.reps, slot.reps_max, slot.seconds,
            isTimed ? null : suggestLoad(oneRm, preset.intensity),
            slot.rest,
            slot.note ?? (isTimed ? null : `${preset.rir[0]}–${preset.rir[1]} reps en réserve`),
            axis,
            JSON.stringify({
              source: 'template',
              template_key: template.key,
              pattern: slot.pattern,
              pattern_label: MOVEMENT_PATTERNS[slot.pattern]?.label ?? slot.pattern,
              evidence_tier: exercise.evidence_tier,
              why_this_one: exercise.evidence_note ?? UNRATED_NOTE,
              substituted,
              load_basis: isTimed
                ? `${slot.seconds} s de tenue, ${slot.sets} séries`
                : (oneRm
                  ? `${Math.round(preset.intensity * 100)} % d’un 1RM estimé à ${Math.round(oneRm)} kg`
                  : 'Aucun 1RM estimé : charge à ajuster pour finir à '
                    + `${preset.rir[0]}–${preset.rir[1]} reps de l’échec`),
              sources: exercise.evidence_sources ?? [],
            }),
          ],
        );
        position += 1;
      }
    }

    return created;
  });

  res.status(201).json(program);
}));

/**
 * GET /api/programs/calendar?from=&to=&tz=
 *
 * Croise le PLAN (ce que le programme prévoit ce jour-là) et le FAIT
 * (les séances réellement enregistrées). Les deux sont nécessaires :
 * un calendrier qui n'affiche que le plan ne dit pas si on l'a suivi,
 * et un historique seul ne dit pas ce qui était prévu.
 *
 * Déclaré avant `/:id` : « calendar » serait sinon pris pour un
 * identifiant de programme.
 */
programsRouter.get('/calendar', asyncHandler(async (req, res) => {
  const userId = userOf(req);

  // Par défaut, la semaine en cours plus les cinq suivantes : de quoi
  // remplir un mois d'affichage sans demander de bornes.
  const today = new Date();
  const from = req.query.from ?? isoDate(new Date(today.getTime() - 14 * 86_400_000));
  const to = req.query.to ?? isoDate(new Date(today.getTime() + 28 * 86_400_000));

  if (![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))) {
    throw badRequest('from et to doivent être des dates au format AAAA-MM-JJ');
  }

  // Le fuseau vient du navigateur. Sans lui, une séance commencée à
  // 00 h 30 à Paris serait datée de la veille : Postgres tronquerait un
  // `timestamptz` en UTC.
  const tz = String(req.query.tz ?? 'UTC');
  if (!/^[\w/+-]{1,64}$/.test(tz)) throw badRequest(`Fuseau horaire invalide : ${tz}`);

  const { rows: [program] } = await query(
    `SELECT id, name, goal, weeks, days_per_week, origin,
            -- Projetée en texte : node-postgres rendrait sinon un objet
            -- Date, qu'un champ <input type="date"> refuse.
            starts_on::text AS starts_on
       FROM programs WHERE user_id = $1 AND is_active LIMIT 1`,
    [userId],
  );

  const plannedDays = program
    ? (await query(
      `SELECT d.id, d.day_index, d.title, d.focus, d.weekday,
              d.start_time::text AS start_time, d.duration_minutes,
              COUNT(i.id)::int AS item_count
         FROM program_days d
         LEFT JOIN program_items i ON i.program_day_id = d.id
        WHERE d.program_id = $1 AND d.weekday IS NOT NULL
        GROUP BY d.id
        ORDER BY d.weekday`,
      [program.id],
    )).rows
    : [];

  const byWeekday = new Map(plannedDays.map((d) => [d.weekday, d]));

  const { rows: sessions } = await query(
    `SELECT s.id, s.title, s.started_at, s.ended_at, s.perceived_exertion,
            s.program_day_id,
            (s.started_at AT TIME ZONE $4)::date AS local_date,
            COUNT(ws.id)::int                       AS set_count,
            COALESCE(SUM(ws.volume_kg), 0)::numeric AS volume_kg,
            COUNT(DISTINCT ws.exercise_id)::int     AS exercise_count
       FROM workout_sessions s
       LEFT JOIN workout_sets ws ON ws.session_id = s.id
      WHERE s.user_id = $1
        AND (s.started_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
      GROUP BY s.id
      ORDER BY s.started_at`,
    [userId, from, to, tz],
  );

  const sessionsByDate = new Map();
  for (const row of sessions) {
    const key = isoDate(row.local_date);
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key).push({ ...row, local_date: key });
  }

  const totalWeeks = program?.weeks ?? 0;
  const days = dateRange(from, to).map(({ date, weekday }) => {
    const planned = byWeekday.get(weekday) ?? null;
    const week = program ? programWeek(date, program.starts_on) : null;
    // Hors cycle : avant le départ du programme, ou après sa dernière
    // semaine. La séance existe toujours, elle n'est simplement plus au
    // programme ce jour-là.
    const inCycle = program ? week >= 1 && week <= totalWeeks : false;
    const daySessions = sessionsByDate.get(date) ?? [];

    return {
      date,
      weekday,
      program_week: program ? week : null,
      in_cycle: inCycle,
      planned: inCycle ? planned : null,
      sessions: daySessions,
      // « Fait » au sens du plan : une séance rattachée à CE jour de
      // programme. Une séance libre le même jour ne coche pas la case —
      // elle n'exécute pas ce qui était prévu.
      completed: planned
        ? daySessions.some((x) => x.program_day_id === planned.id)
        : daySessions.length > 0,
    };
  });

  res.json({
    from,
    to,
    timezone: tz,
    today: isoDate(today),
    weekdays: WEEKDAYS,
    program: program
      ? {
        ...program,
        starts_on: isoDate(program.starts_on),
        ends_on: isoDate(
          new Date(new Date(`${isoDate(program.starts_on)}T00:00:00Z`).getTime()
            + (totalWeeks * 7 - 1) * 86_400_000),
        ),
        unscheduled_days: (await query(
          `SELECT id, day_index, title, start_time::text AS start_time,
                  duration_minutes
             FROM program_days
            WHERE program_id = $1 AND weekday IS NULL ORDER BY day_index`,
          [program.id],
        )).rows,
      }
      : null,
    days,
  });
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
            p.rationale, p.created_at, p.origin, p.template_key, p.notes,
            p.updated_at, p.starts_on::text AS starts_on,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'day_index', d.day_index,
                  'title', d.title,
                  'focus', d.focus,
                  'weekday', d.weekday,
                  'start_time', d.start_time::text,
                  'duration_minutes', d.duration_minutes,
                  'items', (
                    SELECT COALESCE(json_agg(
                      json_build_object(
                        'id', i.id,
                        'position', i.position,
                        'exercise_id', e.id,
                        'name_fr', e.name_fr,
                        'target', e.target,
                        'secondary_muscles', e.secondary_muscles,
                        'equipment', e.equipment,
                        'discipline', e.discipline,
                        'gif_url', e.gif_url,
                        'target_sets', i.target_sets,
                        'target_reps', i.target_reps,
                        'target_reps_max', i.target_reps_max,
                        'target_seconds', i.target_seconds,
                        'movement_pattern', e.movement_pattern,
                        'evidence_tier', e.evidence_tier::text,
                        'evidence_note', e.evidence_note,
                        'evidence_sources', e.evidence_sources,
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
  const program = rows[0] ?? null;
  if (!program) return null;

  // Le volume est CALCULÉ à la lecture, jamais stocké : il doit refléter
  // le programme tel qu'il est maintenant, pas tel qu'il était à sa
  // génération. Un exercice retiré à la main doit faire baisser le
  // chiffre immédiatement.
  return { ...program, muscle_volume: programVolume(program.days ?? []) };
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

// =====================================================================
// Construction et édition manuelles
//
// Le générateur et les modèles produisent un point de départ. À partir
// de là, tout doit être modifiable : c'est le programme de la personne
// qui le suit, pas celui de l'algorithme.
//
// Chaque route vérifie la propriété du programme AVANT d'écrire. Sans
// authentification réelle, `userOf` retombe sur l'utilisateur de
// démonstration — mais la vérification reste en place pour que l'arrivée
// d'une authentification ne demande rien d'autre que de changer `userOf`.
// =====================================================================

/** Désactive le programme courant : l'index unique partiel l'impose. */
const deactivateAll = (client, userId) => client.query(
  'UPDATE programs SET is_active = FALSE WHERE user_id = $1 AND is_active',
  [userId],
);

/** Vérifie que le programme appartient bien au demandeur. */
async function assertOwned(programId, userId, client = null) {
  const exec = client ?? { query };
  const { rows } = await exec.query(
    'SELECT id, is_active FROM programs WHERE id = $1 AND user_id = $2',
    [programId, userId],
  );
  if (!rows.length) throw notFound('Programme introuvable');
  return rows[0];
}

/** Vérifie qu'un jour appartient bien au programme visé. */
async function assertDay(programId, dayId, client = null) {
  const exec = client ?? { query };
  const { rows } = await exec.query(
    'SELECT id, day_index, weekday FROM program_days WHERE id = $1 AND program_id = $2',
    [dayId, programId],
  );
  if (!rows.length) throw notFound('Jour introuvable dans ce programme');
  return rows[0];
}

/**
 * Valide la dose d'une ligne.
 *
 * La contrainte `item_has_dose` du schéma refuse déjà une ligne sans
 * répétitions ni durée — mais une violation de contrainte renvoie un 500
 * illisible. On tranche ici, avec un message qui dit quoi corriger.
 */
function validateDose({ target_reps: reps, target_seconds: seconds, target_reps_max: repsMax }) {
  if (reps == null && seconds == null) {
    throw badRequest(
      'Une ligne doit porter au moins des répétitions (target_reps) ou une durée '
      + '(target_seconds). Un étirement se dose en secondes, une série en répétitions.',
    );
  }
  if (repsMax != null && reps != null && repsMax < reps) {
    throw badRequest(
      `Fourchette de répétitions inversée : ${reps}–${repsMax}. `
      + 'target_reps_max doit être supérieur ou égal à target_reps.',
    );
  }
}

/**
 * POST /api/programs — programme vierge, à remplir à la main.
 * Corps : { name, goal, days_per_week, weeks, notes, activate }
 */
programsRouter.post('/', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    name, goal = 'equilibre', days_per_week: daysPerWeek = 3,
    weeks = 8, notes = null, activate = false,
  } = req.body ?? {};

  if (!GOAL_PRESETS[goal]) {
    throw badRequest(`Objectif inconnu : ${goal}. Attendu : ${Object.keys(GOAL_PRESETS).join(', ')}`);
  }
  if (!(daysPerWeek >= 1 && daysPerWeek <= 7)) {
    throw badRequest('days_per_week doit être compris entre 1 et 7');
  }
  if (!name || !String(name).trim()) {
    throw badRequest('Un nom est requis');
  }

  const program = await withTransaction(async (client) => {
    if (activate) await deactivateAll(client, userId);

    const { rows: [created] } = await client.query(
      `INSERT INTO programs
         (user_id, name, goal, days_per_week, weeks, notes, is_active, origin, rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',$8::jsonb)
       RETURNING id, name, goal, days_per_week, weeks, notes, is_active, origin, created_at`,
      [
        userId, String(name).trim(), goal, daysPerWeek, weeks, notes, activate,
        // Un programme manuel n'a pas de raisonnement calculé : on le dit
        // explicitement plutôt que de laisser un objet vide que
        // l'interface afficherait comme une section « méthode » muette.
        JSON.stringify({
          source: 'manual',
          summary: 'Programme composé à la main.',
          method: [
            'Aucun dosage n’a été calculé : les séries, répétitions et charges sont '
              + 'celles que vous avez saisies.',
            'Le tableau de volume hebdomadaire reste calculé à partir des lignes '
              + 'enregistrées — il dit ce que le programme contient réellement.',
          ],
        }),
      ],
    );
    return created;
  });

  res.status(201).json(program);
}));

/**
 * PATCH /api/programs/:id — nom, objectif, durée, notes, activation.
 *
 * Activer un programme en désactive un autre : l'index unique partiel
 * `uq_programs_active` refuse deux programmes actifs, et il vaut mieux
 * basculer explicitement que renvoyer une violation de contrainte.
 */
programsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    name, goal, weeks, days_per_week: daysPerWeek, notes,
    is_active: isActive, starts_on: startsOn,
  } = req.body ?? {};

  if (startsOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(startsOn))) {
    throw badRequest('starts_on doit être une date au format AAAA-MM-JJ');
  }

  if (goal !== undefined && !GOAL_PRESETS[goal]) {
    throw badRequest(`Objectif inconnu : ${goal}`);
  }
  if (daysPerWeek !== undefined && !(daysPerWeek >= 1 && daysPerWeek <= 7)) {
    throw badRequest('days_per_week doit être compris entre 1 et 7');
  }

  const updated = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);
    if (isActive === true) await deactivateAll(client, userId);

    const { rows } = await client.query(
      `UPDATE programs
          SET name          = COALESCE($3, name),
              goal          = COALESCE($4, goal),
              weeks         = COALESCE($5, weeks),
              days_per_week = COALESCE($6, days_per_week),
              notes         = COALESCE($7, notes),
              is_active     = COALESCE($8, is_active),
              starts_on     = COALESCE($9::date, starts_on),
              updated_at    = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, name, goal, days_per_week, weeks, notes, is_active, origin,
                  starts_on::text AS starts_on, updated_at`,
      [
        req.params.id, userId,
        name ?? null, goal ?? null, weeks ?? null,
        daysPerWeek ?? null, notes ?? null,
        isActive ?? null, startsOn ?? null,
      ],
    );
    return rows[0];
  });

  res.json(updated);
}));

/**
 * POST /api/programs/:id/duplicate — copie modifiable.
 *
 * Le cas d'usage central : partir d'un modèle ou d'un programme généré,
 * puis l'adapter sans perdre l'original.
 */
programsRouter.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const { name, activate = false } = req.body ?? {};

  const copy = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);
    if (activate) await deactivateAll(client, userId);

    const { rows: [created] } = await client.query(
      `INSERT INTO programs
         (user_id, name, goal, days_per_week, weeks, notes, rationale,
          is_active, origin, template_key)
       SELECT user_id,
              COALESCE($3, name || ' (copie)'),
              goal, days_per_week, weeks, notes, rationale,
              $4,
              -- La copie devient manuelle : elle n'est plus le reflet du
              -- générateur ni du modèle dès lors qu'elle est modifiable.
              'manual',
              template_key
         FROM programs WHERE id = $1 AND user_id = $2
       RETURNING id, name, goal, days_per_week, weeks, is_active, origin, created_at`,
      [req.params.id, userId, name ?? null, activate],
    );

    // Les jours et les lignes sont copiés en deux requêtes ensemblistes
    // plutôt qu'en boucle : une trentaine d'allers-retours pour un
    // programme à six jours n'apporterait rien.
    await client.query(
      `WITH src AS (
         SELECT id, day_index, title, focus FROM program_days WHERE program_id = $1
       ), ins AS (
         INSERT INTO program_days (program_id, day_index, title, focus)
         SELECT $2, day_index, title, focus FROM src
         RETURNING id, day_index
       )
       INSERT INTO program_items
         (program_day_id, exercise_id, position, target_sets, target_reps,
          target_reps_max, target_seconds, suggested_kg, rest_seconds, note, axis, rationale)
       SELECT ins.id, i.exercise_id, i.position, i.target_sets, i.target_reps,
              i.target_reps_max, i.target_seconds, i.suggested_kg, i.rest_seconds,
              i.note, i.axis, i.rationale
         FROM src
         JOIN ins  ON ins.day_index = src.day_index
         JOIN program_items i ON i.program_day_id = src.id`,
      [req.params.id, created.id],
    );

    return created;
  });

  res.status(201).json(copy);
}));

/** POST /api/programs/:id/days — ajoute une séance. */
programsRouter.post('/:id/days', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const { title, focus = null, day_index: dayIndex, weekday = null } = req.body ?? {};

  if (!title || !String(title).trim()) throw badRequest('Un titre de séance est requis');
  if (weekday != null && !(weekday >= 1 && weekday <= 7)) {
    throw badRequest('weekday doit être compris entre 1 (lundi) et 7 (dimanche)');
  }

  const day = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);

    // Sans indice fourni, on prend le premier libre : `day_index` est
    // unique par programme et borné à 7, une simple incrémentation du
    // maximum laisserait des trous impossibles à combler.
    const { rows: [slot] } = await client.query(
      `SELECT g.i AS free_index
         FROM generate_series(1, 7) AS g(i)
        WHERE NOT EXISTS (
          SELECT 1 FROM program_days d WHERE d.program_id = $1 AND d.day_index = g.i
        )
        ORDER BY g.i LIMIT 1`,
      [req.params.id],
    );

    const index = dayIndex ?? slot?.free_index;
    if (!index) throw badRequest('Ce programme compte déjà sept séances : la semaine est pleine.');

    // Sans jour imposé, on prend le premier jour de semaine libre : une
    // séance sans `weekday` n'apparaîtrait pas au calendrier.
    const { rows: [free] } = await client.query(
      `SELECT g.i AS free_weekday
         FROM generate_series(1, 7) AS g(i)
        WHERE NOT EXISTS (
          SELECT 1 FROM program_days d WHERE d.program_id = $1 AND d.weekday = g.i
        )
        ORDER BY g.i LIMIT 1`,
      [req.params.id],
    );

    const { rows } = await client.query(
      `INSERT INTO program_days (program_id, day_index, title, focus, weekday)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, day_index, title, focus, weekday`,
      [req.params.id, index, String(title).trim(), focus,
        weekday ?? free?.free_weekday ?? null],
    );
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);
    return rows[0];
  });

  res.status(201).json(day);
}));

/** PATCH /api/programs/:id/days/:dayId — titre, focus, ordre dans la semaine. */
programsRouter.patch('/:id/days/:dayId', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const {
    title, focus, day_index: dayIndex, weekday,
    start_time: startTime, duration_minutes: durationMinutes,
  } = req.body ?? {};

  if (weekday != null && !(weekday >= 1 && weekday <= 7)) {
    throw badRequest('weekday doit être compris entre 1 (lundi) et 7 (dimanche)');
  }
  if (startTime != null && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(startTime))) {
    throw badRequest('start_time doit être une heure au format HH:MM');
  }
  if (durationMinutes != null && !(durationMinutes >= 5 && durationMinutes <= 360)) {
    throw badRequest('duration_minutes doit être compris entre 5 et 360');
  }

  const day = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);
    const current = await assertDay(req.params.id, req.params.dayId, client);

    // Déplacer une séance sur un jour déjà pris ÉCHANGE les deux : c'est
    // ce qu'un déplacement laisse attendre, et l'index unique refuserait
    // sinon l'écriture.
    //
    // L'échange passe par NULL. Donner d'abord son ancien jour à l'autre
    // séance ferait cohabiter deux lignes sur la même valeur le temps
    // d'une requête — et l'index, qui n'est pas différé, la rejetterait.
    if (weekday != null && weekday !== current.weekday) {
      await client.query(
        'UPDATE program_days SET weekday = NULL WHERE id = $1',
        [req.params.dayId],
      );
      await client.query(
        `UPDATE program_days SET weekday = $3::smallint
          WHERE program_id = $2 AND weekday = $4 AND id <> $1`,
        [req.params.dayId, req.params.id, current.weekday, weekday],
      );
    }

    const { rows } = await client.query(
      `UPDATE program_days
          SET title     = COALESCE($3, title),
              focus     = COALESCE($4, focus),
              day_index = COALESCE($5, day_index),
              weekday   = COALESCE($6::smallint, weekday),
              start_time = COALESCE($7::time, start_time),
              duration_minutes = COALESCE($8::smallint, duration_minutes)
        WHERE id = $1 AND program_id = $2
        RETURNING id, day_index, title, focus, weekday,
                  start_time::text AS start_time, duration_minutes`,
      [req.params.dayId, req.params.id, title ?? null, focus ?? null,
        dayIndex ?? null, weekday ?? null, startTime ?? null, durationMinutes ?? null],
    );
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);
    return rows[0];
  });

  res.json(day);
}));

/** DELETE /api/programs/:id/days/:dayId */
programsRouter.delete('/:id/days/:dayId', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);
    await assertDay(req.params.id, req.params.dayId, client);
    // Les lignes partent en cascade (ON DELETE CASCADE), et les séances
    // déjà réalisées qui pointaient ce jour passent simplement à NULL :
    // supprimer un jour de programme ne doit pas effacer un entraînement.
    await client.query('DELETE FROM program_days WHERE id = $1', [req.params.dayId]);
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);
  });
  res.status(204).end();
}));

/** POST /api/programs/:id/days/:dayId/items — ajoute un exercice. */
programsRouter.post('/:id/days/:dayId/items', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const body = req.body ?? {};
  const {
    exercise_id: exerciseId,
    target_sets: targetSets = 3,
    target_reps: targetReps = null,
    target_reps_max: targetRepsMax = null,
    target_seconds: targetSeconds = null,
    suggested_kg: suggestedKg = null,
    rest_seconds: restSeconds = 120,
    note = null,
  } = body;

  if (!exerciseId) throw badRequest('exercise_id est requis');
  if (!(targetSets > 0)) throw badRequest('target_sets doit être strictement positif');
  validateDose(body);

  const item = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);
    await assertDay(req.params.id, req.params.dayId, client);

    // L'axe et le patron viennent de l'exercice : les redemander à
    // l'appelant ouvrirait la porte à un programme dont les lignes
    // contredisent le catalogue.
    const { rows: [exercise] } = await client.query(
      `SELECT id, axis, movement_pattern, evidence_tier::text AS evidence_tier,
              evidence_note, evidence_sources
         FROM exercises WHERE id = $1`,
      [exerciseId],
    );
    if (!exercise) throw badRequest(`Exercice introuvable : ${exerciseId}`);

    const { rows: [{ next_position: position }] } = await client.query(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
         FROM program_items WHERE program_day_id = $1`,
      [req.params.dayId],
    );

    const { rows } = await client.query(
      `INSERT INTO program_items
         (program_day_id, exercise_id, position, target_sets, target_reps,
          target_reps_max, target_seconds, suggested_kg, rest_seconds, note, axis, rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       RETURNING id, position, target_sets, target_reps, target_reps_max,
                 target_seconds, suggested_kg, rest_seconds, note, axis`,
      [
        req.params.dayId, exerciseId, position, targetSets, targetReps,
        targetRepsMax, targetSeconds, suggestedKg, restSeconds, note,
        exercise.axis,
        JSON.stringify({
          source: 'manual',
          pattern: exercise.movement_pattern,
          pattern_label: MOVEMENT_PATTERNS[exercise.movement_pattern]?.label ?? null,
          evidence_tier: exercise.evidence_tier,
          why_this_one: exercise.evidence_note ?? UNRATED_NOTE,
          why_here: 'Ajouté à la main.',
          sources: exercise.evidence_sources ?? [],
        }),
      ],
    );
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);
    return rows[0];
  });

  res.status(201).json(item);
}));

/** PATCH /api/programs/:id/items/:itemId — séries, répétitions, charge, repos. */
programsRouter.patch('/:id/items/:itemId', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const body = req.body ?? {};

  const item = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);

    const { rows: [current] } = await client.query(
      `SELECT i.id, i.target_reps, i.target_reps_max, i.target_seconds
         FROM program_items i
         JOIN program_days d ON d.id = i.program_day_id
        WHERE i.id = $1 AND d.program_id = $2`,
      [req.params.itemId, req.params.id],
    );
    if (!current) throw notFound('Ligne introuvable dans ce programme');

    // La dose se valide sur l'état RÉSULTANT, pas sur le corps de la
    // requête : effacer les répétitions d'une ligne qui n'a pas de durée
    // la rendrait invalide, et la contrainte du schéma la refuserait
    // avec un message incompréhensible.
    const merged = {
      target_reps: body.target_reps !== undefined ? body.target_reps : current.target_reps,
      target_reps_max: body.target_reps_max !== undefined
        ? body.target_reps_max : current.target_reps_max,
      target_seconds: body.target_seconds !== undefined
        ? body.target_seconds : current.target_seconds,
    };
    validateDose(merged);

    if (body.target_sets !== undefined && !(body.target_sets > 0)) {
      throw badRequest('target_sets doit être strictement positif');
    }

    const { rows } = await client.query(
      `UPDATE program_items
          SET target_sets     = COALESCE($2, target_sets),
              target_reps     = $3,
              target_reps_max = $4,
              target_seconds  = $5,
              suggested_kg    = COALESCE($6, suggested_kg),
              rest_seconds    = COALESCE($7, rest_seconds),
              note            = COALESCE($8, note)
        WHERE id = $1
        RETURNING id, position, target_sets, target_reps, target_reps_max,
                  target_seconds, suggested_kg, rest_seconds, note, axis`,
      [
        req.params.itemId,
        body.target_sets ?? null,
        merged.target_reps, merged.target_reps_max, merged.target_seconds,
        body.suggested_kg ?? null, body.rest_seconds ?? null, body.note ?? null,
      ],
    );
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);
    return rows[0];
  });

  res.json(item);
}));

/** DELETE /api/programs/:id/items/:itemId */
programsRouter.delete('/:id/items/:itemId', asyncHandler(async (req, res) => {
  const userId = userOf(req);

  await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);

    const { rowCount } = await client.query(
      `DELETE FROM program_items i
         USING program_days d
        WHERE i.id = $1 AND d.id = i.program_day_id AND d.program_id = $2`,
      [req.params.itemId, req.params.id],
    );
    if (!rowCount) throw notFound('Ligne introuvable dans ce programme');
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);
  });

  res.status(204).end();
}));

/**
 * PUT /api/programs/:id/days/:dayId/order — réordonne les lignes.
 * Corps : { item_ids: [...] } dans l'ordre voulu.
 *
 * Les positions sont uniques par jour : permuter deux lignes par
 * écriture directe passerait forcément par un état où deux d'entre elles
 * partagent la même position. On passe donc par des positions négatives,
 * qui ne peuvent entrer en collision avec aucune position valide.
 */
programsRouter.put('/:id/days/:dayId/order', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const { item_ids: itemIds } = req.body ?? {};

  if (!Array.isArray(itemIds) || !itemIds.length) {
    throw badRequest('item_ids doit être un tableau non vide d’identifiants de lignes');
  }

  const items = await withTransaction(async (client) => {
    await assertOwned(req.params.id, userId, client);
    await assertDay(req.params.id, req.params.dayId, client);

    const { rows: existing } = await client.query(
      'SELECT id FROM program_items WHERE program_day_id = $1',
      [req.params.dayId],
    );
    const known = new Set(existing.map((r) => r.id));

    if (itemIds.length !== known.size || itemIds.some((id) => !known.has(id))) {
      throw badRequest(
        `item_ids doit contenir exactement les ${known.size} ligne(s) de cette séance, `
        + 'une seule fois chacune.',
      );
    }

    await client.query(
      'UPDATE program_items SET position = -position WHERE program_day_id = $1',
      [req.params.dayId],
    );
    await client.query(
      `UPDATE program_items i
          SET position = v.ord
         FROM (SELECT * FROM unnest($2::uuid[]) WITH ORDINALITY AS t(id, ord)) v
        WHERE i.id = v.id AND i.program_day_id = $1`,
      [req.params.dayId, itemIds],
    );
    await client.query('UPDATE programs SET updated_at = now() WHERE id = $1', [req.params.id]);

    const { rows } = await client.query(
      'SELECT id, position FROM program_items WHERE program_day_id = $1 ORDER BY position',
      [req.params.dayId],
    );
    return rows;
  });

  res.json({ items });
}));
