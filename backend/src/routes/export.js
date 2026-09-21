import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest, userOf } from '../lib/http.js';

export const exportRouter = Router();

/**
 * Export des données.
 *
 * Tout vit dans un Postgres qu'on héberge soi-même, ce qui ne suffit
 * pas : des données qu'on ne peut pas SORTIR sont des données captives,
 * et le seul moyen de les relire aujourd'hui est d'ouvrir psql. Un
 * export rend l'historique lisible ailleurs — tableur, autre application,
 * simple sauvegarde.
 *
 * Aucun secret n'est exporté : ni le jeton de calendrier, ni les
 * identifiants internes des autres utilisateurs.
 */

/** Échappement CSV : guillemets doublés, champ cité dès qu'il le faut. */
function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  // Une virgule, un guillemet ou un saut de ligne non cité décalerait
  // toutes les colonnes suivantes — et un nom d'aliment en contient.
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(','));
  // BOM UTF-8 : sans lui, Excel lit « Développé » comme « DÃ©veloppÃ© ».
  return `﻿${[header, ...body].join('\r\n')}\r\n`;
}

const DATASETS = {
  workouts: {
    filename: 'forgefit-seances.csv',
    columns: [
      'date', 'seance', 'exercice', 'muscle', 'serie', 'charge_kg', 'repetitions',
      'duree_s', 'rpe', 'echauffement', 'volume_kg',
    ],
    sql: `
      SELECT (s.started_at AT TIME ZONE 'UTC')::date::text AS date,
             s.title        AS seance,
             e.name_fr      AS exercice,
             e.target       AS muscle,
             ws.set_index   AS serie,
             ws.weight_kg   AS charge_kg,
             ws.reps        AS repetitions,
             ws.duration_s  AS duree_s,
             ws.rpe,
             ws.is_warmup   AS echauffement,
             ws.volume_kg
        FROM workout_sets ws
        JOIN workout_sessions s ON s.id = ws.session_id
        JOIN exercises e        ON e.id = ws.exercise_id
       WHERE s.user_id = $1
       ORDER BY s.started_at, ws.completed_at`,
  },
  nutrition: {
    filename: 'forgefit-nutrition.csv',
    columns: [
      'date', 'repas', 'aliment', 'quantite', 'unite',
      'kcal', 'proteines_g', 'glucides_g', 'lipides_g', 'fibres_g', 'prix_eur', 'note',
    ],
    sql: `
      SELECT consumed_on::text AS date,
             meal              AS repas,
             food_name         AS aliment,
             quantity          AS quantite,
             unit              AS unite,
             kcal,
             protein_g AS proteines_g,
             carbs_g   AS glucides_g,
             fat_g     AS lipides_g,
             fiber_g   AS fibres_g,
             price_eur AS prix_eur,
             note
        FROM food_entries
       WHERE user_id = $1
       ORDER BY consumed_on, meal, created_at`,
  },
  health: {
    filename: 'forgefit-sante.csv',
    columns: ['date', 'heure', 'metrique', 'valeur', 'unite', 'source'],
    sql: `
      SELECT (recorded_at AT TIME ZONE 'UTC')::date::text AS date,
             to_char(recorded_at AT TIME ZONE 'UTC', 'HH24:MI') AS heure,
             metric_type AS metrique,
             magnitude   AS valeur,
             unit        AS unite,
             source
        FROM health_metrics
       WHERE user_id = $1
       ORDER BY recorded_at`,
  },
};

/** GET /api/export/:dataset.csv */
exportRouter.get('/:dataset.csv', asyncHandler(async (req, res) => {
  const spec = DATASETS[req.params.dataset];
  if (!spec) {
    throw badRequest(
      `Jeu de données inconnu : ${req.params.dataset}. `
      + `Attendu : ${Object.keys(DATASETS).join(', ')}`,
    );
  }

  const { rows } = await query(spec.sql, [userOf(req)]);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${spec.filename}"`,
  });
  res.send(toCsv(rows, spec.columns));
}));

/**
 * GET /api/export/data.json — tout, d'un bloc.
 *
 * Le format brut, pour réimporter ailleurs ou archiver. Les CSV sont
 * plus commodes à lire ; celui-ci est plus complet.
 */
exportRouter.get('/data.json', asyncHandler(async (req, res) => {
  const userId = userOf(req);

  const [user, sessions, entries, metrics, programs, foods] = await Promise.all([
    // `calendar_token` est délibérément exclu : c'est un secret
    // d'accès, il n'a rien à faire dans un fichier qu'on transmet.
    query(
      `SELECT id, email, display_name, sex, birth_date, bodyweight_kg, height_cm,
              locale, created_at
         FROM users WHERE id = $1`,
      [userId],
    ),
    query(
      `SELECT s.id, s.title, s.started_at, s.ended_at, s.notes,
              s.perceived_exertion, s.source, s.program_day_id,
              COALESCE(json_agg(
                json_build_object(
                  'exercise', e.name_fr, 'target', e.target,
                  'set_index', ws.set_index, 'weight_kg', ws.weight_kg,
                  'reps', ws.reps, 'rpe', ws.rpe, 'duration_s', ws.duration_s,
                  'is_warmup', ws.is_warmup, 'volume_kg', ws.volume_kg,
                  'completed_at', ws.completed_at
                ) ORDER BY ws.completed_at
              ) FILTER (WHERE ws.id IS NOT NULL), '[]'::json) AS sets
         FROM workout_sessions s
         LEFT JOIN workout_sets ws ON ws.session_id = s.id
         LEFT JOIN exercises e     ON e.id = ws.exercise_id
        WHERE s.user_id = $1
        GROUP BY s.id
        ORDER BY s.started_at`,
      [userId],
    ),
    query(
      `SELECT consumed_on, meal, food_name, quantity, unit, kcal,
              protein_g, carbs_g, fat_g, fiber_g, price_eur, note
         FROM food_entries WHERE user_id = $1
        ORDER BY consumed_on, meal`,
      [userId],
    ),
    query(
      `SELECT metric_type, recorded_at, unit, value, magnitude, source, meta
         FROM health_metrics WHERE user_id = $1
        ORDER BY recorded_at`,
      [userId],
    ),
    query(
      `SELECT p.id, p.name, p.goal, p.days_per_week, p.weeks, p.is_active,
              p.origin, p.template_key, p.starts_on, p.rationale, p.created_at,
              COALESCE(json_agg(
                json_build_object(
                  'day_index', d.day_index, 'title', d.title, 'focus', d.focus,
                  'weekday', d.weekday, 'start_time', d.start_time,
                  'duration_minutes', d.duration_minutes,
                  'items', (
                    SELECT COALESCE(json_agg(json_build_object(
                      'position', i.position, 'exercise', e.name_fr,
                      'target_sets', i.target_sets, 'target_reps', i.target_reps,
                      'target_reps_max', i.target_reps_max,
                      'target_seconds', i.target_seconds,
                      'suggested_kg', i.suggested_kg, 'rest_seconds', i.rest_seconds
                    ) ORDER BY i.position), '[]'::json)
                    FROM program_items i JOIN exercises e ON e.id = i.exercise_id
                    WHERE i.program_day_id = d.id
                  )
                ) ORDER BY d.day_index
              ) FILTER (WHERE d.id IS NOT NULL), '[]'::json) AS days
         FROM programs p
         LEFT JOIN program_days d ON d.program_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at`,
      [userId],
    ),
    // Uniquement les aliments PERSONNELS : le catalogue commun se
    // régénère avec `npm run seed:foods`, l'exporter alourdirait le
    // fichier sans rien apporter.
    query(
      `SELECT name, brand, barcode, reference_qty, unit, kcal, fat_g, carbs_g,
              protein_g, fiber_g, price_eur, category, source, created_at
         FROM foods WHERE user_id = $1 ORDER BY name`,
      [userId],
    ),
  ]);

  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="forgefit-export.json"',
  });
  res.json({
    exported_at: new Date().toISOString(),
    format: 1,
    note: 'Export ForgeFit. Le catalogue commun d’exercices et d’aliments n’y figure '
      + 'pas : il se régénère avec `npm run ingest` et `npm run seed:foods`. Aucun '
      + 'secret d’accès n’est inclus.',
    user: user.rows[0] ?? null,
    counts: {
      sessions: sessions.rows.length,
      food_entries: entries.rows.length,
      health_metrics: metrics.rows.length,
      programs: programs.rows.length,
      personal_foods: foods.rows.length,
    },
    sessions: sessions.rows,
    food_entries: entries.rows,
    health_metrics: metrics.rows,
    programs: programs.rows,
    personal_foods: foods.rows,
  });
}));

/** GET /api/export — ce qui est exportable, et sous quelle forme. */
exportRouter.get('/', asyncHandler(async (req, res) => {
  const { rows: [counts] } = await query(
    `SELECT (SELECT COUNT(*) FROM workout_sessions WHERE user_id = $1)::int AS sessions,
            (SELECT COUNT(*) FROM food_entries     WHERE user_id = $1)::int AS food_entries,
            (SELECT COUNT(*) FROM health_metrics   WHERE user_id = $1)::int AS health_metrics,
            (SELECT COUNT(*) FROM programs         WHERE user_id = $1)::int AS programs`,
    [userOf(req)],
  );

  res.json({
    counts,
    datasets: [
      { key: 'workouts', label: 'Séances et séries', path: '/api/export/workouts.csv', format: 'CSV' },
      { key: 'nutrition', label: 'Journal alimentaire', path: '/api/export/nutrition.csv', format: 'CSV' },
      { key: 'health', label: 'Métriques de santé', path: '/api/export/health.csv', format: 'CSV' },
      { key: 'all', label: 'Tout, format brut', path: '/api/export/data.json', format: 'JSON' },
    ],
    note: 'Les CSV portent une marque d’ordre d’octets UTF-8 : sans elle, un tableur '
      + 'affiche « Développé » comme « DÃ©veloppÃ© ».',
  });
}));
