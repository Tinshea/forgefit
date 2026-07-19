import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest } from '../lib/http.js';

export const exercisesRouter = Router();

const DISCIPLINES = new Set([
  'musculation', 'callisthenie', 'mobilite', 'souplesse', 'cardio',
]);

// Le francais prime : name_fr en tete, les instructions FR extraites du
// JSONB multilingue avec repli sur l'anglais si la langue manque.
const SELECT_FIELDS = `
  id, external_id, slug, name_fr, name_en, discipline, category,
  body_part, equipment, target, muscle_group, secondary_muscles, axis,
  image_url, gif_url, attribution,
  COALESCE(instruction_steps -> 'fr', instruction_steps -> 'en', '[]'::jsonb) AS steps
`;

/**
 * GET /api/exercises
 * Filtres : discipline, target, equipment, axis, q (recherche FR), limit, offset
 */
exercisesRouter.get('/', asyncHandler(async (req, res) => {
  const { discipline, target, equipment, axis, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  if (discipline && !DISCIPLINES.has(String(discipline))) {
    throw badRequest(`discipline inconnue : ${discipline}`);
  }

  const conditions = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replace('?', `$${params.length}`));
  };

  if (discipline) add('discipline = ?::discipline', discipline);
  if (target) add('target = ?', target);
  if (equipment) add('equipment = ?', equipment);
  if (axis) add('axis = ?', axis);
  // websearch_to_tsquery tolere une saisie libre (guillemets, OR, -mot)
  // la ou plainto_tsquery echouerait sur la ponctuation.
  if (q) add("search_fr @@ websearch_to_tsquery('french', unaccent(?))", q);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT ${SELECT_FIELDS}
       FROM exercises
       ${where}
      ORDER BY name_fr
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const totalResult = await query(
    `SELECT COUNT(*)::int AS total FROM exercises ${where}`,
    params.slice(0, params.length - 2),
  );

  res.json({ total: totalResult.rows[0].total, limit, offset, items: rows });
}));

/** GET /api/exercises/facets — valeurs disponibles pour les filtres. */
exercisesRouter.get('/facets', asyncHandler(async (_req, res) => {
  const [disciplines, equipment, targets, axes] = await Promise.all([
    query('SELECT discipline::text AS value, COUNT(*)::int AS count FROM exercises GROUP BY 1 ORDER BY 2 DESC'),
    query('SELECT equipment AS value, COUNT(*)::int AS count FROM exercises WHERE equipment IS NOT NULL GROUP BY 1 ORDER BY 2 DESC'),
    query('SELECT target AS value, COUNT(*)::int AS count FROM exercises WHERE target IS NOT NULL GROUP BY 1 ORDER BY 2 DESC'),
    query('SELECT axis AS value, COUNT(*)::int AS count FROM exercises WHERE axis IS NOT NULL GROUP BY 1 ORDER BY 2 DESC'),
  ]);

  res.json({
    disciplines: disciplines.rows,
    equipment: equipment.rows,
    targets: targets.rows,
    axes: axes.rows,
  });
}));

/** GET /api/exercises/:idOrSlug */
exercisesRouter.get('/:idOrSlug', asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);

  const { rows } = await query(
    `SELECT ${SELECT_FIELDS},
            instructions, instruction_steps
       FROM exercises
      WHERE ${isUuid ? 'id = $1' : 'slug = $1 OR external_id = $1'}
      LIMIT 1`,
    [idOrSlug],
  );

  if (!rows.length) return res.status(404).json({ error: 'Exercice introuvable' });
  res.json(rows[0]);
}));
