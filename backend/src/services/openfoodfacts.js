// Intégration Open Food Facts.
//
// OFF est une base collaborative libre, sans clé d'API, riche en
// produits emballés européens. Elle complète le catalogue local ; elle
// ne le remplace pas.
//
// Deux raisons de ne jamais en dépendre :
//   1. disponibilité — la recherche plein texte renvoie régulièrement
//      des 503, elle est très sollicitée et sans garantie de service ;
//   2. qualité — les valeurs sont saisies par des contributeurs et non
//      vérifiées ; on y trouve des erreurs de facteur 10 ou d'unité.
//
// D'où : une recherche qui interroge d'abord la base locale, un appel
// réseau borné dans le temps, un contrôle de cohérence sur ce qui
// revient, et une mise en cache locale de tout produit retenu.

import { validateFoodCoherence } from './nutrition.js';

const BASE = 'https://world.openfoodfacts.org';
const TIMEOUT_MS = 6000;

// OFF demande une identification explicite des applications clientes.
const USER_AGENT = 'ForgeFit/1.0 (application personnelle de suivi)';

const FIELDS = [
  'code', 'product_name', 'product_name_fr', 'brands', 'quantity',
  'nutriments', 'nutriscore_grade', 'nova_group', 'image_front_small_url',
].join(',');

class OffUnavailable extends Error {
  constructor(message) {
    super(message);
    this.code = 'OFF_UNAVAILABLE';
  }
}

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new OffUnavailable(`Open Food Facts a répondu ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new OffUnavailable('Open Food Facts n’a pas répondu à temps');
    }
    if (err instanceof OffUnavailable) throw err;
    throw new OffUnavailable(`Open Food Facts injoignable : ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Convertit un produit OFF en fiche aliment.
 * Renvoie null si les données sont inexploitables — mieux vaut aucun
 * résultat qu'une fiche fantaisiste.
 */
function toFood(product) {
  if (!product) return null;
  const n = product.nutriments ?? {};

  const kcal = num(n['energy-kcal_100g'])
    // Certains produits ne renseignent que les kilojoules.
    ?? (num(n.energy_100g) != null ? num(n.energy_100g) / 4.184 : null);
  if (kcal == null) return null;

  const name = (product.product_name_fr || product.product_name || '').trim();
  if (!name) return null;

  const food = {
    name,
    brand: (product.brands ?? '').split(',')[0]?.trim() || null,
    barcode: product.code,
    source: 'openfoodfacts',
    reference_qty: 100,
    unit: 'g',
    kcal: Math.round(kcal * 10) / 10,
    fat_g: num(n.fat_100g) ?? 0,
    carbs_g: num(n.carbohydrates_100g) ?? 0,
    protein_g: num(n.proteins_100g) ?? 0,
    fiber_g: num(n.fiber_100g) ?? 0,
    price_eur: null, // OFF ne porte pas de prix : à saisir soi-même.
    nutriscore: product.nutriscore_grade ?? null,
    meta: {
      nova_group: product.nova_group ?? null,
      quantity: product.quantity ?? null,
      image_url: product.image_front_small_url ?? null,
    },
  };

  // Les valeurs venant d'une base collaborative sont contrôlées avant
  // d'entrer dans le journal : une erreur d'unité fausserait la journée.
  const check = validateFoodCoherence(food);
  food.coherence = {
    ok: check.ok,
    warning: check.ok ? null : check.message,
  };

  return food;
}

/** Recherche un produit par code-barres. */
export async function findByBarcode(barcode) {
  const clean = String(barcode).replace(/\D/g, '');
  if (clean.length < 8 || clean.length > 14) {
    throw Object.assign(new Error('Code-barres invalide (8 à 14 chiffres)'), { status: 400 });
  }

  const data = await request(`/api/v2/product/${clean}.json?fields=${FIELDS}`);
  if (!data || data.status !== 1) return null;
  return toFood(data.product);
}

/**
 * Recherche plein texte.
 *
 * Signalée comme peu fiable : l'endpoint de recherche d'OFF est
 * régulièrement saturé. L'appelant doit traiter OFF_UNAVAILABLE comme
 * un cas normal, pas comme une panne de l'application.
 */
export async function searchByName(term, limit = 10) {
  const q = String(term ?? '').trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(Math.min(limit, 24)),
    fields: FIELDS,
  });

  const data = await request(`/cgi/search.pl?${params}`);
  return (data?.products ?? []).map(toFood).filter(Boolean);
}

export { OffUnavailable };
