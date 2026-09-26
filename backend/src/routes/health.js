import crypto from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import {
  asyncHandler, badRequest, notFound, unauthorized, userOf,
} from '../lib/http.js';
import { drainHealthEvents } from '../services/health-worker.js';
import { canonicalType, CUMULATIVE_TYPES } from '../services/adapters.js';
import { hydrationTarget } from '../services/anthropometry.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

export const healthRouter = Router();


/**
 * Verification HMAC-SHA256 du corps brut.
 *
 * `timingSafeEqual` exige des buffers de meme longueur -- il jette
 * sinon, ce qui reintroduirait une fuite temporelle par l'exception.
 * On compare donc des empreintes, toujours de taille fixe.
 */
/** Comparaison a temps constant de deux chaines de longueurs libres. */
function memeSecret(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/**
 * Jeton porteur : l'authentification des emetteurs qui ne signent pas.
 *
 * Accepte sous deux formes, et la seconde n'est pas un caprice :
 *   — `Authorization: Bearer <jeton>`, la forme propre ;
 *   — `?token=<jeton>`, parce qu'un raccourci iOS ne peut poser une
 *     question a l'import que sur un parametre SIMPLE, et que l'URL en
 *     est un quand le dictionnaire d'en-tetes n'en est pas un. Sans
 *     cette forme, le jeton devrait etre saisi a la main dans
 *     l'application apres import.
 *
 * Contrepartie assumee : une URL se retrouve dans les journaux du
 * serveur, pas un en-tete. Sur une instance de reseau local c'est
 * acceptable ; ce ne le serait pas sur une instance publique.
 */
function jetonValide(req) {
  if (!config.webhookToken) return false;
  const entete = req.header('authorization') ?? '';
  const porte = /^Bearer\s+(.+)$/i.exec(entete)?.[1] ?? req.query.token;
  if (!porte) return false;
  return memeSecret(porte, config.webhookToken);
}

function verifySignature(req) {
  // Le jeton d'abord : c'est le chemin du raccourci, et le plus frequent.
  if (jetonValide(req)) return true;
  if (!config.webhookSecret) return true; // non configure : verification desactivee
  const provided = req.header('x-forgefit-signature');
  if (!provided) return false;

  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(req.rawBody ?? Buffer.alloc(0))
    .digest('hex');

  return memeSecret(provided.replace(/^sha256=/, ''), expected);
}

/**
 * POST /api/health-sync — point d'entree universel.
 *
 * Accepte n'importe quel format (Apple Health, IoT, generique). Le corps
 * brut est journalise puis la main est rendue immediatement en 202 : la
 * normalisation se fait hors du cycle HTTP. Un export de 30 000
 * echantillons ne doit pas tenir la connexion ouverte.
 */
healthRouter.post('/health-sync', asyncHandler(async (req, res) => {
  if (!verifySignature(req)) throw unauthorized('Signature du webhook invalide');

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    throw badRequest('Corps JSON attendu');
  }

  const declaredSource =
    req.header('x-forgefit-source') || req.query.source || payload.source || null;

  const { rows } = await query(
    `INSERT INTO webhook_events (source, endpoint, user_id, payload, headers)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
     RETURNING id, received_at`,
    [
      declaredSource ?? 'auto',
      req.originalUrl,
      userOf(req),
      JSON.stringify(payload),
      JSON.stringify({
        'user-agent': req.header('user-agent') ?? null,
        'content-type': req.header('content-type') ?? null,
      }),
    ],
  );

  // Coup de pouce au worker : sans attendre, le trigger NOTIFY l'aurait
  // reveille de toute facon.
  setImmediate(() => {
    drainHealthEvents().catch(() => {});
  });

  res.status(202).json({
    accepted: true,
    event_id: rows[0].id,
    received_at: rows[0].received_at,
    message: 'Charge utile acceptée, traitement asynchrone en cours.',
  });
}));

/**
 * GET /api/health/sync-config — l'adresse a coller dans le raccourci.
 *
 * ┌─ CE QUE CETTE ROUTE EXPOSE, ET POURQUOI C'EST ASSUME ─────────────┐
 * │ Elle rend le jeton du webhook en clair. C'est deliberé : c'est le │
 * │ propre identifiant de l'instance, montre a son proprietaire,      │
 * │ comme une cle d'API dans un ecran de reglages.                    │
 * │                                                                    │
 * │ Elle est sous `/api/health/`, donc DERRIERE la session : sur une  │
 * │ instance revendiquee, il faut etre connecte. Sur une instance     │
 * │ sans mot de passe, elle est ouverte — mais tout l'est deja, les   │
 * │ donnees de sante comprises, et le bandeau le dit.                 │
 * │                                                                    │
 * │ Elle n'est PAS sous `/health-sync`, qui contourne la session :    │
 * │ l'y mettre aurait rendu le jeton lisible sans authentification    │
 * │ meme sur une instance protegee, c'est-a-dire l'aurait donne a     │
 * │ qui voulait le voler.                                             │
 * └────────────────────────────────────────────────────────────────────┘
 */
healthRouter.get('/health/sync-config', asyncHandler(async (req, res) => {
  res.json({
    token: config.webhookToken || null,
    // L'hote vu par le CLIENT : le serveur, lui, ne connait que le sien,
    // et repondrait « localhost » a un telephone.
    chemin: '/api/health-sync',
    // Nom stable, quand l'hote en declare un : une IP de reseau local
    // est distribuee par le routeur et change au redemarrage, ce qui
    // perime l'adresse figee dans le raccourci.
    hote_stable: config.mdnsHost || null,
    signature_requise: Boolean(config.webhookSecret) && !config.webhookToken,
  });
}));

/** GET /api/health-sync/events — suivi de l'ingestion. */
healthRouter.get('/health-sync/events', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { rows } = await query(
    `SELECT id, source, status, attempts, metrics_count, error,
            received_at, processed_at, payload, headers
       FROM webhook_events
      WHERE user_id = $1
      ORDER BY received_at DESC
      LIMIT $2`,
    [userOf(req), limit],
  );

  // ┌─ NOMMER LES CHAMPS VIDES PLUTOT QUE DIRE « AUCUNE MESURE » ──────┐
  // │ Un envoi accepte qui n'enregistre rien laissait l'utilisateur    │
  // │ sans prise : il fallait deviner laquelle des cinq mesures avait  │
  // │ echoue, et il n'y a aucun moyen de le deviner depuis l'ecran.    │
  // │                                                                   │
  // │ La charge utile est deja stockee ; il suffit de la relire. On ne │
  // │ renvoie QUE les noms de champs vides — jamais la charge utile    │
  // │ entiere, qui peut peser des megaoctets sur un export Apple.      │
  // │                                                                   │
  // │ C'est la difference entre « ca n'a pas marche » et « la VFC et   │
  // │ le poids sont revenus vides » : la seconde se corrige.           │
  // └───────────────────────────────────────────────────────────────────┘
  const champsVides = (p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return [];
    const e = Object.entries(p);
    // Au-dela, ce n'est pas un envoi de raccourci : inutile de fouiller.
    if (e.length > 30) return [];
    return e
      .filter(([, v]) => v === '' || v === null
        || (typeof v === 'string' && v.trim() === ''))
      .map(([k]) => k);
  };

  // ┌─ DISTINGUER L'AVANT-PLAN DE L'ARRIERE-PLAN ──────────────────────┐
  // │ iOS ne demande l'autorisation de lire Sante qu'au premier        │
  // │ lancement EN AVANT-PLAN. Une automatisation ne peut pas poser    │
  // │ la question : elle interroge, n'obtient rien, et n'echoue meme   │
  // │ pas. Le raccourci envoie alors des champs vides, et l'API        │
  // │ repond 202 comme si tout allait bien.                            │
  // │                                                                   │
  // │ C'est exactement ce piege qui a coute plusieurs essais ici. Le   │
  // │ lanceur est dans l'en-tete `User-Agent` : autant s'en servir     │
  // │ pour nommer la cause au lieu de laisser deviner.                 │
  // └───────────────────────────────────────────────────────────────────┘
  const arrierePlan = (h) => /BackgroundShortcutRunner/i.test(h?.['user-agent'] ?? '');

  const items = rows.map(({ payload, headers, ...reste }) => ({
    ...reste,
    vides: reste.metrics_count ? [] : champsVides(payload),
    arriere_plan: arrierePlan(headers),
  }));
  res.json({ items });
}));

/**
 * POST /api/health/metrics — saisie directe (sans webhook).
 * Meme modele JSONB : aucune colonne dediee par type.
 */
healthRouter.post('/health/metrics', asyncHandler(async (req, res) => {
  const {
    metric_type: metricType, value, unit,
    recorded_at: recordedAt, source, external_id: externalId, meta,
  } = req.body ?? {};

  if (!metricType) throw badRequest('metric_type est requis');
  if (value === undefined || value === null) throw badRequest('value est requis');

  const payload = typeof value === 'object' ? value : { value: Number(value) };

  const { rows } = await query(
    `INSERT INTO health_metrics
       (user_id, metric_type, recorded_at, source, external_id, unit, value, meta)
     VALUES ($1, $2, COALESCE($3::timestamptz, now()), $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING id, metric_type, recorded_at, value, magnitude, unit`,
    [
      userOf(req), canonicalType(metricType), recordedAt ?? null,
      source ?? 'manual', externalId ?? null, unit ?? null,
      JSON.stringify(payload), JSON.stringify(meta ?? {}),
    ],
  );

  res.status(201).json(rows[0]);
}));

/**
 * GET /api/health/metrics — lecture generique.
 * Filtres : type, from, to, limit.
 */
healthRouter.get('/health/metrics', asyncHandler(async (req, res) => {
  const { type, from, to } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const { rows } = await query(
    // `external_id` est exposé : c'est l'identifiant d'origine du
    // capteur, seul moyen de rapprocher une mesure de sa source réelle
    // (et de retrouver celles qu'on a soi-même envoyées).
    `SELECT id, metric_type, recorded_at, source, external_id,
            unit, value, magnitude, meta
       FROM health_metrics
      WHERE user_id = $1
        AND ($2::text IS NULL OR metric_type = $2)
        AND ($3::timestamptz IS NULL OR recorded_at >= $3)
        AND ($4::timestamptz IS NULL OR recorded_at <= $4)
      ORDER BY recorded_at DESC
      LIMIT $5`,
    [userOf(req), type ?? null, from ?? null, to ?? null, limit],
  );

  res.json({ items: rows });
}));

/**
 * DELETE /api/health/metrics/:id — retire UNE mesure.
 *
 * Une balance qui pèse un sac de courses, un capteur qui déraille : la
 * mesure fausse reste sinon dans les moyennes et écrase l'échelle des
 * graphiques pour toujours. C'est aussi ce qui permet à la suite de
 * tests de ne rien laisser derrière elle.
 *
 * Volontairement UNITAIRE, jamais par lot. Tant que l'API n'authentifie
 * personne (l'en-tête X-User-Id n'est pas vérifié), une route capable
 * d'effacer un historique entier en un appel serait une arme laissée
 * chargée : quiconque atteint l'API pourrait vider huit ans de données.
 */
healthRouter.delete('/health/metrics/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM health_metrics WHERE id = $1 AND user_id = $2',
    [req.params.id, userOf(req)],
  );
  if (!rowCount) throw notFound('Mesure introuvable');
  res.json({ deleted: 1 });
}));

/**
 * GET /api/health/series?types=sleep,hrv&days=30
 *
 * Séries journalières pour les courbes de suivi. L'agrégation se fait
 * en base : rapatrier 30 jours × 7 métriques × N échantillons pour les
 * moyenner côté client serait absurde.
 *
 * `metric_type` reste une chaîne libre — une métrique inconnue de l'app
 * est interrogeable sans modification de code.
 */
/**
 * Plafond de types par requête.
 *
 * Il borne le coût d'une seule requête, pas le vocabulaire de l'app : un
 * export Santé complet fournit une quinzaine de métriques et la page de
 * suivi les demande toutes d'un coup. Un plafond trop bas les tronquait
 * SANS ERREUR — la moitié des graphiques disparaissait de la page sans
 * que rien ne le signale. Dépasser la limite est désormais une erreur
 * franche plutôt qu'une perte muette.
 */
const MAX_TYPES = 32;

healthRouter.get('/health/series', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const types = [...new Set(
    String(req.query.types ?? 'sleep,hrv,resting_hr,steps,weight')
      .split(',')
      .map((t) => canonicalType(t.trim()))
      .filter(Boolean),
  )];

  if (!types.length) throw badRequest('Au moins un type est requis');
  if (types.length > MAX_TYPES) {
    throw badRequest(`Trop de types demandés (${types.length}, maximum ${MAX_TYPES})`);
  }

  const { rows } = await query(
    `SELECT metric_type,
            date_trunc('day', recorded_at) AS day,
            AVG(magnitude)::numeric   AS avg,
            MIN(magnitude)::numeric   AS min,
            MAX(magnitude)::numeric   AS max,
            SUM(magnitude)::numeric   AS sum,
            COUNT(*)::int             AS samples,
            MAX(unit)                 AS unit
       FROM health_metrics
      WHERE user_id = $1
        AND metric_type = ANY($2)
        AND magnitude IS NOT NULL
        AND recorded_at > now() - ($3 || ' days')::interval
      GROUP BY metric_type, date_trunc('day', recorded_at)
      ORDER BY metric_type, day`,
    [userOf(req), types, String(days)],
  );

  // Cumul (pas, calories, distance…) ou moyenne (VFC, poids…) : la liste
  // vit dans adapters.js, avec le reste du vocabulaire métrique.
  const CUMULATIVE = CUMULATIVE_TYPES;

  const series = {};
  for (const r of rows) {
    (series[r.metric_type] ??= {
      metric_type: r.metric_type,
      unit: r.unit,
      aggregate: CUMULATIVE.has(r.metric_type) ? 'sum' : 'avg',
      points: [],
    }).points.push({
      day: r.day,
      value: Number(CUMULATIVE.has(r.metric_type) ? r.sum : r.avg),
      min: Number(r.min),
      max: Number(r.max),
      samples: r.samples,
    });
  }

  // Statistiques de tête : dernière valeur, moyenne, tendance.
  const summary = Object.values(series).map((s) => {
    const values = s.points.map((p) => p.value);
    const latest = values.at(-1) ?? null;
    const mean = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length : null;
    // Tendance = seconde moitié vs première moitié de la fenêtre.
    const half = Math.floor(values.length / 2);
    const older = values.slice(0, half);
    const newer = values.slice(half);
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const trend = older.length && newer.length
      ? Math.round(((avg(newer) - avg(older)) / Math.abs(avg(older) || 1)) * 1000) / 10
      : null;

    return {
      metric_type: s.metric_type,
      unit: s.unit,
      latest: latest === null ? null : Math.round(latest * 100) / 100,
      average: mean === null ? null : Math.round(mean * 100) / 100,
      trend_pct: trend,
      days_covered: s.points.length,
    };
  });

  res.json({ window_days: days, series: Object.values(series), summary });
}));

/** GET /api/health/sources — état des intégrations. */
healthRouter.get('/health/sources', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT source,
            COUNT(*)::int          AS metrics,
            COUNT(DISTINCT metric_type)::int AS types,
            MAX(recorded_at)       AS last_recorded_at,
            MAX(ingested_at)       AS last_ingested_at
       FROM health_metrics
      WHERE user_id = $1
      GROUP BY source
      ORDER BY MAX(ingested_at) DESC NULLS LAST`,
    [userOf(req)],
  );
  res.json({ items: rows });
}));

/**
 * Objectif d'hydratation, en millilitres.
 *
 * Proportionnel au poids : une valeur fixe convient à une personne de
 * 70 kg et sous-dose nettement quelqu'un de 95 kg. On y ajoute les
 * pertes sudorales des séances du jour.
 */
async function hydrationGoalFor(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT bodyweight_kg FROM users WHERE id = $1) AS profile_weight,
       -- Une balance connectée écrit dans health_metrics : sa mesure la
       -- plus récente prime sur la valeur figée du profil.
       (SELECT magnitude FROM health_metrics
         WHERE user_id = $1 AND metric_type = 'weight' AND magnitude IS NOT NULL
         ORDER BY recorded_at DESC LIMIT 1) AS measured_weight,
       -- Minutes d'entraînement du jour, sur la DURÉE DE SÉANCE.
       -- Compter la somme des durées de séries ramenait une séance de
       -- musculation de 75 min à zéro : seules les séries chronométrées
       -- (étirements, gainage) en portent une. La même expression est
       -- utilisée par trainingMinutesToday (body-profile.js) : deux
       -- définitions produiraient deux objectifs d'hydratation
       -- différents dans la même application, et c'est arrivé.
       (SELECT COALESCE(SUM(
                 EXTRACT(EPOCH FROM (COALESCE(s.ended_at, now()) - s.started_at)) / 60
               ), 0)
          FROM workout_sessions s
         WHERE s.user_id = $1
           AND s.started_at >= date_trunc('day', now())) AS training_minutes`,
    [userId],
  );

  const r = rows[0] ?? {};
  const weight = Number(r.measured_weight) || Number(r.profile_weight) || null;
  return hydrationTarget(weight, { trainingMinutes: Number(r.training_minutes) || 0 });
}

/**
 * POST /api/health/hydration — Quick Add.
 * Corps : { amount_ml: 250 }
 */
healthRouter.post('/health/hydration', asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount_ml);
  if (!Number.isFinite(amount) || amount === 0) {
    throw badRequest('amount_ml doit être un nombre non nul');
  }
  if (Math.abs(amount) > 5000) {
    throw badRequest('amount_ml hors bornes (max 5000 ml)');
  }

  // L'identifiant est renvoyé : sans lui, un ajout fait par erreur ne
  // peut plus être visé individuellement (cf. DELETE /health/metrics/:id).
  const insere = await query(
    `INSERT INTO health_metrics
       (user_id, metric_type, recorded_at, source, unit, value)
     VALUES ($1, 'hydration', now(), 'manual', 'ml', $2::jsonb)
     RETURNING id`,
    [userOf(req), JSON.stringify({ value: amount })],
  );

  const total = await query(
    `SELECT COALESCE(SUM(magnitude), 0)::numeric AS total_ml
       FROM health_metrics
      WHERE user_id = $1 AND metric_type = 'hydration'
        AND recorded_at >= date_trunc('day', now())
        AND recorded_at <  date_trunc('day', now()) + INTERVAL '1 day'`,
    [userOf(req)],
  );

  const totalMl = Number(total.rows[0].total_ml);
  const goal = await hydrationGoalFor(userOf(req));
  res.status(201).json({
    id: insere.rows[0].id,
    total_ml: totalMl,
    goal_ml: goal.ml,
    goal_basis: goal.basis,
    ratio: Math.round((totalMl / goal.ml) * 100) / 100,
  });
}));

/** GET /api/health/hydration/today — jauge quotidienne. */
healthRouter.get('/health/hydration/today', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT COALESCE(SUM(magnitude), 0)::numeric AS total_ml,
            COUNT(*)::int                        AS entries
       FROM health_metrics
      WHERE user_id = $1 AND metric_type = 'hydration'
        AND recorded_at >= date_trunc('day', now())
        AND recorded_at <  date_trunc('day', now()) + INTERVAL '1 day'`,
    [userOf(req)],
  );

  const totalMl = Number(rows[0].total_ml);
  const goal = await hydrationGoalFor(userOf(req));
  res.json({
    total_ml: totalMl,
    entries: rows[0].entries,
    goal_ml: goal.ml,
    goal_basis: goal.basis,
    goal_breakdown: { base_ml: goal.base_ml, training_ml: goal.training_ml },
    ratio: Math.round((totalMl / goal.ml) * 100) / 100,
  });
}));

/**
 * Import de l'export Apple Santé, depuis l'application.
 *
 * ┌─ POURQUOI CETTE ROUTE ────────────────────────────────────────────┐
 * │ L'analyseur existait et fonctionnait, mais ne s'invoquait qu'en   │
 * │ ligne de commande, DANS le conteneur. Concrètement, il fallait    │
 * │ un terminal et un `docker exec` pour faire entrer ses propres     │
 * │ données de santé — ce qui revient à ne pas les faire entrer.      │
 * │                                                                    │
 * │ Le corps de la requête est ÉCRIT DIRECTEMENT SUR LE DISQUE, sans  │
 * │ passer par la mémoire : un export complet pèse couramment         │
 * │ plusieurs centaines de mégaoctets, et le bufferiser ferait tomber │
 * │ le processus. C'est aussi pourquoi cette route est déclarée AVANT │
 * │ tout analyseur de corps.                                          │
 * │                                                                    │
 * │ L'analyse elle-même réutilise le script existant, tel quel, en    │
 * │ sous-processus : il est éprouvé, et le réécrire pour le rendre    │
 * │ appelable aurait été le risque le plus inutile de cette passe.    │
 * └────────────────────────────────────────────────────────────────────┘
 */
healthRouter.post('/health/import', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const depuis = String(req.query.since ?? '').trim();
  if (depuis && !/^\d{4}-\d{2}-\d{2}$/.test(depuis)) {
    return res.status(400).json({ error: 'Le paramètre « since » attend une date AAAA-MM-JJ.' });
  }

  const fichier = path.join(os.tmpdir(), `sante-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`);
  try {
    await pipeline(req, fs.createWriteStream(fichier));
  } catch (err) {
    await fs.promises.rm(fichier, { force: true });
    return res.status(400).json({ error: `Réception interrompue : ${err.message}` });
  }

  const taille = (await fs.promises.stat(fichier)).size;
  // Un export vide ou tronqué produirait un import silencieusement nul.
  if (taille < 1024) {
    await fs.promises.rm(fichier, { force: true });
    return res.status(400).json({
      error: 'Fichier trop petit pour être un export Santé. Attendu : le fichier '
        + '« export.xml » contenu dans l’archive, pas l’archive elle-même.',
    });
  }

  const args = [
    path.join(process.cwd(), 'src/scripts/import-apple-health.js'),
    '--file', fichier,
  ];
  if (depuis) args.push('--since', depuis);

  const sortie = await new Promise((resolve) => {
    const enfant = spawn(process.execPath, args, {
      env: { ...process.env, DEFAULT_USER_ID: userId },
    });
    let texte = '';
    enfant.stdout.on('data', (d) => { texte += d; });
    enfant.stderr.on('data', (d) => { texte += d; });
    enfant.on('close', (code) => resolve({ code, texte }));
  });

  await fs.promises.rm(fichier, { force: true });

  if (sortie.code !== 0) {
    return res.status(500).json({
      error: 'L’import a échoué.',
      // Les dernières lignes suffisent à comprendre, et évitent de
      // renvoyer des mégaoctets de journal dans une réponse HTTP.
      detail: sortie.texte.split('\n').slice(-12).join('\n'),
    });
  }

  const { rows } = await query(
    `SELECT metric_type, COUNT(*)::int AS n,
            to_char(MIN(recorded_at), 'YYYY-MM-DD') AS depuis,
            to_char(MAX(recorded_at), 'YYYY-MM-DD') AS jusqu_a
       FROM health_metrics
      WHERE user_id = $1 AND source = 'apple_health'
      GROUP BY 1 ORDER BY 2 DESC`,
    [userId],
  );

  return res.json({
    octets: taille,
    resume: sortie.texte.split('\n').filter((l) => l.startsWith('[import]')).slice(-8),
    metriques: rows,
  });
}));
