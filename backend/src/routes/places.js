import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import { LOCATIONS } from '../services/sports.js';

export const placesRouter = Router();

/**
 * Lieux réels de l'utilisateur, posés sur une carte stylisée.
 *
 * ┌─ DEUX NOTIONS À NE PAS CONFONDRE ─────────────────────────────────┐
 * │ `LOCATIONS` (dans sports.js) sont des TYPES de lieu : ils disent  │
 * │ ce qu'on peut y pratiquer — « une salle permet la musculation ».  │
 * │                                                                    │
 * │ `user_places` sont les lieux RÉELS : « ma salle », « le bureau ». │
 * │ Chacun porte un type, dont il hérite les sports praticables.      │
 * │                                                                    │
 * │ Les coordonnées sont celles d'un PLAN STYLISÉ borné à 0–100, pas  │
 * │ de la Terre. Rien ici ne permet de localiser qui que ce soit.     │
 * └────────────────────────────────────────────────────────────────────┘
 */

const KINDS = new Set(Object.keys(LOCATIONS));

/**
 * Coordonnée géographique.
 *
 * Arrondie à cinq décimales, soit ≈ 1 m. Au-delà, on stockerait une
 * précision qu'aucun usage ici ne réclame — on veut retrouver « ma
 * salle », pas la porte d'entrée au centimètre.
 */
const geo = (v, name, bound) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < -bound || n > bound) {
    throw badRequest(`${name} doit être compris entre -${bound} et ${bound}.`);
  }
  return Math.round(n * 1e5) / 1e5;
};

/** GET /api/places */
placesRouter.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, label, kind, lat::float AS lat, lon::float AS lon
       FROM user_places WHERE user_id = $1
      ORDER BY created_at`,
    [userOf(req)],
  );

  res.json({
    items: rows.map((r) => ({
      ...r,
      // Le type est résolu ici : l'interface n'a pas à recroiser deux
      // listes pour savoir ce qu'on peut faire à un endroit.
      kind_label: LOCATIONS[r.kind]?.label ?? r.kind,
      glyph: LOCATIONS[r.kind]?.glyph ?? 'app',
      sports: LOCATIONS[r.kind]?.sports?.length ?? 0,
    })),
    kinds: Object.entries(LOCATIONS).map(([key, l]) => ({
      key, label: l.label, glyph: l.glyph,
    })),
  });
}));

/** POST /api/places */
placesRouter.post('/', asyncHandler(async (req, res) => {
  const { label, kind, lat, lon } = req.body ?? {};
  const name = String(label ?? '').trim();
  if (!name) throw badRequest('Le nom est obligatoire.');
  if (name.length > 32) throw badRequest('Le nom ne peut pas dépasser 32 caractères.');
  if (!KINDS.has(kind)) {
    throw badRequest(`Type de lieu inconnu : ${kind}. Attendu : ${[...KINDS].join(', ')}.`);
  }

  const { rows } = await query(
    `INSERT INTO user_places (user_id, label, kind, lat, lon)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, label, kind, lat::float AS lat, lon::float AS lon`,
    [userOf(req), name, kind, geo(lat, 'lat', 90), geo(lon, 'lon', 180)],
  );
  res.status(201).json(rows[0]);
}));

/** PATCH /api/places/:id — deplacer un pion. */
placesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { lat, lon, label } = req.body ?? {};
  const { rows } = await query(
    `UPDATE user_places
        SET lat = COALESCE($3, lat), lon = COALESCE($4, lon),
            label = COALESCE(NULLIF(btrim($5), ''), label)
      WHERE id = $1 AND user_id = $2
      RETURNING id, label, kind, lat::float AS lat, lon::float AS lon`,
    [
      req.params.id, userOf(req),
      lat == null ? null : geo(lat, 'lat', 90),
      lon == null ? null : geo(lon, 'lon', 180),
      label ?? null,
    ],
  );
  if (!rows.length) throw notFound('Lieu introuvable.');
  res.json(rows[0]);
}));

/** DELETE /api/places/:id */
placesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM user_places WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Lieu introuvable.');
  res.status(204).end();
}));
