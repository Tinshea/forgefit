import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';

export const notesRouter = Router();

/**
 * Carnet — banc d'essai de l'architecture modulaire.
 *
 * ┌─ POURQUOI CE MODULE EXISTE ───────────────────────────────────────┐
 * │ Une coquille « modulaire » qui n'héberge qu'un seul module ne     │
 * │ prouve rien : on ne découvre ce qui est réellement couplé qu'en   │
 * │ en ajoutant un second.                                            │
 * │                                                                    │
 * │ Celui-ci n'a aucun rapport avec l'entraînement — c'est            │
 * │ précisément ce qu'on veut vérifier. Il apporte sa table, sa       │
 * │ route et sa section, sans qu'une ligne de ForgeFit change.        │
 * │                                                                    │
 * │ Il est minuscule et se retire en supprimant trois choses : cette  │
 * │ route, sa table, et son entrée dans `modules.js`.                 │
 * └────────────────────────────────────────────────────────────────────┘
 */

const MAX = 2000;

/** GET /api/notes */
notesRouter.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, body, pinned, created_at
       FROM notes WHERE user_id = $1
      ORDER BY pinned DESC, created_at DESC
      LIMIT 200`,
    [userOf(req)],
  );
  res.json({ items: rows });
}));

/** POST /api/notes */
notesRouter.post('/', asyncHandler(async (req, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (!body) throw badRequest('Une note vide n’a rien à dire.');
  if (body.length > MAX) throw badRequest(`Une note ne peut pas dépasser ${MAX} caractères.`);

  const { rows } = await query(
    `INSERT INTO notes (user_id, body) VALUES ($1, $2)
     RETURNING id, body, pinned, created_at`,
    [userOf(req), body],
  );
  res.status(201).json(rows[0]);
}));

/** PATCH /api/notes/:id — épingler ou corriger. */
notesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { body, pinned } = req.body ?? {};
  const text = body == null ? null : String(body).trim();
  if (text !== null && !text) throw badRequest('Une note vide n’a rien à dire.');

  const { rows } = await query(
    `UPDATE notes SET body = COALESCE($3, body), pinned = COALESCE($4, pinned)
      WHERE id = $1 AND user_id = $2
      RETURNING id, body, pinned, created_at`,
    [req.params.id, userOf(req), text, pinned ?? null],
  );
  if (!rows.length) throw notFound('Note introuvable.');
  res.json(rows[0]);
}));

/** DELETE /api/notes/:id */
notesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Note introuvable.');
  res.status(204).end();
}));
