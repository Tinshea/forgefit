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

  await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: 250 }) });
  const r = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: 500 }) });
  check('cumul +750 ml', Number(r.body?.total_ml) === start + 750,
    `${start} -> ${r.body?.total_ml}`);

  const undo = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: -750 }) });
  check('annulation ramène au point de départ', Number(undo.body?.total_ml) === start);

  const bad = await j('/api/health/hydration', { method: 'POST', body: JSON.stringify({ amount_ml: 99999 }) });
  check('quantité hors bornes rejetée', bad.status === 400);
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
}

section('CORS (écritures depuis le navigateur)');
{
  // Le navigateur envoie `Origin` sur TOUTE écriture, y compris
  // same-origin, et le proxy Vite le transmet tel quel (`changeOrigin`
  // ne réécrit que `Host`). Une suite qui n'envoie pas cet en-tête ne
  // voit jamais le problème — les lectures passent, les écritures non.
  const postFrom = (origin) => fetch(`${BASE}/api/workouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ title: `${RUN}-cors` }),
  });

  // Une origine étrangère est refusée, et le refus ÉNUMÈRE les origines
  // acceptées. On s'en sert pour tester la configuration réelle de
  // l'instance plutôt que des ports codés en dur : le développement
  // autorise 5173, la production non — et les deux sont corrects.
  const evil = await postFrom('https://evil.example.com');
  const evilBody = await evil.json().catch(() => null);
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
}

section('Nettoyage');
{
  const del = await j(`/api/workouts/${sessionId}`, {
    method: 'PATCH', body: JSON.stringify({ ended_at: new Date().toISOString() }),
  });
  check('séance de test clôturée', del.status === 200);

  const nf = await j('/api/inconnu');
  check('route inconnue -> 404 JSON', nf.status === 404 && !!nf.body.error);
}

console.log(`\n=== ${pass} OK, ${fail} échec(s) ===`);
process.exit(fail ? 1 : 0);
