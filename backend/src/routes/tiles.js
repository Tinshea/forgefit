import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http.js';

export const tilesRouter = Router();

/**
 * Relais de tuiles OpenStreetMap.
 *
 * ┌─ POURQUOI RELAYER PLUTÔT QUE LAISSER LE NAVIGATEUR APPELER ───────┐
 * │ Trois raisons, et les trois comptent :                            │
 * │                                                                    │
 * │ 1. VIE PRIVÉE. Chaque tuile demandée révèle la zone qu'on         │
 * │    regarde. Appelées depuis le navigateur, ces requêtes portent   │
 * │    l'adresse IP réelle et se recoupent entre elles. Relayées par  │
 * │    le serveur — qu'on héberge soi-même — le fournisseur ne voit   │
 * │    que celui-ci.                                                   │
 * │                                                                    │
 * │ 2. POLITIQUE D'USAGE. OpenStreetMap EXIGE un en-tête              │
 * │    `User-Agent` identifiant l'application ; un navigateur envoie  │
 * │    le sien, anonyme parmi des millions. Ici on s'identifie.       │
 * │                                                                    │
 * │ 3. CHARGE. Les tuiles sont mises en cache : la fondation          │
 * │    recommande explicitement de le faire pour épargner ses         │
 * │    serveurs, qui sont financés par des dons.                      │
 * │                                                                    │
 * │ L'attribution « © OpenStreetMap contributors » est OBLIGATOIRE et │
 * │ affichée en permanence sur la carte — ce n'est pas une politesse, │
 * │ c'est la condition de la licence ODbL.                            │
 * └────────────────────────────────────────────────────────────────────┘
 */

const UPSTREAM = 'https://tile.openstreetmap.org';

/**
 * Identité envoyée au fournisseur.
 *
 * La politique d'OSM refuse les agents génériques. Une instance
 * personnelle qui s'annonce est une instance qu'on peut contacter si
 * elle se comporte mal — c'est tout l'objet de la règle.
 */
const USER_AGENT = 'ForgeFit/1.0 (application personnelle auto-hébergée)';

/** Sept jours : les tuiles OSM changent lentement. */
const TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * Plafond du cache, en tuiles.
 *
 * Une tuile pèse ~15 Ko : 1 500 tuiles ≈ 22 Mo, ce qui tient largement
 * en mémoire et couvre plusieurs villes à plusieurs niveaux de zoom.
 * Au-delà, on évince la plus ancienne consultée.
 */
const MAX_TILES = 1500;

/** Zooms autorisés. Au-delà de 19, OSM ne publie pas de tuiles. */
const MAX_ZOOM = 19;

const cache = new Map();

function remember(key, value) {
  // `Map` conserve l'ordre d'insertion : re-insérer une entrée la place
  // en fin, ce qui suffit à obtenir une éviction du moins récemment
  // utilisé sans structure supplémentaire.
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_TILES) {
    cache.delete(cache.keys().next().value);
  }
}

/** GET /api/tiles/:z/:x/:y.png */
tilesRouter.get('/:z/:x/:y.png', asyncHandler(async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);

  if (!Number.isInteger(z) || z < 0 || z > MAX_ZOOM) {
    throw badRequest(`Niveau de zoom hors bornes : ${req.params.z} (0 à ${MAX_ZOOM}).`);
  }
  // À un zoom z, les indices vont de 0 à 2^z − 1. Hors de cette plage,
  // la tuile n'existe pas et la demander chargerait le fournisseur pour
  // rien.
  const span = 2 ** z;
  if (!Number.isInteger(x) || x < 0 || x >= span
    || !Number.isInteger(y) || y < 0 || y >= span) {
    throw badRequest(`Tuile hors plan : ${x}/${y} au zoom ${z}.`);
  }

  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    remember(key, hit);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800');
    res.set('X-Tile-Cache', 'hit');
    return res.end(hit.body);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const upstream = await fetch(`${UPSTREAM}/${key}.png`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/png,image/*' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return res.status(502).json({ error: `Tuile indisponible (HTTP ${upstream.status}).` });
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    remember(key, { at: Date.now(), body });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800');
    res.set('X-Tile-Cache', 'miss');
    return res.end(body);
  } catch (e) {
    // Panne du fournisseur : on le dit. Une tuile grise inventée ferait
    // croire à une zone vide.
    return res.status(503).json({
      error: 'Service de tuiles injoignable.',
      detail: e.name === 'AbortError' ? 'délai dépassé' : e.message,
    });
  }
}));

/** GET /api/tiles — attribution et bornes, pour l'interface. */
tilesRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({
    max_zoom: MAX_ZOOM,
    tile_size: 256,
    attribution: '© OpenStreetMap contributors',
    attribution_url: 'https://www.openstreetmap.org/copyright',
    licence: 'ODbL 1.0',
    cached_tiles: cache.size,
    privacy: 'Les tuiles sont demandées par ton serveur, jamais par ton '
      + 'navigateur : le fournisseur ne voit pas ton adresse IP.',
  });
}));
