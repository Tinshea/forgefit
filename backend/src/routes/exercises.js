import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest } from '../lib/http.js';
import {
  TIERS, MOVEMENT_PATTERNS, UNRATED_NOTE, REFERENCES, curationStats,
} from '../services/exercise-evidence.js';

export const exercisesRouter = Router();

const DISCIPLINES = new Set([
  'musculation', 'callisthenie', 'mobilite', 'souplesse', 'cardio',
]);

const TIER_KEYS = new Set(Object.keys(TIERS));

// Le francais prime : name_fr en tete, les instructions FR extraites du
// JSONB multilingue avec repli sur l'anglais si la langue manque.
const SELECT_FIELDS = `
  id, external_id, slug, name_fr, name_en, discipline, category,
  body_part, equipment, target, muscle_group, secondary_muscles, axis,
  image_url, gif_url, attribution,
  evidence_tier::text AS evidence_tier, movement_pattern, is_compound,
  evidence_note, evidence_sources, pattern_rank,
  COALESCE(instruction_steps -> 'fr', instruction_steps -> 'en', '[]'::jsonb) AS steps
`;

/**
 * Ordre d'affichage : le noyau curé d'abord, du fondamental à
 * l'accessoire, puis le reste du catalogue par ordre alphabétique.
 *
 * `evidence_tier` est un ENUM dont l'ordre de déclaration est justement
 * celui-là : trier sur la colonne suffit, et NULLS LAST relègue le
 * non-classé sans le cacher.
 *
 * Le nom est QUALIFIÉ. Sans le préfixe de table, ORDER BY résoudrait
 * `evidence_tier` vers la colonne de sortie — qui est un `::text` — et
 * le tri repasserait en alphabétique : accessoire avant fondamental,
 * exactement l'inverse du classement.
 */
const CURATED_FIRST = `
  ORDER BY exercises.evidence_tier ASC NULLS LAST,
           exercises.pattern_rank  ASC NULLS LAST,
           name_fr
`;

/**
 * GET /api/exercises
 * Filtres : discipline, target, equipment, axis, q (recherche FR), limit, offset
 */
exercisesRouter.get('/', asyncHandler(async (req, res) => {
  const {
    discipline, target, equipment, axis, q,
    tier, pattern, curated,
  } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  if (discipline && !DISCIPLINES.has(String(discipline))) {
    throw badRequest(`discipline inconnue : ${discipline}`);
  }
  if (tier && !TIER_KEYS.has(String(tier))) {
    throw badRequest(`palier inconnu : ${tier}. Attendu : ${[...TIER_KEYS].join(', ')}`);
  }
  if (pattern && !MOVEMENT_PATTERNS[String(pattern)]) {
    throw badRequest(`patron de mouvement inconnu : ${pattern}`);
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
  if (tier) add('evidence_tier = ?::evidence_tier', tier);
  if (pattern) add('movement_pattern = ?', pattern);
  // `curated=1` : uniquement le noyau classé. C'est le filtre qui répond
  // à « montre-moi seulement les exercices sur lesquels il existe de la
  // littérature », sans avoir à nommer un palier.
  if (curated === '1' || curated === 'true') conditions.push('evidence_tier IS NOT NULL');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT ${SELECT_FIELDS}
       FROM exercises
       ${where}
      ${CURATED_FIRST}
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
  const [disciplines, equipment, targets, axes, tiers, patterns] = await Promise.all([
    query('SELECT discipline::text AS value, COUNT(*)::int AS count FROM exercises GROUP BY 1 ORDER BY 2 DESC'),
    query('SELECT equipment AS value, COUNT(*)::int AS count FROM exercises WHERE equipment IS NOT NULL GROUP BY 1 ORDER BY 2 DESC'),
    query('SELECT target AS value, COUNT(*)::int AS count FROM exercises WHERE target IS NOT NULL GROUP BY 1 ORDER BY 2 DESC'),
    query('SELECT axis AS value, COUNT(*)::int AS count FROM exercises WHERE axis IS NOT NULL GROUP BY 1 ORDER BY 2 DESC'),
    // GROUP BY sur la colonne ENUM, pas sur sa projection texte : c'est
    // ce qui permet à ORDER BY de suivre l'ordre de l'ENUM.
    query(`SELECT evidence_tier::text AS value, COUNT(*)::int AS count
             FROM exercises WHERE evidence_tier IS NOT NULL
            GROUP BY evidence_tier ORDER BY evidence_tier`),
    query(`SELECT movement_pattern AS value, COUNT(*)::int AS count
             FROM exercises WHERE movement_pattern IS NOT NULL
            GROUP BY 1 ORDER BY 2 DESC`),
  ]);

  res.json({
    disciplines: disciplines.rows,
    equipment: equipment.rows,
    targets: targets.rows,
    axes: axes.rows,
    // Les paliers sont renvoyés avec leur critère : un badge « Fondamental »
    // sans la règle qui l'attribue ne veut rien dire.
    tiers: tiers.rows.map((r) => ({ ...r, ...TIERS[r.value] })),
    patterns: patterns.rows.map((r) => ({
      ...r,
      label: MOVEMENT_PATTERNS[r.value]?.label ?? r.value,
      group: MOVEMENT_PATTERNS[r.value]?.group ?? null,
    })),
    unrated_note: UNRATED_NOTE,
  });
}));

/**
 * GET /api/exercises/evidence — la méthode de curation, en clair.
 *
 * Un classement dont on ne peut pas lire la règle ni les sources n'est
 * qu'une opinion. Cette route expose les deux, et l'interface les affiche.
 */
exercisesRouter.get('/evidence', asyncHandler(async (_req, res) => {
  res.json({
    tiers: Object.entries(TIERS).map(([key, t]) => ({ key, ...t })),
    patterns: Object.entries(MOVEMENT_PATTERNS).map(([key, p]) => ({ key, ...p })),
    references: Object.entries(REFERENCES).map(([key, r]) => ({ key, ...r })),
    unrated_note: UNRATED_NOTE,
    stats: curationStats(),
    disclaimer: 'Ce classement s’appuie sur la littérature publiée, citée ligne à ligne. '
      + 'Aucun exercice n’est validé par un professionnel de santé. En cas de douleur, '
      + 'de pathologie ou de reprise après blessure, un avis médical prime sur toute '
      + 'recommandation automatique.',
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
