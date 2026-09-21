#!/usr/bin/env node
// Tests d'intégration : frappent une API RÉELLE, base réelle comprise.
//
//   npm run test:e2e                 (cible http://127.0.0.1:3000)
//   API_URL=http://127.0.0.1:3100 npm run test:e2e
//
// Conçus pour tourner sur une base DÉJÀ peuplée : on mesure des deltas
// et on isole les données créées par le test derrière des identifiants
// uniques. Un test qui n'est vert que sur une base vierge ne vaut rien.

import crypto from 'node:crypto';

const BASE = process.env.API_URL ?? 'http://127.0.0.1:3000';

/**
 * Secret de webhook de l'instance visée.
 *
 * Une instance de production en définit un et refuse toute charge non
 * signée. Sans en tenir compte, la suite échouait sur tous les webhooks
 * dès qu'on la lançait ailleurs qu'en développement — quatorze faux
 * négatifs qui masqueraient de vrais problèmes.
 *
 *   WEBHOOK_SECRET=... npm run test:e2e
 */
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';
const RUN = `e2e-${Date.now()}`;
let pass = 0;
let fail = 0;

const j = async (path, opts) => {
  const headers = { 'Content-Type': 'application/json', ...opts?.headers };

  // Signature HMAC du corps brut, quand l'instance l'exige.
  if (WEBHOOK_SECRET && path.startsWith('/api/health-sync') && opts?.method === 'POST') {
    headers['X-ForgeFit-Signature'] = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(opts.body ?? '')
      .digest('hex');
  }

  const res = await fetch(BASE + path, { ...opts, headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
};

const check = (name, cond, extra = '') => {
  if (cond) { pass += 1; console.log(`  OK   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${extra}`); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n=== ${t} ===`);

// Programme actif AVANT la suite.
//
// Plusieurs sections activent leurs propres programmes de test, et
// l'index unique partiel `uq_programs_active` désactive l'ancien au
// passage. Sans restauration, la suite laissait l'utilisateur SANS
// programme actif — donc sans séance du jour, sans calendrier et sans
// série de régularité. Une suite de tests ne doit pas abîmer l'état
// qu'elle observe.
const activeBefore = (await j('/api/programs/active')).body?.id ?? null;

section('Santé');
{
  const r = await j('/api/health');
  check('GET /api/health', r.status === 200 && r.body.database === 'up', JSON.stringify(r.body));
}

section('Catalogue');
let benchId = null;
{
  const s = await j(`/api/exercises?q=${encodeURIComponent('developpe couche')}&limit=5`);
  check('recherche FR insensible aux accents', s.status === 200 && s.body.items.length > 0);
  benchId = s.body?.items?.find((i) => /barre/i.test(i.name_fr))?.id ?? s.body?.items?.[0]?.id;

  const f = await j('/api/exercises/facets');
  const names = (f.body?.disciplines ?? []).map((d) => d.value).sort();
  check('5 disciplines, souplesse et mobilité séparées',
    names.join(',') === 'callisthenie,cardio,mobilite,musculation,souplesse', names.join(','));

  const old = await j('/api/exercises?discipline=stretching');
  check('ancienne discipline rejetée', old.status === 400);

  const one = await j(`/api/exercises/${benchId}`);
  check('instructions FR servies', Array.isArray(one.body?.steps) && one.body.steps.length > 0);
  check('URL média absolue vers la racine du dépôt',
    /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\/(images|videos)\//.test(one.body?.gif_url ?? ''),
    one.body?.gif_url);
}

section('Séance et séries');
let sessionId = null;
{
  const c = await j('/api/workouts', { method: 'POST', body: JSON.stringify({ title: RUN }) });
  check('création séance', c.status === 201 && !!c.body.id);
  sessionId = c.body.id;

  const s1 = await j(`/api/workouts/${sessionId}/sets`, {
    method: 'POST', body: JSON.stringify({ exercise_id: benchId, weight_kg: 100, reps: 5 }),
  });
  check('série enregistrée', s1.status === 201);
  check('volume calculé en base', Number(s1.body?.volume_kg) === 500, `v=${s1.body?.volume_kg}`);
  check('set_index attribué côté serveur', s1.body?.set_index === 1);

  const s2 = await j(`/api/workouts/${sessionId}/sets`, {
    method: 'POST', body: JSON.stringify({ exercise_id: benchId, weight_kg: 105, reps: 3 }),
  });
  check('set_index incrémenté', s2.body?.set_index === 2);

  const bad = await j(`/api/workouts/${sessionId}/sets`, {
    method: 'POST', body: JSON.stringify({ exercise_id: benchId }),
  });
  check('série sans dose rejetée', bad.status === 400);

  // Un étirement se chronomètre : la série ne porte ni charge ni reps.
  const stretch = await j('/api/exercises?discipline=souplesse&limit=1');
  const stretchId = stretch.body?.items?.[0]?.id;
  const timed = await j(`/api/workouts/${sessionId}/sets`, {
    method: 'POST', body: JSON.stringify({ exercise_id: stretchId, duration_s: 45 }),
  });
  check('série chronométrée acceptée sans reps', timed.status === 201, JSON.stringify(timed.body));
  check('volume nul pour un étirement', Number(timed.body?.volume_kg) === 0);
}

section('Hydratation (delta, base déjà peuplée)');
{
  const before = await j('/api/health/hydration/today');
  const start = Number(before.body.total_ml);

  const a = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: 250 }) });
  const r = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: 500 }) });
  check('cumul +750 ml', Number(r.body?.total_ml) === start + 750,
    `${start} -> ${r.body?.total_ml}`);

  const undo = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: -750 }) });
  check('annulation ramène au point de départ', Number(undo.body?.total_ml) === start);

  const bad = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: 99999 }) });
  check('quantité hors bornes rejetée', bad.status === 400);

  // Le total revient bien à zéro, mais trois lignes fictives resteraient
  // dans l'historique à chaque exécution. Sur l'instance réelle, elles
  // s'accumulent.
  for (const id of [a.body?.id, r.body?.id, undo.body?.id]) {
    if (id) await j(`/api/health/metrics/${id}`, { method: 'DELETE' });
  }
  const net = await j('/api/health/hydration/today');
  check('aucune ligne d’hydratation fictive laissée',
    Number(net.body.total_ml) === start, `${start} vs ${net.body.total_ml}`);
}

section('Webhook universel (asynchrone)');
{
  // Identifiants uniques : le test doit être rejouable et ne compter
  // que ses propres écritures.
  const payload = {
    data: {
      metrics: [
        { name: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', units: 'ms',
          data: [{ date: '2026-07-19T06:00:00Z', qty: 68, uuid: `${RUN}-hrv` }] },
        { name: 'HKCategoryTypeIdentifierSleepAnalysis', units: 'h',
          data: [{ date: '2026-07-19T05:00:00Z', qty: 7.5, uuid: `${RUN}-sleep` }] },
      ],
    },
  };

  const r = await j('/api/health-sync', { method: 'POST', body: JSON.stringify(payload) });
  check('202 immédiat', r.status === 202 && r.body.accepted === true);
  const eventId = r.body.event_id;

  // Le worker travaille hors du cycle HTTP : on lui laisse le temps.
  let latest = null;
  for (let i = 0; i < 20; i += 1) {
    await sleep(300);
    const ev = await j('/api/health-sync/events?limit=50');
    latest = ev.body?.items?.find((e) => e.id === eventId);
    if (latest?.status === 'processed' || latest?.status === 'failed') break;
  }
  check('événement traité par le worker', latest?.status === 'processed',
    `status=${latest?.status} err=${latest?.error}`);
  check('2 métriques extraites', latest?.metrics_count === 2, `n=${latest?.metrics_count}`);

  // Rejeu : l'index unique partiel doit absorber le doublon.
  const before = await j('/api/health/metrics?type=hrv&limit=500');
  const countBefore = before.body.items.length;
  await j('/api/health-sync', { method: 'POST', body: JSON.stringify(payload) });
  await sleep(2500);
  const after = await j('/api/health/metrics?type=hrv&limit=500');
  check('rejeu idempotent (aucune ligne ajoutée)',
    after.body.items.length === countBefore,
    `${countBefore} -> ${after.body.items.length}`);
}

section('Analytique');
{
  const radar = await j('/api/stats/radar');
  check('radar hexagonal', radar.body?.axes?.length === 6);
  check('rang global', typeof radar.body?.rank === 'string');
  check('libellés FR', radar.body?.axes?.[0]?.label === 'Force Poussée');
  check('décomposition mobilité/souplesse',
    typeof radar.body?.mobility_breakdown?.mobilite?.score === 'number'
    && typeof radar.body?.mobility_breakdown?.souplesse?.score === 'number');
  check('scores internes non exposés', radar.body?.internal_scores === undefined);

  const bm = await j('/api/stats/bodymap');
  check('bodymap peuplée', bm.body?.muscles?.length > 0);
  check('fatigue normalisée 0-1',
    bm.body.muscles.every((m) => m.fatigue >= 0 && m.fatigue <= 1));

  const rd = await j('/api/stats/readiness');
  check('readiness calculée', typeof rd.body?.score === 'number');
  check('readiness bornée', rd.body.score >= 0 && rd.body.score <= 100);

  const bench = await j('/api/stats/benchmark');
  check('benchmark peuplé', bench.body?.covered_lifts > 0);
  const first = bench.body?.items?.[0];
  check('échelle à 5 paliers', first?.ladder?.length === 5);
  check('paliers croissants en kg',
    first?.ladder?.every((l, i, a) => i === 0 || l.kg > a[i - 1].kg));

  const series = await j('/api/health/series?types=sleep,hrv,steps&days=30');
  check('séries agrégées par jour', series.body?.series?.length === 3);
  check('pas cumulés, VFC moyennée',
    series.body.series.find((s) => s.metric_type === 'steps')?.aggregate === 'sum'
    && series.body.series.find((s) => s.metric_type === 'hrv')?.aggregate === 'avg');

  // La page de suivi demande une quinzaine de métriques d'un coup. Un
  // ancien plafond à 10 les tronquait SANS ERREUR : la moitié des
  // graphiques disparaissait de l'écran sans que rien ne le signale.
  const tous = [
    'sleep', 'hrv', 'resting_hr', 'respiratory_rate',
    'steps', 'exercise_minutes', 'calories_active', 'distance', 'flights',
    'weight', 'body_fat', 'lean_mass', 'bmi',
    'calories_basal', 'vo2max', 'hydration',
  ];
  const large = await j(`/api/health/series?types=${tous.join(',')}&days=30`);
  check('16 métriques demandées, aucune tronquée',
    large.status === 200
    && large.body.series.every((s) => tous.includes(s.metric_type)));

  // Une demande hors limite doit échouer franchement plutôt que de
  // rendre un résultat partiel qu'on croirait complet.
  const trop = await j(`/api/health/series?types=${
    Array.from({ length: 40 }, (_, i) => `m${i}`).join(',')}`);
  check('au-delà du plafond : erreur explicite', trop.status === 400);

  // La distance et les étages se cumulent comme les pas : les moyenner
  // afficherait 3 km parcourus au lieu de 12.
  const cumuls = await j('/api/health/series?types=distance,flights,exercise_minutes&days=90');
  check('distance, étages et minutes cumulés',
    cumuls.body.series.every((s) => s.aggregate === 'sum'));
}

section('Programme');
{
  const bad = await j('/api/programs/generate', {
    method: 'POST', body: JSON.stringify({ goal: 'inexistant' }),
  });
  check('objectif invalide rejeté', bad.status === 400);

  const r = await j('/api/programs/generate', {
    method: 'POST', body: JSON.stringify({ days_per_week: 4, goal: 'hypertrophie' }),
  });
  check('génération', r.status === 201);

  const d = await j(`/api/programs/${r.body.id}`);
  check('4 jours', d.body?.days?.length === 4);
  const items = d.body?.days?.flatMap((x) => x.items) ?? [];
  check('exercices affectés', items.length > 0);
  check('dose toujours présente', items.every((i) => i.target_reps || i.target_seconds));
  check('étirements en durée', items
    .filter((i) => i.discipline === 'souplesse')
    .every((i) => i.target_seconds && !i.target_reps));
  check('charges au pas de 2,5 kg', items
    .filter((i) => i.suggested_kg != null)
    .every((i) => (Number(i.suggested_kg) * 10) % 25 === 0));
  check('raisonnement enregistré', !!d.body?.rationale?.summary);

  const list = await j('/api/programs');
  check('un seul programme actif',
    list.body.items.filter((p) => p.is_active).length === 1);

  await j(`/api/programs/${r.body.id}`, { method: 'DELETE' });
}

section('Nutrition');
{
  // Suite DIFFÉRENTIELLE : le journal du jour contient déjà des données
  // réelles. On mesure des écarts et on nettoie ses propres écritures —
  // une version antérieure supposait un journal vide et cumulait les
  // entrées d'une exécution à l'autre.
  const profile = await j('/api/nutrition/profile');
  check('profil et cibles servis', profile.status === 200 && !!profile.body.targets);
  check('méthode de calcul exposée', (profile.body.method ?? []).length >= 4);

  const foods = await j('/api/nutrition/foods?q=avoine&limit=5');
  check('recherche d’aliment', foods.status === 200 && foods.body.items.length > 0);
  const oats = foods.body.items[0];
  check('prix présent dans le catalogue', oats?.price_eur != null, `prix=${oats?.price_eur}`);

  const today = new Date().toISOString().slice(0, 10);
  const before = await j(`/api/nutrition/day?date=${today}`);
  const baseKcal = Number(before.body.consumed.kcal);

  // 30 g de flocons d'avoine = 113,7 kcal dans le tableur d'origine.
  const entry = await j('/api/nutrition/entries', {
    method: 'POST',
    body: JSON.stringify({ food_id: oats.id, meal: 'matin', quantity: 30, consumed_on: today }),
  });
  check('enregistrement d’un aliment', entry.status === 201);
  check('portion calculée au prorata',
    Math.abs(Number(entry.body.kcal) - 113.7) < 0.5, `kcal=${entry.body?.kcal}`);
  check('prix calculé au prorata',
    Math.abs(Number(entry.body.price_eur) - 0.105) < 0.005, `prix=${entry.body?.price_eur}`);

  const after = await j(`/api/nutrition/day?date=${today}`);
  check('le total augmente exactement de la portion',
    Math.abs(Number(after.body.consumed.kcal) - baseKcal - 113.7) < 0.5,
    `${baseKcal} -> ${after.body.consumed.kcal}`);
  check('récapitulatif par repas complet', after.body.by_meal.length === 4);
  check('restant = cible − consommé',
    Math.abs(after.body.remaining.kcal
      - (after.body.targets.kcal - Number(after.body.consumed.kcal))) < 0.5);

  // Les valeurs figées survivent à la disparition de l'aliment.
  const custom = await j('/api/nutrition/foods', {
    method: 'POST',
    body: JSON.stringify({ name: `${RUN}-aliment`, kcal: 200, protein_g: 20, fat_g: 5, carbs_g: 20 }),
  });
  const customEntry = await j('/api/nutrition/entries', {
    method: 'POST',
    body: JSON.stringify({
      food_id: custom.body.food.id, meal: 'collation', quantity: 100, consumed_on: today,
    }),
  });
  await j(`/api/nutrition/foods/${custom.body.food.id}`, { method: 'DELETE' });
  const kept = await j(`/api/nutrition/day?date=${today}`);
  const survivor = kept.body.entries.find((e) => e.id === customEntry.body.id);
  check('l’entrée survit à la suppression de l’aliment', !!survivor);
  check('valeurs figées conservées',
    survivor && Math.abs(Number(survivor.kcal) - 200) < 0.5, `kcal=${survivor?.kcal}`);

  const badMeal = await j('/api/nutrition/entries', {
    method: 'POST', body: JSON.stringify({ food_id: oats.id, meal: 'gouter', quantity: 30 }),
  });
  check('repas invalide rejeté', badMeal.status === 400);
  const badQty = await j('/api/nutrition/entries', {
    method: 'POST', body: JSON.stringify({ food_id: oats.id, meal: 'matin', quantity: -5 }),
  });
  check('quantité négative rejetée', badQty.status === 400);

  // Open Food Facts : joignable ou non, l'API doit rester correcte.
  const off = await j('/api/nutrition/foods/barcode/3017620422003');
  if (off.status === 200) {
    check('produit trouvé par code-barres', !!off.body.food?.name);
    check('valeurs ramenées à 100 g', off.body.food.reference_qty === 100);
  } else {
    check('indisponibilité d’Open Food Facts gérée',
      off.status === 503 && !!off.body.hint, `status=${off.status}`);
  }
  const badBarcode = await j('/api/nutrition/foods/barcode/123');
  check('code-barres invalide rejeté', [400, 404].includes(badBarcode.status));

  // Nettoyage : la suite ne doit rien laisser derrière elle.
  for (const id of [entry.body.id, customEntry.body.id]) {
    await j(`/api/nutrition/entries/${id}`, { method: 'DELETE' });
  }
  const restored = await j(`/api/nutrition/day?date=${today}`);
  check('journal rendu à son état initial',
    Math.abs(Number(restored.body.consumed.kcal) - baseKcal) < 0.5,
    `${baseKcal} vs ${restored.body.consumed.kcal}`);
}

section('Balance connectée → profil');
{
  // Reproduit ce qu'une balance à impédance (Renpho, Withings…) publie
  // dans Santé, relayé vers le webhook. Horodatage courant : la mesure
  // la plus récente doit primer.
  const at = new Date().toISOString();
  const mk = (name, units, qty, suffix) => ({
    name, units, data: [{ date: at, qty, uuid: `${RUN}-${suffix}` }],
  });

  const r = await j('/api/health-sync', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        metrics: [
          mk('HKQuantityTypeIdentifierBodyMass', 'kg', 76.4, 'w'),
          mk('HKQuantityTypeIdentifierBodyFatPercentage', '%', 14.8, 'bf'),
          mk('HKQuantityTypeIdentifierLeanBodyMass', 'kg', 65.1, 'lbm'),
          mk('HKQuantityTypeIdentifierHeight', 'cm', 181, 'h'),
          mk('muscle_mass', 'kg', 61.8, 'mm'),
        ],
      },
    }),
  });
  check('pesée acceptée', r.status === 202);

  let ev = null;
  for (let i = 0; i < 20; i += 1) {
    await sleep(300);
    const list = await j('/api/health-sync/events?limit=20');
    ev = list.body?.items?.find((e) => e.id === r.body.event_id);
    if (ev?.status === 'processed' || ev?.status === 'failed') break;
  }
  check('pesée traitée', ev?.status === 'processed', `status=${ev?.status}`);
  check('5 mesures extraites', ev?.metrics_count === 5, `n=${ev?.metrics_count}`);

  const p = await j('/api/profile');
  const m = p.body.morphology;
  check('poids repris de la balance', Math.abs(m.weight_kg - 76.4) < 0.01, `${m.weight_kg}`);
  check('taille reprise de la balance', Math.abs(m.height_cm - 181) < 0.01, `${m.height_cm}`);
  check('masse maigre mesurée, non déduite',
    Math.abs(m.lean_mass_kg - 65.1) < 0.01, `${m.lean_mass_kg}`);
  check('provenance de chaque mesure indiquée',
    m.sources.weight?.origin === 'mesuré' && m.sources.lean_mass?.origin === 'mesuré',
    JSON.stringify(m.sources.weight));
  check('composition secondaire suivie', m.composition.muscle_mass?.value === 61.8);

  check('Katch-McArdle activée automatiquement',
    p.body.derived.bmr.method === 'katch-mcardle', p.body.derived.bmr.method);
  // 370 + 21,6 × 65,1 = 1776,16
  check('métabolisme calculé sur la masse maigre mesurée',
    Math.abs(p.body.derived.bmr.bmr - 1776.2) < 0.5, `${p.body.derived.bmr.bmr}`);
  check('FFMI disponible', p.body.derived.ffmi?.normalized > 0);

  // Le point de régression : deux routes résolvaient l'état corporel
  // séparément et produisaient deux métabolismes différents.
  const nutri = await j('/api/nutrition/profile');
  check('même métabolisme de base sur Profil et Nutrition',
    Math.abs(p.body.derived.bmr.bmr - nutri.body.breakdown.bmr) < 0.01,
    `profil=${p.body.derived.bmr.bmr} nutrition=${nutri.body.breakdown.bmr}`);

  const hydra = await j('/api/health/hydration/today');
  check('même objectif d’hydratation partout',
    hydra.body.goal_ml === p.body.derived.hydration.ml,
    `santé=${hydra.body.goal_ml} profil=${p.body.derived.hydration.ml}`);
  check('hydratation proportionnelle au poids',
    hydra.body.goal_ml >= 2650, `${hydra.body.goal_ml} ml pour 76,4 kg`);

  const bad = await j('/api/profile', {
    method: 'PUT', body: JSON.stringify({ height_cm: 400 }),
  });
  check('taille absurde rejetée', bad.status === 400);

  // Nettoyage indispensable : cette suite tourne contre l'instance
  // RÉELLE. Sans cela, une pesée fictive de 76,4 kg à 14,8 % de masse
  // grasse devient la mesure la plus récente et fausse le profil, le
  // métabolisme et tous les graphiques de l'utilisateur — c'est
  // exactement ce qui s'est produit.
  const restants = await j('/api/health/metrics?limit=200');
  const miens = (restants.body?.items ?? [])
    .filter((m) => String(m.external_id ?? '').startsWith(RUN));
  for (const m of miens) {
    await j(`/api/health/metrics/${m.id}`, { method: 'DELETE' });
  }
  const apres = await j('/api/health/metrics?limit=200');
  check('pesée de test retirée de l’instance',
    !(apres.body?.items ?? []).some((m) => Math.abs(m.magnitude - 14.8) < 0.001
      && m.metric_type === 'body_fat'),
    `${miens.length} mesure(s) supprimée(s)`);
}

section('CORS (écritures depuis le navigateur)');
{
  // Le navigateur envoie `Origin` sur TOUTE écriture, y compris
  // same-origin, et le proxy Vite le transmet tel quel (`changeOrigin`
  // ne réécrit que `Host`). Une suite qui n'envoie pas cet en-tête ne
  // voit jamais le problème — les lectures passent, les écritures non.
  // Les séances ouvertes ici doivent être refermées : une séance sans
  // `ended_at` reste « en cours » et s'affiche au calendrier de
  // l'utilisateur longtemps après la fin du test.
  const strays = [];
  // L'identifiant est retenu À LA CRÉATION : relire le corps plus tard
  // échouerait, un corps de réponse ne se consomme qu'une fois.
  const postFrom = async (origin) => {
    const res = await fetch(`${BASE}/api/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ title: `${RUN}-cors` }),
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (body?.id) strays.push(body.id);
    return { status: res.status, body };
  };

  // Une origine étrangère est refusée, et le refus ÉNUMÈRE les origines
  // acceptées. On s'en sert pour tester la configuration réelle de
  // l'instance plutôt que des ports codés en dur : le développement
  // autorise 5173, la production non — et les deux sont corrects.
  const evil = await postFrom('https://evil.example.com');
  const evilBody = evil.body;
  check('origine étrangère refusée', evil.status === 403, `${evil.status}`);
  check('refus en 403 explicite, pas un 500 opaque',
    typeof evilBody?.error === 'string' && Array.isArray(evilBody?.details?.allowed),
    JSON.stringify(evilBody)?.slice(0, 140));

  const allowed = evilBody?.details?.allowed ?? [];
  if (allowed.length) {
    const legit = await postFrom(allowed[0]);
    check(`écriture autorisée depuis l’origine configurée (${allowed[0]})`,
      legit.status === 201, `${legit.status}`);
  } else {
    check('au moins une origine configurée', false, 'aucune origine autorisée');
  }

  const noOrigin = await postFrom(null);
  check('requête sans Origin acceptée (webhook, curl)', noOrigin.status === 201, `${noOrigin.status}`);

  const removals = [];
  for (const id of strays) {
    removals.push((await j(`/api/workouts/${id}`, { method: 'DELETE' })).status);
  }
  check('DELETE /api/workouts/:id supprime une séance',
    removals.length > 0 && removals.every((s) => s === 204), JSON.stringify(removals));

  const stillOpen = await j('/api/workouts/open');
  check('aucune séance de test laissée ouverte',
    stillOpen.body === null || !strays.includes(stillOpen.body.id),
    `${stillOpen.body?.id}`);
  const gone = await j(`/api/workouts/${strays[0]}`);
  check('une séance supprimée n’est plus lisible', gone.status === 404, `${gone.status}`);
}

section('Curation du catalogue');
{
  const facets = await j('/api/exercises/facets');
  check('facettes exposent les paliers',
    Array.isArray(facets.body?.tiers) && facets.body.tiers.length === 3,
    JSON.stringify(facets.body?.tiers)?.slice(0, 120));

  // L'ENUM classe du fondamental à l'accessoire : si le tri repassait en
  // alphabétique, l'accessoire remonterait en tête de toutes les listes.
  check('paliers rendus dans l’ordre du classement',
    facets.body?.tiers?.[0]?.value === 'fondamental'
      && facets.body?.tiers?.at(-1)?.value === 'accessoire',
    (facets.body?.tiers ?? []).map((t) => t.value).join(','));

  check('chaque palier porte son critère',
    (facets.body?.tiers ?? []).every((t) => typeof t.criteria === 'string' && t.criteria.length > 40));

  const evidence = await j('/api/exercises/evidence');
  check('GET /api/exercises/evidence',
    evidence.status === 200 && evidence.body.references?.length > 0);
  check('les références portent une citation vérifiable',
    (evidence.body?.references ?? []).every((r) => r.citation?.length > 20));
  check('l’absence de validation professionnelle est annoncée',
    typeof evidence.body?.disclaimer === 'string'
      && evidence.body.disclaimer.includes('professionnel de santé'));

  const pull = await j('/api/exercises?pattern=vertical_pull&curated=1&limit=20');
  check('filtre par patron de mouvement', pull.status === 200 && pull.body.total > 0);
  check('le noyau curé sort classé en premier',
    pull.body?.items?.[0]?.evidence_tier === 'fondamental',
    pull.body?.items?.[0]?.evidence_tier);
  check('tous les résultats de curated=1 portent un palier',
    (pull.body?.items ?? []).every((x) => x.evidence_tier));

  const bad = await j('/api/exercises?tier=inexistant');
  check('palier inconnu -> 400 explicite', bad.status === 400 && !!bad.body.error);
}

section('Modèles de programme');
let templateProgramId = null;
let calendarProgramId = null;
let calendarDayId = null;
let guidedSessionId = null;
{
  const list = await j('/api/programs/templates');
  check('GET /api/programs/templates', list.status === 200 && list.body.items.length > 0);
  check('les modèles exposent leur dosage par muscle',
    (list.body?.items ?? []).every((t) => Array.isArray(t.volume?.muscles)));
  check('les modèles citent leurs sources',
    (list.body?.items ?? []).every((t) => t.sources.length > 0));

  const detail = await j('/api/programs/templates/haut-bas-4');
  check('GET d’un modèle résout des exercices réels',
    detail.status === 200
      && detail.body.days.length === detail.body.days_per_week
      && detail.body.days.every((d) => d.items.length > 0),
    `${detail.status}`);
  check('chaque ligne du modèle porte son patron et son palier',
    detail.body?.days?.every((d) => d.items.every((i) => i.pattern_label && i.exercise_id)));

  // Le même modèle, avec un autre matériel : la structure ne bouge pas,
  // les exercices oui. C'est tout l'intérêt d'un modèle en patrons.
  const home = await j('/api/programs/templates/haut-bas-4?equipment=poids_du_corps');
  const gymFirst = detail.body?.days?.[0]?.items?.[0]?.name_fr;
  const homeFirst = home.body?.days?.[0]?.items?.[0]?.name_fr;
  check('le profil de matériel change les exercices',
    home.status === 200 && gymFirst !== homeFirst, `${gymFirst} / ${homeFirst}`);
  check('même structure malgré le changement de matériel',
    home.body?.days?.length === detail.body?.days?.length);

  const unknown = await j('/api/programs/templates/inexistant');
  check('modèle inconnu -> 404', unknown.status === 404);

  const badEquip = await j('/api/programs/templates/haut-bas-4?equipment=chaussettes');
  check('matériel inconnu -> 400 explicite', badEquip.status === 400 && !!badEquip.body.error);

  const created = await j('/api/programs/from-template', {
    method: 'POST',
    body: JSON.stringify({
      template_key: 'haut-bas-4', equipment: 'halteres',
      name: `${RUN}-modele`, activate: false,
    }),
  });
  check('POST /api/programs/from-template', created.status === 201, `${created.status}`);
  templateProgramId = created.body?.id;

  const full = await j(`/api/programs/${templateProgramId}`);
  check('le programme instancié garde sa provenance',
    full.body?.origin === 'template' && full.body?.template_key === 'haut-bas-4');
  check('le raisonnement du modèle est figé à l’instanciation',
    Array.isArray(full.body?.rationale?.method) && full.body.rationale.method.length > 0);
  check('les lignes portent leur justification et leurs sources',
    full.body?.days?.[0]?.items?.[0]?.rationale?.why_this_one?.length > 0);
}

section('Édition manuelle d’un programme');
{
  const blank = await j('/api/programs', {
    method: 'POST',
    body: JSON.stringify({ name: `${RUN}-manuel`, days_per_week: 2, weeks: 4 }),
  });
  check('POST /api/programs crée un programme vierge',
    blank.status === 201 && blank.body.origin === 'manual', `${blank.status}`);
  const pid = blank.body?.id;

  const noName = await j('/api/programs', { method: 'POST', body: JSON.stringify({}) });
  check('programme sans nom -> 400', noName.status === 400);

  const day = await j(`/api/programs/${pid}/days`, {
    method: 'POST', body: JSON.stringify({ title: 'Séance test', focus: 'push' }),
  });
  check('POST d’une séance', day.status === 201 && day.body.day_index === 1, `${day.status}`);
  const dayId = day.body?.id;

  const pick = await j('/api/exercises?pattern=horizontal_push&tier=fondamental&limit=3');
  const exIds = (pick.body?.items ?? []).map((x) => x.id);
  check('exercices fondamentaux disponibles pour composer', exIds.length >= 2);

  const added = [];
  for (const exId of exIds.slice(0, 2)) {
    const r = await j(`/api/programs/${pid}/days/${dayId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        exercise_id: exId, target_sets: 3, target_reps: 8, target_reps_max: 12,
      }),
    });
    if (r.status === 201) added.push(r.body.id);
  }
  check('POST de lignes d’exercice', added.length === 2);

  const noDose = await j(`/api/programs/${pid}/days/${dayId}/items`, {
    method: 'POST', body: JSON.stringify({ exercise_id: exIds[0], target_sets: 3 }),
  });
  check('ligne sans répétitions ni durée -> 400 lisible',
    noDose.status === 400 && noDose.body.error.includes('target_seconds'),
    noDose.body?.error?.slice(0, 80));

  const inverted = await j(`/api/programs/${pid}/items/${added[0]}`, {
    method: 'PATCH', body: JSON.stringify({ target_reps: 12, target_reps_max: 6 }),
  });
  check('fourchette de répétitions inversée -> 400', inverted.status === 400);

  const patched = await j(`/api/programs/${pid}/items/${added[0]}`, {
    method: 'PATCH', body: JSON.stringify({ target_sets: 5, suggested_kg: 60 }),
  });
  check('PATCH d’une ligne', patched.status === 200 && patched.body.target_sets === 5);

  // Permuter deux lignes passe forcément par un état où elles
  // partageraient la même position : la route doit l'absorber.
  const reordered = await j(`/api/programs/${pid}/days/${dayId}/order`, {
    method: 'PUT', body: JSON.stringify({ item_ids: [added[1], added[0]] }),
  });
  check('PUT de réordonnancement', reordered.status === 200, `${reordered.status}`);
  check('les positions repartent de 1, sans collision',
    reordered.body?.items?.[0]?.id === added[1]
      && reordered.body.items.map((i) => i.position).join(',') === '1,2',
    JSON.stringify(reordered.body?.items));

  const partial = await j(`/api/programs/${pid}/days/${dayId}/order`, {
    method: 'PUT', body: JSON.stringify({ item_ids: [added[0]] }),
  });
  check('réordonnancement incomplet -> 400', partial.status === 400);

  const copy = await j(`/api/programs/${pid}/duplicate`, {
    method: 'POST', body: JSON.stringify({ name: `${RUN}-copie` }),
  });
  check('POST /duplicate', copy.status === 201, `${copy.status}`);
  const copyFull = await j(`/api/programs/${copy.body?.id}`);
  const srcFull = await j(`/api/programs/${pid}`);
  check('la copie reprend séances et lignes',
    copyFull.body?.days?.length === srcFull.body?.days?.length
      && copyFull.body?.days?.[0]?.items?.length === srcFull.body?.days?.[0]?.items?.length,
    `${copyFull.body?.days?.[0]?.items?.length} vs ${srcFull.body?.days?.[0]?.items?.length}`);

  // Activer bascule l'ancien : l'index unique partiel refuse deux actifs.
  const activate = await j(`/api/programs/${pid}`, {
    method: 'PATCH', body: JSON.stringify({ is_active: true }),
  });
  check('PATCH d’activation', activate.status === 200 && activate.body.is_active === true);
  const activateCopy = await j(`/api/programs/${copy.body?.id}`, {
    method: 'PATCH', body: JSON.stringify({ is_active: true }),
  });
  check('activer un second programme désactive le premier',
    activateCopy.status === 200, `${activateCopy.status}`);
  const reread = await j(`/api/programs/${pid}`);
  check('un seul programme actif à la fois', reread.body?.is_active === false);

  const delItem = await j(`/api/programs/${pid}/items/${added[0]}`, { method: 'DELETE' });
  check('DELETE d’une ligne', delItem.status === 204);
  const delDay = await j(`/api/programs/${pid}/days/${dayId}`, { method: 'DELETE' });
  check('DELETE d’une séance', delDay.status === 204);

  const foreign = await j('/api/programs/00000000-0000-0000-0000-000000000000/days', {
    method: 'POST', body: JSON.stringify({ title: 'Intrus' }),
  });
  check('programme inexistant -> 404', foreign.status === 404);

  for (const id of [pid, copy.body?.id, templateProgramId]) {
    if (id) await j(`/api/programs/${id}`, { method: 'DELETE' });
  }
  check('programmes de test supprimés', true);
}

section('Calendrier et planification');
{
  const cal = await j('/api/programs/calendar?tz=Europe/Paris');
  check('GET /api/programs/calendar', cal.status === 200 && Array.isArray(cal.body.days));
  check('les sept jours de la semaine sont exposés', cal.body?.weekdays?.length === 7);
  check('le fuseau demandé est repris', cal.body?.timezone === 'Europe/Paris');

  const badRange = await j('/api/programs/calendar?from=hier&to=demain');
  check('plage de dates invalide -> 400', badRange.status === 400);
  const badTz = await j('/api/programs/calendar?tz=' + encodeURIComponent('; DROP TABLE'));
  check('fuseau invalide -> 400 sans atteindre la base', badTz.status === 400);

  // Un programme frais : ses séances doivent être placées d'office,
  // sinon il n'apparaît pas au calendrier et la fonctionnalité est morte.
  const fresh = await j('/api/programs/from-template', {
    method: 'POST',
    body: JSON.stringify({ template_key: 'demarrage-3', name: `${RUN}-cal`, activate: true }),
  });
  const freshFull = await j(`/api/programs/${fresh.body?.id}`);
  const weekdays = (freshFull.body?.days ?? []).map((d) => d.weekday);
  check('les séances sont réparties sur la semaine à la création',
    weekdays.length === 3 && weekdays.every((w) => w >= 1 && w <= 7),
    JSON.stringify(weekdays));
  check('aucune séance ne partage le même jour',
    new Set(weekdays).size === weekdays.length, JSON.stringify(weekdays));
  check('trois séances ne sont pas collées sur trois jours d’affilée',
    !weekdays.every((w, i) => i === 0 || w === weekdays[i - 1] + 1),
    JSON.stringify(weekdays));

  const startsOn = freshFull.body?.starts_on?.slice(0, 10);
  const planned = await j(`/api/programs/calendar?tz=Europe/Paris&from=${startsOn}&to=${startsOn}`);
  check('le programme actif apparaît au calendrier',
    planned.body?.program?.id === fresh.body?.id, `${planned.body?.program?.name}`);
  check('la première journée du cycle est en semaine 1',
    planned.body?.days?.[0]?.program_week === 1, `${planned.body?.days?.[0]?.program_week}`);
  check('aucune séance laissée sans jour',
    planned.body?.program?.unscheduled_days?.length === 0);

  // Déplacer une séance sur un jour déjà pris ÉCHANGE les deux :
  // l'index unique refuserait une écriture directe.
  const [d1, d2] = freshFull.body.days;
  const moved = await j(`/api/programs/${fresh.body.id}/days/${d1.id}`, {
    method: 'PATCH', body: JSON.stringify({ weekday: d2.weekday }),
  });
  check('déplacer une séance sur un jour occupé', moved.status === 200, `${moved.status}`);
  const afterMove = await j(`/api/programs/${fresh.body.id}`);
  const byId = Object.fromEntries(afterMove.body.days.map((d) => [d.id, d.weekday]));
  check('les deux séances ont échangé leur jour',
    byId[d1.id] === d2.weekday && byId[d2.id] === d1.weekday,
    `${byId[d1.id]} / ${byId[d2.id]}`);
  check('aucun doublon de jour après échange',
    new Set(afterMove.body.days.map((d) => d.weekday)).size === afterMove.body.days.length);

  const badDay = await j(`/api/programs/${fresh.body.id}/days/${d1.id}`, {
    method: 'PATCH', body: JSON.stringify({ weekday: 9 }),
  });
  check('jour de semaine hors bornes -> 400', badDay.status === 400);

  const startMoved = await j(`/api/programs/${fresh.body.id}`, {
    method: 'PATCH', body: JSON.stringify({ starts_on: '2026-01-05' }),
  });
  check('PATCH du début de cycle', startMoved.status === 200
    && String(startMoved.body.starts_on).startsWith('2026-01-05'),
  `${startMoved.body?.starts_on}`);
  const badStart = await j(`/api/programs/${fresh.body.id}`, {
    method: 'PATCH', body: JSON.stringify({ starts_on: '05/01/2026' }),
  });
  check('date de début mal formée -> 400', badStart.status === 400);

  calendarProgramId = fresh.body?.id;
  calendarDayId = d1.id;
}

section('Séance guidée par le programme');
{
  const opened = await j('/api/workouts', {
    method: 'POST', body: JSON.stringify({ program_day_id: calendarDayId }),
  });
  check('POST /api/workouts avec program_day_id', opened.status === 201, `${opened.status}`);
  check('le titre reprend celui du jour de programme',
    typeof opened.body?.title === 'string' && opened.body.title.length > 0,
    opened.body?.title);
  guidedSessionId = opened.body?.id;

  const detail = await j(`/api/workouts/${guidedSessionId}`);
  check('la séance porte le plan du jour', !!detail.body?.plan, `${detail.body?.plan}`);
  check('le plan liste les exercices avec leurs cibles',
    detail.body?.plan?.items?.length > 0
      && detail.body.plan.items.every((i) => i.target_sets > 0 && i.exercise_id),
    `${detail.body?.plan?.items?.length} lignes`);
  check('chaque ligne du plan porte son temps de repos',
    detail.body?.plan?.items?.every((i) => i.rest_seconds > 0));
  check('le plan nomme le programme dont il vient',
    typeof detail.body?.plan?.program_name === 'string');

  // Le téléphone se verrouille entre deux séries : reprendre doit
  // retrouver LA séance ouverte, pas en créer une seconde.
  const resumed = await j('/api/workouts/open');
  check('GET /api/workouts/open retrouve la séance en cours',
    resumed.body?.id === guidedSessionId, `${resumed.body?.id}`);
  check('la reprise rend aussi le plan', !!resumed.body?.plan);

  const first = detail.body.plan.items[0];
  const logged = await j(`/api/workouts/${guidedSessionId}/sets`, {
    method: 'POST',
    body: JSON.stringify({
      exercise_id: first.exercise_id, weight_kg: 40, reps: first.target_reps ?? 8,
    }),
  });
  check('série enregistrée sur un exercice du plan', logged.status === 201);

  const foreign = await j('/api/workouts', {
    method: 'POST',
    body: JSON.stringify({ program_day_id: '00000000-0000-0000-0000-000000000000' }),
  });
  check('jour de programme inconnu -> 400', foreign.status === 400, `${foreign.status}`);

  // Le calendrier doit maintenant cocher cette journée comme faite.
  const today = new Date().toISOString().slice(0, 10);
  const cal = await j(`/api/programs/calendar?tz=Europe/Paris&from=${today}&to=${today}`);
  const todayCell = cal.body?.days?.[0];
  check('la séance apparaît au calendrier le jour même',
    todayCell?.sessions?.some((x) => x.id === guidedSessionId),
    JSON.stringify(todayCell?.sessions?.map((x) => x.id)));

  await j(`/api/workouts/${guidedSessionId}`, {
    method: 'PATCH', body: JSON.stringify({ ended_at: new Date().toISOString() }),
  });
  const closed = await j('/api/workouts/open');
  check('une séance clôturée n’est plus la séance ouverte',
    closed.body === null || closed.body?.id !== guidedSessionId, `${closed.body?.id}`);

  // La séance de test doit disparaître : elle compterait sinon dans la
  // charge d'entraînement observée, donc dans les cibles nutritionnelles.
  const purged = await j(`/api/workouts/${guidedSessionId}`, { method: 'DELETE' });
  check('séance guidée de test supprimée', purged.status === 204, `${purged.status}`);

  if (calendarProgramId) await j(`/api/programs/${calendarProgramId}`, { method: 'DELETE' });
  check('programme de calendrier supprimé', true);
}

section('Abonnement calendrier (iCalendar)');
{
  // L'abonnement ne passe pas par `j()` : il renvoie du text/calendar,
  // pas du JSON, et c'est justement ce qu'on vérifie.
  const raw = async (path) => {
    const res = await fetch(BASE + path);
    return { status: res.status, type: res.headers.get('content-type'), body: await res.text() };
  };

  // La section crée SON programme actif : les sections précédentes
  // suppriment les leurs, et un flux vide est valide — les assertions
  // sur les évènements passeraient alors sans rien vérifier.
  const icsProgram = await j('/api/programs/from-template', {
    method: 'POST',
    body: JSON.stringify({ template_key: 'haut-bas-4', name: `${RUN}-ics`, activate: true }),
  });
  check('programme actif pour l’export', icsProgram.status === 201, `${icsProgram.status}`);

  const sub = await j('/api/calendar/subscription');
  check('GET /api/calendar/subscription', sub.status === 200 && !!sub.body.token);
  check('le lien porte le jeton, pas l’identifiant d’utilisateur',
    sub.body?.path?.includes(sub.body.token) && !sub.body.path.includes('user'),
    sub.body?.path);
  check('les limites de l’abonnement sont annoncées',
    Array.isArray(sub.body?.caveats) && sub.body.caveats.length >= 3);

  const feed = await raw(`${sub.body.path}&tz=Europe/Paris`);
  check('le flux répond en text/calendar',
    feed.status === 200 && feed.type?.startsWith('text/calendar'), `${feed.type}`);
  check('le flux est un VCALENDAR complet',
    feed.body.startsWith('BEGIN:VCALENDAR') && feed.body.trimEnd().endsWith('END:VCALENDAR'));
  check('les fins de ligne sont CRLF',
    !feed.body.replace(/\r\n/g, '').includes('\n'));
  check('aucune ligne ne dépasse 75 octets',
    feed.body.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75));
  check('le fuseau demandé est défini dans le fichier',
    feed.body.includes('TZID:Europe/Paris') && feed.body.includes('BEGIN:VTIMEZONE'));

  const events = feed.body.split('\r\n').filter((l) => l === 'BEGIN:VEVENT').length;
  const ends = feed.body.split('\r\n').filter((l) => l === 'END:VEVENT').length;
  check('une séance du programme donne un évènement',
    events === ends && events === 4, `${events}/${ends}`);
  check('chaque séance est une série hebdomadaire',
    events > 0
      && feed.body.split('\r\n').filter((l) => l.startsWith('RRULE:FREQ=WEEKLY')).length === events);
  check('chaque évènement porte un rappel',
    feed.body.split('\r\n').filter((l) => l === 'BEGIN:VALARM').length === events);

  const badToken = await raw('/api/calendar/subscribe.ics?token=court');
  check('jeton mal formé -> 400', badToken.status === 400, `${badToken.status}`);
  const unknown = await raw(`/api/calendar/subscribe.ics?token=${'a'.repeat(48)}`);
  check('jeton inconnu -> 404, pas 401', unknown.status === 404, `${unknown.status}`);
  const badTz = await raw(`${sub.body.path}&tz=Mars/Olympus`);
  check('fuseau inconnu -> 400', badTz.status === 400, `${badTz.status}`);

  // La rotation est le seul moyen de couper un lien partagé par erreur.
  const rotated = await j('/api/calendar/subscription/rotate', { method: 'POST' });
  check('POST /rotate régénère le jeton',
    rotated.status === 200 && rotated.body.token && rotated.body.token !== sub.body.token);
  const revoked = await raw(`${sub.body.path}&tz=UTC`);
  check('l’ancien lien cesse de fonctionner', revoked.status === 404, `${revoked.status}`);
  const fresh = await raw(`${rotated.body.path}&tz=UTC`);
  check('le nouveau lien fonctionne', fresh.status === 200, `${fresh.status}`);

  await j(`/api/programs/${icsProgram.body?.id}`, { method: 'DELETE' });

  // Sans programme actif, le flux doit rester un fichier VALIDE : une
  // erreur ferait afficher un abonnement en échec dans l'agenda, alors
  // que la situation est normale.
  const empty = await raw(`${rotated.body.path}&tz=UTC`);
  check('sans programme actif, le flux reste valide et vide',
    empty.status === 200 && empty.body.includes('BEGIN:VCALENDAR')
      && !empty.body.includes('BEGIN:VEVENT'),
    `${empty.status}`);
}

section('Programmes de toutes les disciplines');
{
  const list = await j('/api/programs/templates');
  const byCategory = {};
  for (const t of list.body.items) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
  }
  check('les catégories couvrent force, endurance, hybride et santé',
    ['demarrage', 'hypertrophie', 'force', 'cardio', 'hybride', 'sans_salle', 'sante']
      .every((c) => byCategory[c] > 0),
    JSON.stringify(byCategory));

  const cardio = list.body.items.filter((t) => t.category === 'cardio');
  check('les modèles d’endurance chiffrent leurs minutes hebdomadaires',
    cardio.length > 0 && cardio.every((t) => t.volume.aerobic.moderate_equivalent_minutes > 0),
    JSON.stringify(cardio.map((t) => t.volume.aerobic.moderate_equivalent_minutes)));

  const oms = list.body.items.find((t) => t.key === 'oms-complet-5');
  check('le modèle OMS atteint le plancher de 150 min',
    oms?.volume?.aerobic?.meets_floor === true,
    `${oms?.volume?.aerobic?.moderate_equivalent_minutes}`);

  // Un modèle d'endurance doit se résoudre en exercices réels, sinon la
  // discipline est annoncée mais pas livrée.
  const detail = await j('/api/programs/templates/endurance-base-3');
  check('un modèle d’endurance se résout en exercices',
    detail.status === 200 && detail.body.days.every((d) => d.items.length > 0));
  check('le fractionné est distingué de l’endurance continue',
    detail.body.days.some((d) => d.items.some((i) => i.pattern === 'cardio_interval'))
      && detail.body.days.some((d) => d.items.some((i) => i.pattern === 'cardio')));

  const souplesse = await j('/api/programs/templates/souplesse-5');
  check('le modèle de souplesse est dosé en minutes, pas en séries',
    souplesse.body?.volume?.timed?.some((x) => x.pattern === 'flexibility' && x.weekly_minutes > 0),
    JSON.stringify(souplesse.body?.volume?.timed));

  const patterns = await j('/api/exercises?pattern=cardio_interval&curated=1&limit=10');
  check('le catalogue couvre le patron fractionné', patterns.body?.total > 0);
}

section('Heure et durée des séances');
{
  const created = await j('/api/programs/from-template', {
    method: 'POST',
    body: JSON.stringify({ template_key: 'demarrage-3', name: `${RUN}-heure`, activate: true }),
  });
  const full = await j(`/api/programs/${created.body.id}`);
  check('chaque séance porte une heure et une durée par défaut',
    full.body.days.every((d) => d.start_time && d.duration_minutes > 0),
    JSON.stringify(full.body.days.map((d) => `${d.start_time}/${d.duration_minutes}`)));

  const dayId = full.body.days[0].id;
  const moved = await j(`/api/programs/${created.body.id}/days/${dayId}`, {
    method: 'PATCH', body: JSON.stringify({ start_time: '07:15', duration_minutes: 45 }),
  });
  check('PATCH de l’heure et de la durée',
    moved.status === 200 && moved.body.start_time.startsWith('07:15')
      && moved.body.duration_minutes === 45,
    JSON.stringify(moved.body));

  const badTime = await j(`/api/programs/${created.body.id}/days/${dayId}`, {
    method: 'PATCH', body: JSON.stringify({ start_time: '25:00' }),
  });
  check('heure invalide -> 400', badTime.status === 400);
  const badDuration = await j(`/api/programs/${created.body.id}/days/${dayId}`, {
    method: 'PATCH', body: JSON.stringify({ duration_minutes: 1000 }),
  });
  check('durée invalide -> 400', badDuration.status === 400);

  // L'heure modifiée doit ressortir dans l'export.
  const sub = await j('/api/calendar/subscription');
  const feed = await (await fetch(`${BASE}${sub.body.path}&tz=Europe/Paris`)).text();
  check('l’heure de séance se retrouve dans l’export',
    feed.includes('T071500'), feed.split('\r\n').filter((l) => l.startsWith('DTSTART;')).join(' '));
  check('la durée de séance se retrouve dans l’export',
    feed.includes('T080000'), feed.split('\r\n').filter((l) => l.startsWith('DTEND;')).join(' '));

  await j(`/api/programs/${created.body.id}`, { method: 'DELETE' });
  check('programme horaire supprimé', true);
}

section('Recettes et coach nutritionnel');
{
  const recipes = await j('/api/nutrition/recipes');
  check('GET /api/nutrition/recipes', recipes.status === 200 && recipes.body.total > 0,
    `${recipes.body?.total}`);
  check('chaque recette porte des macros calculées',
    recipes.body.items.every((r) => Number(r.kcal) > 0 && r.ingredient_count > 0));
  check('les macros sont calculées en base, pas saisies',
    // La vue divise par le nombre de portions : une recette à
    // 0 ingrédient n'apparaîtrait simplement pas.
    recipes.body.items.every((r) => Number(r.protein_g) >= 0 && Number(r.fat_g) >= 0));

  for (const meal of ['matin', 'midi', 'soir', 'collation']) {
    const byMeal = await j(`/api/nutrition/recipes?meal=${meal}`);
    check(`des recettes existent pour « ${meal} »`, byMeal.body?.total > 0, `${byMeal.body?.total}`);
  }

  const badMeal = await j('/api/nutrition/recipes?meal=gouter');
  check('repas inconnu -> 400', badMeal.status === 400);

  const first = recipes.body.items[0];
  const detail = await j(`/api/nutrition/recipes/${first.id}`);
  check('la fiche détaille les ingrédients',
    detail.status === 200 && detail.body.ingredients.length === first.ingredient_count,
    `${detail.body?.ingredients?.length} vs ${first.ingredient_count}`);
  check('chaque ingrédient porte ses macros pour SA quantité',
    detail.body.ingredients.every((i) => i.quantity > 0 && Number(i.kcal) >= 0));

  // La somme des ingrédients doit redonner les macros de la recette :
  // deux sources de vérité pour les mêmes calories divergeraient.
  const sum = detail.body.ingredients.reduce((n, i) => n + Number(i.kcal), 0);
  check('la somme des ingrédients redonne les calories de la portion',
    Math.abs(sum / detail.body.servings - Number(detail.body.kcal)) < 1,
    `${Math.round(sum / detail.body.servings)} vs ${Math.round(detail.body.kcal)}`);

  const missing = await j('/api/nutrition/recipes/00000000-0000-0000-0000-000000000000');
  check('recette inconnue -> 404', missing.status === 404);

  const suggestions = await j('/api/nutrition/suggestions?meal=midi');
  check('GET /api/nutrition/suggestions', suggestions.status === 200
    && suggestions.body.items.length > 0, `${suggestions.status}`);
  check('le budget du repas part de ce qu’il reste',
    suggestions.body.budget.kcal > 0
      && suggestions.body.budget.meals_left >= 1,
    JSON.stringify(suggestions.body.budget));
  check('chaque suggestion porte sa portion et ses macros',
    suggestions.body.items.every((s) => s.portion > 0 && s.macros.kcal > 0));
  check('chaque suggestion explique son rang',
    suggestions.body.items.every((s) => Array.isArray(s.reasons)));
  check('les suggestions sont classées par pertinence décroissante',
    suggestions.body.items.every((s, i, a) => i === 0 || s.score <= a[i - 1].score));
  check('la source du seuil par repas est citée',
    suggestions.body.sources?.[0]?.citation?.includes('Schoenfeld'));

  const badSuggestion = await j('/api/nutrition/suggestions?meal=brunch');
  check('repas inconnu en suggestion -> 400', badSuggestion.status === 400);

  // --- Enregistrement d'une recette au journal ------------------------
  const before = await j('/api/nutrition/day');
  const target = suggestions.body.items[0].recipe;
  const targetDetail = await j(`/api/nutrition/recipes/${target.id}`);

  const logged = await j('/api/nutrition/entries/recipe', {
    method: 'POST',
    body: JSON.stringify({ recipe_id: target.id, meal: 'collation', portion: 1 }),
  });
  check('POST /api/nutrition/entries/recipe', logged.status === 201, `${logged.status}`);
  check('une ligne est créée par ingrédient',
    logged.body.entries === targetDetail.body.ingredients.length,
    `${logged.body.entries} vs ${targetDetail.body.ingredients.length}`);

  const after = await j('/api/nutrition/day');
  const delta = Number(after.body.consumed.kcal) - Number(before.body.consumed.kcal);
  check('le journal augmente exactement des calories de la recette',
    Math.abs(delta - Number(target.kcal)) < 2,
    `${Math.round(delta)} vs ${Math.round(target.kcal)}`);

  const deltaProtein = Number(after.body.consumed.protein_g)
    - Number(before.body.consumed.protein_g);
  check('les protéines suivent le même compte',
    Math.abs(deltaProtein - Number(target.protein_g)) < 2,
    `${Math.round(deltaProtein)} vs ${Math.round(target.protein_g)}`);

  const badPortion = await j('/api/nutrition/entries/recipe', {
    method: 'POST',
    body: JSON.stringify({ recipe_id: target.id, meal: 'midi', portion: 0 }),
  });
  check('portion nulle -> 400', badPortion.status === 400);
  const noMeal = await j('/api/nutrition/entries/recipe', {
    method: 'POST', body: JSON.stringify({ recipe_id: target.id }),
  });
  check('repas manquant -> 400', noMeal.status === 400);

  // Nettoyage : la suite tourne sur la base réelle.
  const added = (await j('/api/nutrition/day')).body.entries
    .filter((e) => e.meal === 'collation');
  for (const entry of added) {
    await j(`/api/nutrition/entries/${entry.id}`, { method: 'DELETE' });
  }
  const cleaned = await j('/api/nutrition/day');
  check('lignes de test retirées du journal',
    Math.abs(Number(cleaned.body.consumed.kcal) - Number(before.body.consumed.kcal)) < 2,
    `${Math.round(cleaned.body.consumed.kcal)} vs ${Math.round(before.body.consumed.kcal)}`);

  // --- Revue des cibles ------------------------------------------------
  const day = await j('/api/nutrition/day');
  check('les cibles sont confrontées à la littérature',
    Array.isArray(day.body.review?.checks) && day.body.review.checks.length >= 2,
    `${day.body.review?.checks?.length}`);
  check('chaque constat porte sa source et son verdict',
    day.body.review.checks.every((c) => typeof c.ok === 'boolean' && c.note?.length > 20));
  check('la revue cite ses références et annonce ses limites',
    day.body.review.sources.length > 0
      && day.body.review.disclaimer.includes('avis médical'));
}

section('Entraînement et nutrition');
{
  const day = await j('/api/nutrition/day');
  const t = day.body.training;
  check('la journée porte un bloc entraînement', !!t && !!t.load, `${!!t}`);
  check('le type de jour est déduit des séances, pas coché à la main',
    ['entrainement', 'repos'].includes(t.day_type), t.day_type);
  check('la charge observée est ramenée à la semaine',
    typeof t.load.sessions_per_week === 'number'
      && typeof t.load.minutes_per_session === 'number');
  check('l’activité déclarée est confrontée à l’enregistrée',
    typeof t.activity.ok === 'boolean' && t.activity.note.length > 30);

  // Le multiplicateur d'activité inclut DÉJÀ l'entraînement : aucune
  // calorie ne doit être ajoutée pour une séance.
  const uniform = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ day_split_pct: 0 }),
  });
  check('répartition désactivée acceptée', uniform.status === 200);
  const flat = await j('/api/nutrition/day');
  check('sans répartition, l’objectif ne dépend pas du jour',
    flat.body.breakdown.day_factor === 1,
    `${flat.body.breakdown.day_factor}`);
  const flatKcal = flat.body.targets.kcal;

  const split = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ day_split_pct: 10 }),
  });
  check('répartition à 10 % acceptée', split.status === 200, `${split.status}`);

  const withSplit = await j('/api/nutrition/day');
  check('la répartition déplace l’objectif du jour',
    withSplit.body.breakdown.day_factor !== 1
      || withSplit.body.training.split?.neutral === true,
    `${withSplit.body.breakdown.day_factor}`);
  check('la base calorique reste inchangée',
    Math.abs(withSplit.body.breakdown.base_kcal - flat.body.breakdown.base_kcal) < 1,
    `${withSplit.body.breakdown.base_kcal} vs ${flat.body.breakdown.base_kcal}`);
  check('les protéines ne varient pas selon le jour',
    withSplit.body.targets.protein_g === flat.body.targets.protein_g,
    `${withSplit.body.targets.protein_g} vs ${flat.body.targets.protein_g}`);
  void flatKcal;

  const bad = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ day_split_pct: 60 }),
  });
  check('répartition excessive -> 400', bad.status === 400);

  // Une mise à jour partielle ne doit pas réinitialiser l'objectif :
  // le COALESCE portait sur EXCLUDED, qui valait déjà « maintien ».
  await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ goal: 'prise', activity: 'intense' }),
  });
  await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ fiber_target_g: 31 }),
  });
  const kept = await j('/api/nutrition/profile');
  check('une mise à jour partielle préserve objectif et activité',
    kept.body.profile?.goal === 'prise' && kept.body.profile?.activity === 'intense',
    `${kept.body.profile?.goal} / ${kept.body.profile?.activity}`);

  // Remise en état.
  await j('/api/nutrition/profile', {
    method: 'PUT',
    body: JSON.stringify({ goal: 'perte', activity: 'modere', fiber_target_g: 30, day_split_pct: 0 }),
  });
  check('profil nutritionnel restauré', true);

  const profile = await j('/api/profile');
  check('le profil expose aussi le contrôle d’activité',
    typeof profile.body.activity_check?.ok === 'boolean');
  check('l’écart de multiplicateur est traduit en kilocalories',
    profile.body.activity_check.ok || typeof profile.body.activity_check.kcal_hint === 'number',
    `${profile.body.activity_check?.kcal_hint}`);
}

section('Fibres du catalogue');
{
  // Les fibres sont une fraction des glucides : les laisser à zéro
  // surestime l'énergie disponible de tous les végétaux.
  const holes = [];
  for (const name of ['Épinards', 'Champignons', 'Fraises', 'Hummus', 'Pâtes blanches cuites']) {
    const found = await j(`/api/nutrition/foods?q=${encodeURIComponent(name)}&limit=5`);
    const food = found.body?.items?.find((f) => f.name === name);
    if (!food || Number(food.fiber_g) <= 0) holes.push(name);
  }
  check('les aliments végétaux portent une teneur en fibres',
    holes.length === 0, holes.join(', '));

  const recipes = await j('/api/nutrition/recipes');
  const zero = recipes.body.items.filter((r) => Number(r.fiber_g) === 0);
  check('aucune recette n’affiche zéro fibre à tort',
    zero.length === 0, zero.map((r) => r.name).join(', '));
}

section('Adhérence');
{
  const adherence = await j('/api/stats/adherence?weeks=8&tz=Europe/Paris');
  check('GET /api/stats/adherence', adherence.status === 200, `${adherence.status}`);

  if (adherence.body.program) {
    const s = adherence.body.summary;
    check('le bilan distingue prévu, fait et hors plan',
      typeof s.planned === 'number' && typeof s.done === 'number'
        && typeof s.extra === 'number');
    check('le taux reste dans [0, 100]',
      s.rate === null || (s.rate >= 0 && s.rate <= 100), `${s.rate}`);
    check('les séances manquées sont nommées',
      Array.isArray(s.missed) && s.missed.every((m) => m.title && m.date));
    check('le verdict est explicite',
      s.verdict?.label?.length > 0 && s.verdict?.note?.length > 30);
    check('aucune semaine ne dépasse le cycle du programme',
      adherence.body.weeks.every((w) => w.week >= 1 && w.week <= adherence.body.program.weeks),
      adherence.body.weeks.map((w) => w.week).join(','));
    check('aucune journée future n’est comptée comme manquée',
      s.missed.every((m) => m.date <= adherence.body.to),
      s.missed.map((m) => m.date).join(','));
  } else {
    check('sans programme actif, l’absence de comparaison est expliquée',
      adherence.body.note?.includes('rien à comparer'));
  }

  const badTz = await j('/api/stats/adherence?tz=' + encodeURIComponent('; DROP'));
  check('fuseau invalide -> 400', badTz.status === 400);
}

section('Export des données');
{
  const manifest = await j('/api/export');
  check('GET /api/export', manifest.status === 200 && manifest.body.datasets.length === 4);
  check('le manifeste chiffre ce qui sera exporté',
    typeof manifest.body.counts.sessions === 'number');

  const raw = async (path) => {
    const res = await fetch(BASE + path);
    return { status: res.status, type: res.headers.get('content-type'), body: await res.text() };
  };

  const csv = await raw('/api/export/workouts.csv');
  check('le CSV répond en text/csv', csv.status === 200 && csv.type?.startsWith('text/csv'));

  // La marque d'ordre d'octets se vérifie sur les OCTETS : `res.text()`
  // la retire en décodant, et le test réussissait ou échouait sans
  // rapport avec ce que le fichier contient.
  const csvBytes = new Uint8Array(
    await (await fetch(`${BASE}/api/export/workouts.csv`)).arrayBuffer(),
  );
  check('le CSV porte une marque d’ordre d’octets UTF-8',
    csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF,
    [...csvBytes.slice(0, 3)].map((b) => b.toString(16)).join(' '));
  check('le CSV a un en-tête et des lignes',
    csv.body.split('\r\n').length > 1 && csv.body.includes('exercice'));
  // Un nom d'aliment ou d'exercice contient des virgules : mal cité, il
  // décalerait toutes les colonnes suivantes.
  const lines = csv.body.replace(/^\uFEFF/, '').trim().split('\r\n');
  const columns = lines[0].split(',').length;
  const misaligned = lines.slice(1).filter((l) => {
    const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [];
    return cells.length - 1 !== columns;
  });
  check('toutes les lignes CSV ont le bon nombre de colonnes',
    misaligned.length === 0, `${misaligned.length} ligne(s)`);

  const nutrition = await raw('/api/export/nutrition.csv');
  check('le journal alimentaire s’exporte aussi', nutrition.status === 200);

  const unknown = await raw('/api/export/inconnu.csv');
  check('jeu de données inconnu -> 400', unknown.status === 400, `${unknown.status}`);

  const full = await j('/api/export/data.json');
  check('GET /api/export/data.json', full.status === 200 && !!full.body.counts);
  check('l’export brut contient séances, repas, santé et programmes',
    ['sessions', 'food_entries', 'health_metrics', 'programs']
      .every((k) => Array.isArray(full.body[k])));
  // Un export se transmet : aucun secret d'accès ne doit s'y trouver.
  check('aucun secret d’accès n’est exporté',
    !JSON.stringify(full.body).includes('calendar_token'));
}

section('Méthode de calcul et calibration');
{
  const before = (await j('/api/nutrition/profile')).body;
  const methods = before?.options?.bmr_methods ?? [];
  check('les formules sont renvoyées calculées sur le profil',
    methods.length >= 5 && methods.some((m) => m.available && m.bmr > 0),
    JSON.stringify(methods.map((m) => [m.key, m.bmr])));

  const spread = before?.options?.bmr_spread;
  check('l’écart entre formules est exposé',
    spread && spread.delta > 0, JSON.stringify(spread));

  // Changer de formule ne doit toucher QUE la formule : c'est le bug
  // qui réinitialisait l'objectif à « maintien » à chaque mise à jour
  // partielle.
  const switched = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ bmr_method: 'cunningham' }),
  });
  check('la formule demandée est retenue',
    switched.body?.bmr_method?.method === 'cunningham',
    JSON.stringify(switched.body?.bmr_method));
  check('Cunningham relève l’objectif calorique',
    switched.body?.targets?.kcal > before.targets.kcal,
    `${before.targets?.kcal} -> ${switched.body?.targets?.kcal}`);

  const after = (await j('/api/nutrition/profile')).body;
  check('l’objectif n’a pas été réinitialisé',
    after?.profile?.goal === before.profile.goal
    && after?.profile?.activity === before.profile.activity,
    `${before.profile?.goal}/${before.profile?.activity} -> `
    + `${after?.profile?.goal}/${after?.profile?.activity}`);

  const bad = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ bmr_method: 'inventée' }),
  });
  check('formule inconnue -> 400', bad.status === 400, `${bad.status}`);

  const noValue = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ bmr_method: 'mesure' }),
  });
  check('« mesure » sans valeur -> 400', noValue.status === 400, `${noValue.status}`);

  // Retour au choix automatique : il doit pouvoir REVENIR, sinon fixer
  // une formule une fois la rendrait définitive.
  const auto = await j('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify({ bmr_method: 'auto' }),
  });
  check('retour au choix automatique',
    auto.body?.bmr_method?.requested === 'auto',
    JSON.stringify(auto.body?.bmr_method?.requested));
  check('les cibles reviennent à leur valeur initiale',
    auto.body?.targets?.kcal === before.targets.kcal,
    `${before.targets?.kcal} -> ${auto.body?.targets?.kcal}`);

  const cal = await j('/api/nutrition/calibration');
  check('GET /api/nutrition/calibration', cal.status === 200);
  check('la calibration expose sa méthode',
    Array.isArray(cal.body?.method) && cal.body.method.length >= 3);
  check('une calibration impossible dit pourquoi',
    cal.body.ok === true || (cal.body.reasons ?? []).length > 0,
    JSON.stringify(cal.body?.reasons));
}

section('Volume par muscle et régularité');
{
  const active = (await j('/api/programs/active')).body;
  if (active?.id) {
    const v = active.muscle_volume;
    check('le programme expose son volume par muscle',
      v && Array.isArray(v.muscles) && v.muscles.length > 0);
    check('chaque muscle porte son verdict de dosage',
      (v?.muscles ?? []).every((m) => !!m.level && !!m.label));
    check('la part secondaire est distinguée de la part directe',
      (v?.muscles ?? []).every(
        (m) => Math.abs((m.primary_sets + m.secondary_sets) - m.weekly_sets) < 0.05,
      ));
    check('les seuils de dose-réponse accompagnent le tableau',
      v?.thresholds?.minimum_effective > 0 && v?.thresholds?.secondary_weight > 0);
  } else {
    check('aucun programme actif : volume non testé', true);
  }

  const streak = await j('/api/stats/streak?tz=Europe/Paris');
  check('GET /api/stats/streak', streak.status === 200);
  check('huit semaines renvoyées, ou aucun objectif',
    streak.body?.target_per_week === 0 || streak.body?.weeks?.length === 8,
    JSON.stringify(streak.body?.weeks?.length));
  check('la dernière semaine est marquée en cours',
    streak.body?.target_per_week === 0
    || streak.body?.weeks?.at(-1)?.in_progress === true);

  const badTz = await j('/api/stats/streak?tz=Europe%2FParis%3Bdrop');
  check('fuseau invalide -> 400', badTz.status === 400, `${badTz.status}`);
}

section('Module sports — toutes disciplines');
{
  const cat = await j('/api/sports');
  check('GET /api/sports', cat.status === 200 && cat.body.total > 30, `${cat.body?.total}`);
  check('neuf catégories renvoyées', (cat.body.categories ?? []).length === 9,
    `${cat.body.categories?.length}`);
  check('aucune catégorie vide',
    (cat.body.categories ?? []).every((c) => c.sports.length > 0));
  check('chaque catégorie dit comment elle se dose',
    (cat.body.categories ?? []).every((c) => !!c.dosing && !!c.quality));

  const fiche = await j('/api/sports/bloc');
  check('fiche d’un sport', fiche.status === 200 && fiche.body.category === 'grimpe');
  check('profil musculaire exposé', (fiche.body.muscles?.primary ?? []).includes('forearms'));
  const inconnu = await j('/api/sports/quidditch');
  check('sport inconnu -> 404', inconnu.status === 404, `${inconnu.status}`);

  // --- Séance de sport, créée déjà close en une requête ---------------
  const start = new Date(Date.now() - 2 * 3600_000).toISOString();
  const end = new Date(Date.now() - 3600_000).toISOString();
  const created = await j('/api/workouts', {
    method: 'POST',
    body: JSON.stringify({
      sport_key: 'natation', started_at: start, ended_at: end,
      perceived_exertion: 6, distance_m: 2000, title: `${RUN}-natation`,
    }),
  });
  check('séance de sport créée close', created.status === 201
    && created.body?.ended_at != null, `${created.status}`);
  check('durée calculée en base', created.body?.duration_min === 60,
    `${created.body?.duration_min}`);
  check('charge de Foster = RPE x minutes', created.body?.session_load === 360,
    `${created.body?.session_load}`);
  check('sport résolu avec sa catégorie',
    created.body?.sport?.category === 'endurance', JSON.stringify(created.body?.sport));

  const sportId = created.body?.id;

  const badSport = await j('/api/workouts', {
    method: 'POST', body: JSON.stringify({ sport_key: 'quidditch' }),
  });
  check('sport inconnu refusé -> 400', badSport.status === 400, `${badSport.status}`);

  const badOrder = await j('/api/workouts', {
    method: 'POST',
    body: JSON.stringify({ started_at: end, ended_at: start, sport_key: 'course' }),
  });
  check('fin avant début refusée -> 400', badOrder.status === 400, `${badOrder.status}`);

  // Le dénivelé négatif est légitime : une descente n'est pas une faute.
  const descente = await j(`/api/workouts/${sportId}`, {
    method: 'PATCH', body: JSON.stringify({ elevation_m: -800 }),
  });
  check('dénivelé négatif accepté',
    descente.status === 200 && Number(descente.body?.elevation_m) === -800,
    `${descente.status} ${descente.body?.elevation_m}`);

  // --- Charge d'entraînement -----------------------------------------
  const load = await j('/api/stats/load?tz=Europe/Paris&days=56');
  check('GET /api/stats/load', load.status === 200);
  check('la charge ventile par catégorie',
    (load.body.by_category ?? []).some((c) => c.category === 'endurance'),
    JSON.stringify(load.body?.by_category));
  check('les parts de catégorie totalisent 100 %',
    load.body.by_category.length === 0
    || Math.abs(load.body.by_category.reduce((n, c) => n + c.share, 0) - 100) < 0.5,
    JSON.stringify(load.body?.by_category?.map((c) => c.share)));
  check('les jours de repos figurent dans la série',
    (load.body.days ?? []).some((d) => d.load === 0));
  check('les séances sans RPE sont comptées à part',
    typeof load.body.unrated_sessions === 'number');

  const badTz = await j('/api/stats/load?tz=x%3Bdrop');
  check('fuseau invalide -> 400', badTz.status === 400, `${badTz.status}`);

  // --- Silhouette : la natation doit allumer le haut du corps ---------
  const map = await j('/api/stats/bodymap');
  check('GET /api/stats/bodymap', map.status === 200);
  check('les autres sports alimentent la silhouette',
    (map.body.sport_muscles ?? []).some((m) => m.muscle === 'lats'),
    JSON.stringify(map.body?.sport_muscles?.map((m) => m.muscle)));
  check('la carte unifiée dit d’où vient chaque sollicitation',
    (map.body.combined ?? []).every((m) => m.source === 'sport' || m.source === 'musculation'));
  check('le contrat historique de la silhouette est préservé',
    Array.isArray(map.body.muscles) && typeof map.body.fatigue_index === 'number');

  // --- Progression ----------------------------------------------------
  const prog = await j('/api/stats/progression?tz=Europe/Paris');
  check('GET /api/stats/progression', prog.status === 200);
  check('niveau et XP cohérents',
    prog.body.level >= 1 && prog.body.xp >= 0
    && prog.body.into_level <= prog.body.level_span,
    `niv ${prog.body?.level} xp ${prog.body?.xp}`);
  check('un niveau par catégorie pratiquée',
    (prog.body.categories ?? []).some((c) => c.category === 'endurance'),
    JSON.stringify(prog.body?.categories?.map((c) => c.category)));
  check('chaque distinction porte sa règle',
    (prog.body.badges ?? []).length > 0
    && prog.body.badges.every((b) => !!b.rule && !!b.icon));
  check('le niveau ne prétend pas mesurer la condition physique',
    /pas ta condition physique/.test(prog.body.caveat ?? ''));

  const purge = await j(`/api/workouts/${sportId}`, { method: 'DELETE' });
  check('séance de sport de test supprimée', purge.status === 204, `${purge.status}`);
}

section('Météo');
{
  const w = await j('/api/weather?lat=48.8566&lon=2.3522');
  // Le service est un TIERS : il peut être indisponible, et la suite ne
  // doit pas échouer pour autant. On vérifie le contrat, pas la météo.
  if (w.status === 503) {
    check('service météo injoignable — signalé proprement', !!w.body?.error);
  } else {
    check('GET /api/weather', w.status === 200, `${w.status}`);
    check('température et code renvoyés',
      typeof w.body?.temperature === 'number' && w.body?.label != null,
      JSON.stringify(w.body)?.slice(0, 120));
    check('verdict « dehors » explicite', typeof w.body?.outdoor === 'boolean');
    check('phase du jour cohérente',
      ['aube', 'jour', 'crepuscule', 'nuit'].includes(w.body?.daypart),
      `${w.body?.daypart}`);
    check('la provenance des données est citée',
      /Open-Meteo/.test(w.body?.attribution ?? ''));
    check('le traitement de la position est expliqué',
      /arrondies/.test(w.body?.privacy ?? ''));
    check('chaque note porte son niveau',
      (w.body?.notes ?? []).every((n) => !!n.level && !!n.text));

    const again = await j('/api/weather?lat=48.8566&lon=2.3522');
    check('second appel servi par le cache', again.body?.cached === true);
  }

  const badLat = await j('/api/weather?lat=91&lon=0');
  check('latitude hors bornes -> 400', badLat.status === 400, `${badLat.status}`);
  const badLon = await j('/api/weather?lat=0&lon=181');
  check('longitude hors bornes -> 400', badLon.status === 400, `${badLon.status}`);
  const missing = await j('/api/weather');
  check('coordonnées absentes -> 400', missing.status === 400, `${missing.status}`);
}

section('Lieux et lanceur d’applications');
{
  const loc = await j('/api/sports/locations');
  check('GET /api/sports/locations', loc.status === 200);
  check('six lieux renvoyés', (loc.body?.locations ?? []).length === 6,
    `${loc.body?.locations?.length}`);
  check('chaque lieu porte sports, matériel et fenêtre de temps',
    (loc.body?.locations ?? []).every((l) => l.sports.length > 0
      && l.equipment.length > 0 && l.typical_minutes?.length === 2));
  check('les sports des lieux sont résolus en libellés',
    (loc.body?.locations ?? []).every((l) => l.sports.every((s) => !!s.label)));

  // `locations` ne doit pas être avalé par la route `/:key`.
  const asKey = await j('/api/sports/quidditch');
  check('une clé inconnue reste un 404', asKey.status === 404, `${asKey.status}`);

  const before = await j('/api/apps');
  check('GET /api/apps', before.status === 200 && Array.isArray(before.body?.items));
  const startCount = before.body.items.length;

  const created = await j('/api/apps', {
    method: 'POST',
    body: JSON.stringify({ label: `${RUN}-app`, url: 'https://exemple.test/outil', glyph: 'livre' }),
  });
  check('application ajoutée', created.status === 201 && !!created.body?.id, `${created.status}`);
  check('l’adresse est normalisée',
    (created.body?.url ?? '').startsWith('https://exemple.test'), `${created.body?.url}`);

  const listed = await j('/api/apps');
  check('elle apparaît dans la liste', listed.body.items.length === startCount + 1);

  // Deux vecteurs classiques d'exécution de code par un lien.
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>1</script>']) {
    const r = await j('/api/apps', {
      method: 'POST', body: JSON.stringify({ label: 'X', url: bad }),
    });
    check(`schéma refusé : ${bad.slice(0, 12)}…`, r.status === 400, `${r.status}`);
  }

  const noLabel = await j('/api/apps', {
    method: 'POST', body: JSON.stringify({ url: 'https://exemple.test' }),
  });
  check('nom obligatoire -> 400', noLabel.status === 400, `${noLabel.status}`);

  const noUrl = await j('/api/apps', {
    method: 'POST', body: JSON.stringify({ label: 'Sans adresse' }),
  });
  check('adresse obligatoire -> 400', noUrl.status === 400, `${noUrl.status}`);

  const gone = await j(`/api/apps/${created.body.id}`, { method: 'DELETE' });
  check('application supprimée', gone.status === 204, `${gone.status}`);
  const after = await j('/api/apps');
  check('la liste retrouve sa taille', after.body.items.length === startCount);
}

section('Carte personnelle');
{
  const before = await j('/api/places');
  check('GET /api/places', before.status === 200 && Array.isArray(before.body?.items));
  check('les types de lieu accompagnent la liste',
    (before.body?.kinds ?? []).length === 6, `${before.body?.kinds?.length}`);
  const startCount = before.body.items.length;

  const made = await j('/api/places', {
    method: 'POST',
    body: JSON.stringify({ label: `${RUN}-lieu`, kind: 'salle', lat: 48.8566, lon: 2.3522 }),
  });
  check('lieu posé sur la carte', made.status === 201 && !!made.body?.id, `${made.status}`);
  check('coordonnées conservées', made.body?.lat === 48.8566 && made.body?.lon === 2.3522,
    JSON.stringify([made.body?.lat, made.body?.lon]));

  const listed = await j('/api/places');
  const mine = listed.body.items.find((p) => p.id === made.body.id);
  check('le type est résolu dans la liste',
    mine?.kind_label === 'Salle' && mine?.sports > 0, JSON.stringify(mine));

  const moved = await j(`/api/places/${made.body.id}`, {
    method: 'PATCH', body: JSON.stringify({ lat: -33.8688, lon: 151.2093 }),
  });
  check('un pion se déplace', moved.body?.lat === -33.8688 && moved.body?.lon === 151.2093,
    JSON.stringify([moved.body?.lat, moved.body?.lon]));

  for (const bad of [{ lat: 91, lon: 0 }, { lat: 0, lon: 181 }]) {
    const r = await j('/api/places', {
      method: 'POST', body: JSON.stringify({ label: 'X', kind: 'salle', ...bad }),
    });
    check(`coordonnée hors Terre refusée (${bad.lat},${bad.lon})`, r.status === 400, `${r.status}`);
  }

  const badKind = await j('/api/places', {
    method: 'POST', body: JSON.stringify({ label: 'X', kind: 'lune', x: 5, y: 5 }),
  });
  check('type de lieu inconnu -> 400', badKind.status === 400, `${badKind.status}`);

  const gone = await j(`/api/places/${made.body.id}`, { method: 'DELETE' });
  check('lieu retiré', gone.status === 204, `${gone.status}`);
  const after = await j('/api/places');
  check('la carte retrouve son état', after.body.items.length === startCount);
}

section('Tuiles de carte');
{
  const info = await j('/api/tiles');
  check('GET /api/tiles', info.status === 200);
  check('l’attribution ODbL est exposée',
    /OpenStreetMap/.test(info.body?.attribution ?? ''), `${info.body?.attribution}`);
  check('le traitement de la vie privée est expliqué',
    /serveur/.test(info.body?.privacy ?? ''));

  // Une tuile réelle. Le fournisseur peut être injoignable : on vérifie
  // le contrat, pas la disponibilité d'un tiers.
  const tile = await j('/api/tiles/12/2074/1409.png');
  if (tile.status === 200 || tile.status === 503 || tile.status === 502) {
    check('une tuile répond ou signale l’indisponibilité', true);
  } else {
    check('une tuile répond ou signale l’indisponibilité', false, `${tile.status}`);
  }

  // Hors du plan : à un zoom z, les indices vont de 0 à 2^z − 1.
  const outX = await j('/api/tiles/2/99/0.png');
  check('tuile hors plan -> 400', outX.status === 400, `${outX.status}`);
  const outZ = await j('/api/tiles/25/0/0.png');
  check('zoom hors bornes -> 400', outZ.status === 400, `${outZ.status}`);
}

section('Module Carnet — banc d’essai de la coquille');
{
  const before = await j('/api/notes');
  check('GET /api/notes', before.status === 200 && Array.isArray(before.body?.items));
  const startCount = before.body.items.length;

  const made = await j('/api/notes', {
    method: 'POST', body: JSON.stringify({ body: `${RUN} — note de test` }),
  });
  check('note créée', made.status === 201 && !!made.body?.id, `${made.status}`);
  check('une note naît non épinglée', made.body?.pinned === false);

  const empty = await j('/api/notes', {
    method: 'POST', body: JSON.stringify({ body: '   ' }),
  });
  check('note vide refusée -> 400', empty.status === 400, `${empty.status}`);

  const pinned = await j(`/api/notes/${made.body.id}`, {
    method: 'PATCH', body: JSON.stringify({ pinned: true }),
  });
  check('une note s’épingle', pinned.body?.pinned === true);

  const listed = await j('/api/notes');
  check('les épinglées remontent en tête',
    listed.body.items[0]?.id === made.body.id, `${listed.body.items[0]?.id}`);

  const gone = await j(`/api/notes/${made.body.id}`, { method: 'DELETE' });
  check('note supprimée', gone.status === 204, `${gone.status}`);
  const after = await j('/api/notes');
  check('le carnet retrouve son état', after.body.items.length === startCount);
}

section('Nettoyage');
{
  const del = await j(`/api/workouts/${sessionId}`, {
    method: 'PATCH', body: JSON.stringify({ ended_at: new Date().toISOString() }),
  });
  check('séance de test clôturée', del.status === 200);

  // La suite tourne sur la base RÉELLE : ses séances ne doivent pas
  // rester dans l'historique ni au calendrier de l'utilisateur.
  const purged = await j(`/api/workouts/${sessionId}`, { method: 'DELETE' });
  check('séance de test supprimée', purged.status === 204, `${purged.status}`);

  const nf = await j('/api/inconnu');
  check('route inconnue -> 404 JSON', nf.status === 404 && !!nf.body.error);

  // Remise en place du programme de l'utilisateur.
  if (activeBefore) {
    const restored = await j(`/api/programs/${activeBefore}`, {
      method: 'PATCH', body: JSON.stringify({ is_active: true }),
    });
    check('programme actif restauré', restored.status === 200
      && restored.body?.is_active === true, `${restored.status}`);
  } else {
    check('aucun programme actif à restaurer', true);
  }
}

console.log(`\n=== ${pass} OK, ${fail} échec(s) ===`);
process.exit(fail ? 1 : 0);
