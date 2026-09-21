import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';

export const appsRouter = Router();

/**
 * Lanceur d'applications personnelles.
 *
 * ┌─ POURQUOI EN BASE ET PAS DANS LE NAVIGATEUR ──────────────────────┐
 * │ Un lanceur sert précisément à retrouver ses outils DEPUIS         │
 * │ N'IMPORTE QUEL appareil. Rangé dans le stockage local, il serait  │
 * │ vide sur le téléphone après avoir été rempli sur l'ordinateur —   │
 * │ soit l'inverse de son utilité.                                    │
 * └────────────────────────────────────────────────────────────────────┘
 */

/**
 * Schémas autorisés.
 *
 * `javascript:` et `data:` sont refusés : ce sont les deux vecteurs
 * classiques d'exécution de code par un lien. Même sur une application
 * personnelle, rien ne justifie de les accepter — et un jour on colle
 * une URL sans la relire.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function validUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) throw badRequest('L’adresse est obligatoire.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw badRequest('Adresse invalide. Exemple : https://biblio.chez-moi.lan');
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw badRequest(`Protocole refusé : ${parsed.protocol} — seuls http et https sont acceptés.`);
  }
  return parsed.toString();
}

/** GET /api/apps */
appsRouter.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, label, url, glyph, position
       FROM user_apps WHERE user_id = $1
      ORDER BY position, created_at`,
    [userOf(req)],
  );
  res.json({ items: rows });
}));

/** POST /api/apps */
appsRouter.post('/', asyncHandler(async (req, res) => {
  const { label, url, glyph, position } = req.body ?? {};
  const name = String(label ?? '').trim();
  if (!name) throw badRequest('Le nom est obligatoire.');
  if (name.length > 40) throw badRequest('Le nom ne peut pas dépasser 40 caractères.');

  const { rows } = await query(
    `INSERT INTO user_apps (user_id, label, url, glyph, position)
     VALUES ($1, $2, $3, COALESCE(NULLIF(btrim($4), ''), 'app'), COALESCE($5, 0))
     RETURNING id, label, url, glyph, position`,
    [userOf(req), name, validUrl(url), glyph ?? null, position ?? null],
  );
  res.status(201).json(rows[0]);
}));

/** DELETE /api/apps/:id */
appsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM user_apps WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Application introuvable.');
  res.status(204).end();
}));
