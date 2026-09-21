import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http.js';
import {
  describeCode, trainingNotes, daypartOf, DAYPARTS, REFERENCES,
} from '../services/weather.js';

export const weatherRouter = Router();

/**
 * ┌─ POURQUOI LE SERVEUR APPELLE, ET PAS LE NAVIGATEUR ───────────────┐
 * │ Jusqu'ici cette application ne faisait AUCUN appel à un tiers.    │
 * │ La météo en introduit un, et c'est un vrai compromis, assumé ici  │
 * │ plutôt que caché :                                                │
 * │                                                                    │
 * │ — Si le navigateur appelait Open-Meteo directement, le service    │
 * │   verrait l'adresse IP réelle, l'agent utilisateur, et pourrait   │
 * │   rapprocher les requêtes entre elles. En passant par le serveur  │
 * │   — qu'on héberge soi-même — il ne voit que celui-ci.             │
 * │                                                                    │
 * │ — Les coordonnées sont ARRONDIES à deux décimales, soit environ   │
 * │   un kilomètre. C'est amplement suffisant pour une température,   │
 * │   et cela évite de transmettre une position de porte d'entrée.    │
 * │                                                                    │
 * │ — Un cache de quinze minutes limite le nombre d'appels : la météo │
 * │   ne change pas d'une minute à l'autre, et chaque requête épargnée │
 * │   est une trace de moins.                                          │
 * │                                                                    │
 * │ Open-Meteo est retenu parce qu'il ne demande NI compte NI clé :   │
 * │ il n'y a donc pas d'identifiant à rattacher aux requêtes.         │
 * │                                                                    │
 * │ Et rien de tout cela ne se déclenche seul : la fonctionnalité est │
 * │ explicitement activée par l'utilisateur, côté interface.          │
 * └────────────────────────────────────────────────────────────────────┘
 */
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 4000;

const cache = new Map();

/** Arrondi au centième de degré : ≈ 1 km, et pas davantage. */
const coarse = (v) => Math.round(v * 100) / 100;

weatherRouter.get('/', asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw badRequest('Latitude invalide.');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw badRequest('Longitude invalide.');
  }

  const key = `${coarse(lat)},${coarse(lon)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return res.json({ ...hit.data, cached: true });
  }

  const url = `${ENDPOINT}?latitude=${coarse(lat)}&longitude=${coarse(lon)}`
    + '&current=temperature_2m,apparent_temperature,precipitation,weather_code,'
    + 'wind_speed_10m,is_day&timezone=auto';

  let payload;
  try {
    // Un délai borné : un service météo lent ne doit jamais bloquer
    // l'affichage d'une application d'entraînement.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
  } catch (e) {
    // Panne du tiers : on le dit, on ne fabrique rien. Une météo
    // inventée serait pire qu'aucune météo.
    return res.status(503).json({
      error: 'Service météo indisponible.',
      detail: e.name === 'AbortError' ? 'délai dépassé' : e.message,
    });
  }

  const c = payload.current ?? {};
  const code = c.weather_code;
  const described = describeCode(code);
  const hour = Number(String(c.time ?? '').slice(11, 13));

  const data = {
    observed_at: c.time ?? null,
    timezone: payload.timezone ?? null,
    temperature: c.temperature_2m ?? null,
    apparent: c.apparent_temperature ?? null,
    precipitation_mm: c.precipitation ?? null,
    wind_kmh: c.wind_speed_10m ?? null,
    is_day: c.is_day === 1,
    code,
    ...described,
    daypart: daypartOf(hour),
    daypart_label: DAYPARTS[daypartOf(hour)]?.label ?? null,
    notes: trainingNotes({
      apparent: c.apparent_temperature,
      temperature: c.temperature_2m,
      windKmh: c.wind_speed_10m,
      precipitationMm: c.precipitation,
      code,
      isDay: c.is_day === 1,
    }),
    attribution: 'Données météo : Open-Meteo (open-meteo.com), licence CC BY 4.0.',
    privacy: 'Coordonnées arrondies à ≈ 1 km et transmises par ton serveur, '
      + 'jamais par ton navigateur.',
    references: Object.entries(REFERENCES).map(([k, r]) => ({ key: k, ...r })),
    cached: false,
  };

  cache.set(key, { at: Date.now(), data });
  return res.json(data);
}));
