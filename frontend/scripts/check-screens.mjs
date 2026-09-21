// Ouvre CHAQUE écran de l'application et échoue à la moindre erreur.
//
// ┌─ POURQUOI CE CONTRÔLE EXISTE ─────────────────────────────────────┐
// │ La page « Aliments » est restée entièrement blanche sans que rien │
// │ ne le signale : `FoodCard.jsx` appelait `round1` sans l'importer. │
// │                                                                    │
// │ Aucun garde-fou existant ne pouvait l'attraper :                  │
// │   — le build réussit, un identifiant libre est une variable       │
// │     globale légitime jusqu'à l'exécution ;                        │
// │   — `check:nav` vérifie les ROUTES, pas ce qu'elles rendent ;     │
// │   — les tests backend ne chargent aucun composant.                │
// │                                                                    │
// │ Le seul juge fiable est le navigateur. Ce script l'interroge :    │
// │ il ouvre chaque route, attend le rendu, et refuse toute erreur    │
// │ console, toute exception, et tout écran vide.                     │
// └────────────────────────────────────────────────────────────────────┘
//
// Prérequis : la pile tourne, et un navigateur écoute sur le port de
// débogage. Voir README, section « Vérifier les écrans ».

import { allRoutes } from '../src/lib/navigation.js';

const BASE = process.env.FORGEFIT_URL ?? 'http://localhost:8080';
const CDP = process.env.CDP_URL ?? 'http://127.0.0.1:9222';
// En dessous, une page « chargée » n'est qu'un cadre vide : c'est
// précisément le symptôme qu'on traque.
const MIN_TEXT_CHARS = 40;

let targets;
try {
  targets = await (await fetch(`${CDP}/json/list`)).json();
} catch {
  console.error(
    `Aucun navigateur en écoute sur ${CDP}.\n`
    + 'Lance par exemple :\n'
    + '  chromium --headless=new --remote-debugging-port=9222 about:blank',
  );
  process.exit(2);
}

const page = targets.find((t) => t.type === 'page');
if (!page) {
  console.error('Navigateur joignable, mais aucun onglet ouvert.');
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
let collected = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? m.error);
    pending.delete(m.id);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    collected.push(m.params.args
      .map((a) => a.value ?? a.description ?? '')
      .join(' ')
      .split('\n')[0]);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    collected.push((d.exception?.description ?? d.text).split('\n')[0]);
  }
};

const send = (method, params = {}) => new Promise((resolve) => {
  seq += 1;
  pending.set(seq, resolve);
  ws.send(JSON.stringify({ id: seq, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => { ws.onopen = r; });
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
// Sans cela, le navigateur ressert le bundle précédent et le contrôle
// porterait sur du code qui n'est plus déployé.
await send('Network.setCacheDisabled', { cacheDisabled: true });

const failures = [];

for (const route of allRoutes()) {
  const url = `${BASE}/#/${route.section}/${route.page}`;
  collected = [];

  // Passage par about:blank : naviguer vers la même URL à un fragment
  // près ne recharge PAS une application à routage par ancre.
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(250);
  await send('Page.navigate', { url });
  await sleep(3200);

  const probe = await send('Runtime.evaluate', {
    expression: '(document.querySelector("main") ?? document.body).innerText.trim().length',
    returnByValue: true,
  });
  const length = probe.result?.value ?? 0;

  const problems = [...new Set(collected)];
  if (length < MIN_TEXT_CHARS) {
    problems.push(`écran quasi vide (${length} caractères rendus)`);
  }

  const name = `${route.section}/${route.page}`;
  if (problems.length) {
    failures.push({ name, problems });
    console.log(`✗ ${name}`);
    for (const p of problems) console.log(`    ${p}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

ws.close();

if (failures.length) {
  console.error(`\n${failures.length} écran(s) en échec sur ${allRoutes().length}.`);
  process.exit(1);
}
console.log(`\nÉCRANS VALIDES — ${allRoutes().length} routes, aucune erreur console.`);
