import { Router } from 'express';
import { asyncHandler, userOf } from '../lib/http.js';
import { query } from '../db.js';
import {
  disciplineOf, prioritesPhysiques, SOURCES as SOURCES_DISCIPLINES,
} from '../services/disciplines.js';
import { manuelDe, detailDe } from '../services/manuals/index.js';
import { illustrationDe } from '../services/combat-illustrations.js';
import { rechercheVideo, chaineDe } from '../services/combat-video.js';
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
/**
 * La fiche d'une discipline.
 *
 * ┌─ POURQUOI ELLE NE SE CONTENTE PLUS DU CATALOGUE ──────────────────┐
 * │ Choisir un sport n'ouvrait qu'un formulaire : date, durée,        │
 * │ ressenti. On enregistrait une discipline sans jamais rien         │
 * │ apprendre d'elle.                                                 │
 * │                                                                    │
 * │ On rassemble ici tout ce qu'on sait d'elle : ce qu'elle coûte, ce │
 * │ qu'elle sollicite, ce qu'elle exige physiquement quand c'est      │
 * │ documenté, et surtout CE QUE TU Y AS FAIT. Une fiche sans ton     │
 * │ histoire dedans reste une notice.                                 │
 * └────────────────────────────────────────────────────────────────────┘
 */
sportsRouter.get('/:key', asyncHandler(async (req, res) => {
  const key = req.params.key;
  const sport = getSport(key);
  if (!sport) return res.status(404).json({ error: 'Sport inconnu' });

  const userId = userOf(req);

  // Ce qu'on en sait physiquement — seulement si c'est SOURCÉ. Une
  // discipline non documentée le dit, au lieu d'afficher un profil
  // inventé qui aurait l'air tout aussi sérieux.
  const profil = disciplineOf(key);

  const { rows: histo } = await query(
    `SELECT COUNT(*)::int                                   AS seances,
            COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60), 0)::int AS minutes,
            MIN(started_at)                                 AS premiere,
            MAX(started_at)                                 AS derniere,
            AVG(perceived_exertion)::numeric(3,1)           AS rpe_moyen
       FROM workout_sessions
      WHERE user_id = $1 AND sport_key = $2`,
    [userId, key],
  );

  // Douze semaines : assez pour voir une tendance, assez court pour que
  // ce soit encore l'entraînement d'aujourd'hui.
  const { rows: parSemaine } = await query(
    `SELECT to_char(date_trunc('week', started_at), 'YYYY-MM-DD') AS semaine,
            COUNT(*)::int AS seances,
            COALESCE(SUM(
              perceived_exertion * EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
            ), 0)::int AS charge
       FROM workout_sessions
      WHERE user_id = $1 AND sport_key = $2
        AND started_at > now() - interval '12 weeks'
        AND ended_at IS NOT NULL
      GROUP BY 1 ORDER BY 1`,
    [userId, key],
  );

  const { rows: recentes } = await query(
    `SELECT id, started_at, ended_at, perceived_exertion, title,
            distance_m, elevation_m, rounds, ascents
       FROM workout_sessions
      WHERE user_id = $1 AND sport_key = $2
      ORDER BY started_at DESC LIMIT 8`,
    [userId, key],
  );

  return res.json({
    ...sport,
    profil: profil ? {
      exigences: profil.exigences,
      priorites: prioritesPhysiques(key),
      repartition: profil.repartition,
      sources: profil.sources.map((c) => ({ cle: c, ...SOURCES_DISCIPLINES[c] })),
      syllabus: profil.syllabus ?? null,
    } : null,
    // Le manuel : pourquoi cette discipline, son répertoire, ses
    // méthodes, son esprit. `null` quand elle n'est pas encore
    // documentée — et la fiche le dit au lieu de laisser un vide.
    // Le manuel, enrichi d'une illustration VÉRIFIÉE et d'un lien vidéo
    // quand ils existent. `illustrationDe` ne renvoie que ce qu'un
    // humain a regardé : une entrée non validée n'atteint pas l'écran.
    manuel: (() => {
      const m = manuelDe(key);
      if (!m) return null;
      return {
        ...m,
        chaine: chaineDe(key),
        techniques: m.techniques.map((f) => ({
          ...f,
          items: f.items.map((t) => ({
            ...t,
            illustration: illustrationDe(key, t.nom),
            video: rechercheVideo(key, t.nom),
          })),
        })),
      };
    })(),
    // Le détail se lit assis, une fois qu'on pratique : format,
    // séance type, progression, fautes courantes, sécurité, lexique.
    detail: detailDe(key),
    historique: {
      ...histo[0],
      // `null` et non `0` : n'avoir jamais pratiqué n'est pas la même
      // chose qu'une moyenne nulle.
      rpe_moyen: histo[0].seances > 0 ? Number(histo[0].rpe_moyen) : null,
      par_semaine: parSemaine,
      recentes,
    },
  });
}));
