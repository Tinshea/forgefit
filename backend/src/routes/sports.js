import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import {
  catalogue, CATEGORIES, CATEGORY_ORDER, SPORTS, getSport, REFERENCES,
  locations,
} from '../services/sports.js';
import { ACWR, MONOTONY_CEILING, describeSessionLoad } from '../services/session-load.js';

export const sportsRouter = Router();

/**
 * GET /api/sports — le catalogue, groupé par catégorie.
 *
 * La catégorie n'est pas un rangement cosmétique : elle porte la
 * QUALITÉ PHYSIQUE dominante et la façon dont le sport se dose. C'est
 * ce qui permet de dire que deux sports se substituent ou se complètent.
 */
sportsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({
    categories: catalogue(),
    total: Object.keys(SPORTS).length,
    references: Object.entries(REFERENCES).map(([key, r]) => ({ key, ...r })),
    method: [
      'La charge d’une séance vaut RPE × durée en minutes (Foster, 2001). '
      + 'C’est l’unité qui rend comparables des disciplines sans mesure commune.',
      'Le coût énergétique vient du Compendium of Physical Activities '
      + '(Ainsworth, 2011) : ce sont des moyennes de population, pas ta dépense.',
      'Les profils musculaires sont des attributions qualitatives issues de la '
      + 'biomécanique du geste, pas des mesures électromyographiques.',
    ],
    scales: {
      rpe: [
        { value: 1, label: 'Très facile — conversation sans effort' },
        { value: 3, label: 'Facile — endurance fondamentale' },
        { value: 5, label: 'Modéré — phrases complètes encore possibles' },
        { value: 7, label: 'Difficile — quelques mots à la fois' },
        { value: 9, label: 'Très difficile — proche du maximum' },
        { value: 10, label: 'Maximal — intenable plus longtemps' },
      ],
      load_levels: [150, 350, 600, 900].map((l) => ({
        at: l, label: describeSessionLoad(l)?.label,
      })),
      monotony_ceiling: MONOTONY_CEILING,
      acwr_reference: ACWR.reference,
    },
  });
}));

/**
 * GET /api/sports/locations — ce qu'on peut faire, là où l'on est.
 *
 * Déclaré AVANT `/:key`, sinon « locations » serait interprété comme
 * une clé de sport et renverrait 404.
 */
sportsRouter.get('/locations', asyncHandler(async (_req, res) => {
  res.json({ locations: locations() });
}));

/** GET /api/sports/categories — la taxonomie seule. */
sportsRouter.get('/categories', asyncHandler(async (_req, res) => {
  res.json({
    categories: CATEGORY_ORDER.map((key) => ({ key, ...CATEGORIES[key] })),
  });
}));

/** GET /api/sports/:key — fiche complète, profil musculaire compris. */
sportsRouter.get('/:key', asyncHandler(async (req, res) => {
  const sport = getSport(req.params.key);
  if (!sport) return res.status(404).json({ error: 'Sport inconnu' });
  return res.json(sport);
}));
