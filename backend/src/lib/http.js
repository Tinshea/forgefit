import { config } from '../config.js';

/** Enveloppe une route async : toute rejection part vers le middleware d'erreur. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Ressource introuvable') => new HttpError(404, message);
export const unauthorized = (message = 'Signature invalide') => new HttpError(401, message);

/**
 * Utilisateur de la requête.
 *
 * Tant qu'il n'y a pas d'authentification, l'identité vient d'un
 * en-tête, avec repli sur l'utilisateur de démonstration. Centralisé
 * ici : six routes en avaient chacune leur copie, et le jour où un vrai
 * mécanisme d'authentification arrivera, il n'y aura qu'un endroit à
 * changer.
 */
export const userOf = (req) => req.header('x-user-id') || config.defaultUserId;

/** Borne un entier de requête (pagination, fenêtres temporelles). */
export const boundedInt = (value, fallback, max) => Math.min(
  Number(value) > 0 ? Number(value) : fallback,
  max,
);
