import express from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../lib/http.js';
import { config } from '../config.js';
import {
  hashPassword, verifyPassword, needsRehash, passwordProblems,
  newSessionToken, hashToken, throttleDelay, normalizeEmail,
  SESSION_TTL_MS, SESSION_RENEW_MS,
} from '../services/auth.js';

/**
 * Comptes et sessions.
 *
 * ┌─ LA MIGRATION NE DOIT VERROUILLER PERSONNE DEHORS ────────────────┐
 * │ Cette application tourne déjà, sans mot de passe, sur un réseau   │
 * │ privé. Exiger une session du jour au lendemain rendrait l'API     │
 * │ muette avant que le compte existe — l'écran de connexion lui-même │
 * │ ne pourrait plus rien lire.                                       │
 * │                                                                    │
 * │ L'instance est donc dans l'un de deux états :                     │
 * │                                                                    │
 * │   NON RÉCLAMÉE  aucun compte n'a de mot de passe. L'API se        │
 * │                 comporte comme avant, et l'interface propose de   │
 * │                 créer le compte.                                  │
 * │   RÉCLAMÉE      un mot de passe existe. Toute requête exige une   │
 * │                 session valide, et l'en-tête `x-user-id` cesse    │
 * │                 définitivement d'être cru.                        │
 * │                                                                    │
 * │ Le passage est à SENS UNIQUE : on ne revient pas en arrière en    │
 * │ effaçant un cookie.                                               │
 * └────────────────────────────────────────────────────────────────────┘
 */

export const authRouter = express.Router();

const COOKIE = 'ff_session';

/** L'instance a-t-elle un compte protégé ? */
export async function isClaimed() {
  const { rows } = await query(
    'SELECT 1 FROM users WHERE password_hash IS NOT NULL LIMIT 1',
  );
  return rows.length > 0;
}

/**
 * Lecture du cookie, à la main.
 *
 * Une dépendance de plus pour découper une chaîne sur `;` ne se
 * justifie pas, et celle-ci serait sur le chemin de CHAQUE requête.
 */
function cookieOf(req, name) {
  const brut = req.headers.cookie;
  if (!brut) return null;
  for (const part of brut.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function setSessionCookie(req, res, token, maxAgeMs) {
  // `secure` suit le protocole RÉEL : forcé en permanence, le cookie
  // serait rejeté sur un réseau local en clair, et la connexion
  // échouerait sans le moindre message. Derrière un proxy, c'est
  // l'en-tête transmis qui fait foi.
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    // `Lax` et non `Strict` : en `Strict`, arriver sur l'application
    // depuis un lien externe montrerait un écran déconnecté, puis
    // connecté au rechargement — déroutant pour aucun gain réel ici.
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (https) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/**
 * Résout la session d'une requête, ou `null`.
 *
 * Prolonge la validité de façon glissante : quelqu'un qui se sert de
 * l'application toutes les semaines ne doit pas être déconnecté au
 * trentième jour. On n'écrit qu'au-delà d'un seuil — sinon chaque
 * requête produirait une écriture.
 */
export async function sessionOf(req) {
  const token = cookieOf(req, COOKIE);
  if (!token) return null;

  const { rows } = await query(
    `SELECT s.id, s.user_id, s.expires_at, u.email, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const session = rows[0];
  if (!session) return null;

  const reste = new Date(session.expires_at).getTime() - Date.now();
  if (reste < SESSION_TTL_MS - SESSION_RENEW_MS) {
    await query(
      `UPDATE sessions SET last_seen_at = now(),
              expires_at = now() + ($2 || ' milliseconds')::interval
        WHERE id = $1`,
      [session.id, String(SESSION_TTL_MS)],
    );
  }
  return session;
}

/* ─── État ────────────────────────────────────────────────────────── */

authRouter.get('/state', asyncHandler(async (req, res) => {
  const claimed = await isClaimed();
  const session = claimed ? await sessionOf(req) : null;
  res.json({
    claimed,
    authenticated: session != null,
    user: session
      ? { id: session.user_id, email: session.email, display_name: session.display_name }
      : null,
  });
}));

/* ─── Création du compte ──────────────────────────────────────────── */

authRouter.post('/register', asyncHandler(async (req, res) => {
  if (await isClaimed()) {
    // Ne pas dire « il existe déjà un compte » à un inconnu : c'est
    // une information qu'il n'a pas à obtenir. Le refus suffit.
    return res.status(409).json({ error: 'Cette instance a déjà un compte.' });
  }

  const email = normalizeEmail(req.body?.email);
  const displayName = String(req.body?.display_name ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!email) return res.status(400).json({ error: 'Adresse invalide.' });
  if (!displayName) return res.status(400).json({ error: 'Le nom est obligatoire.' });

  const problems = passwordProblems(password, { email, displayName });
  if (problems.length) return res.status(400).json({ error: problems.join(' '), problems });

  const hash = await hashPassword(password);

  // Le compte par défaut porte déjà toutes les données de l'instance :
  // on le RÉCLAME plutôt que d'en créer un second, sans quoi l'historique
  // resterait attaché à un compte devenu inaccessible.
  const { rows } = await query(
    `UPDATE users
        SET email = $2, display_name = $3, password_hash = $4,
            password_set_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING id, email, display_name`,
    [config.defaultUserId, email, displayName, hash],
  );
  const user = rows[0];
  if (!user) return res.status(500).json({ error: 'Compte par défaut introuvable.' });

  const token = newSessionToken();
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, $4)`,
    [user.id, hashToken(token), String(SESSION_TTL_MS), req.headers['user-agent'] ?? null],
  );
  setSessionCookie(req, res, token, SESSION_TTL_MS);
  return res.status(201).json({ user });
}));

/* ─── Connexion ───────────────────────────────────────────────────── */

authRouter.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  const refus = { error: 'Adresse ou mot de passe incorrect.' };

  if (!email) return res.status(401).json(refus);

  const { rows: tentatives } = await query(
    'SELECT failures, last_failure FROM login_attempts WHERE email = $1',
    [email],
  );
  const failures = tentatives[0]?.failures ?? 0;
  const attente = throttleDelay(failures);
  if (attente > 0) {
    const ecoule = Date.now() - new Date(tentatives[0].last_failure).getTime();
    if (ecoule < attente) {
      const reste = Math.ceil((attente - ecoule) / 1000);
      return res.status(429)
        .set('Retry-After', String(reste))
        .json({ error: `Trop d’essais. Réessaie dans ${reste} seconde${reste > 1 ? 's' : ''}.` });
    }
  }

  const { rows } = await query(
    'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];

  // On vérifie TOUJOURS un mot de passe, même sans compte : sans cela,
  // une adresse inconnue répondrait en une milliseconde et une adresse
  // connue en cent, ce qui révèle qui possède un compte.
  const empreinte = user?.password_hash
    ?? '$scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA';
  const ok = await verifyPassword(password, empreinte) && user != null;

  if (!ok) {
    await query(
      `INSERT INTO login_attempts (email, failures, last_failure)
       VALUES ($1, 1, now())
       ON CONFLICT (email) DO UPDATE
         SET failures = login_attempts.failures + 1, last_failure = now()`,
      [email],
    );
    return res.status(401).json(refus);
  }

  await query('DELETE FROM login_attempts WHERE email = $1', [email]);

  // Les paramètres de dérivation ont pu être durcis depuis : la seule
  // occasion de recalculer l'empreinte est ici, quand le mot de passe
  // en clair est disponible.
  if (needsRehash(user.password_hash)) {
    const neuf = await hashPassword(password);
    await query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, neuf]);
  }

  const token = newSessionToken();
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, $4)`,
    [user.id, hashToken(token), String(SESSION_TTL_MS), req.headers['user-agent'] ?? null],
  );
  setSessionCookie(req, res, token, SESSION_TTL_MS);
  return res.json({
    user: { id: user.id, email: user.email, display_name: user.display_name },
  });
}));

/* ─── Déconnexion ─────────────────────────────────────────────────── */

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = cookieOf(req, COOKIE);
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  clearSessionCookie(res);
  res.status(204).end();
}));

/** Ferme TOUTES les sessions : le geste qu'on fait après un appareil perdu. */
authRouter.post('/logout-all', asyncHandler(async (req, res) => {
  const session = await sessionOf(req);
  if (!session) return res.status(401).json({ error: 'Non connecté.' });
  await query('DELETE FROM sessions WHERE user_id = $1', [session.user_id]);
  clearSessionCookie(res);
  return res.status(204).end();
}));

authRouter.get('/sessions', asyncHandler(async (req, res) => {
  const session = await sessionOf(req);
  if (!session) return res.status(401).json({ error: 'Non connecté.' });
  const { rows } = await query(
    `SELECT id, created_at, last_seen_at, expires_at, user_agent,
            (id = $2) AS current
       FROM sessions WHERE user_id = $1 ORDER BY last_seen_at DESC`,
    [session.user_id, session.id],
  );
  return res.json({ items: rows });
}));
