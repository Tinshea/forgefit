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

// Le hub n'est pas une page de module : il n'apparait donc pas dans
// `allRoutes()`, qui enumere les couples section/page. Il se rend
// pourtant comme les autres, et doit etre verifie comme les autres.
const ECRANS = [{ hub: true }, ...allRoutes()];

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

// ┌─ ON VERIFIE A LA LARGEUR D'UN TELEPHONE ─────────────────────────┐
// │ C'est la taille a laquelle cette application est REELLEMENT       │
// │ utilisee. Le navigateur sans tete ouvre bien plus large, et un    │
// │ debordement de mise en page y disparait : de la place, tout       │
// │ tient, rien ne se plaint. Le defaut n'apparaissait qu'a l'usage.  │
// │                                                                    │
// │ 390 x 844 : l'iPhone de reference, celui de la plus petite        │
// │ largeur courante.                                                 │
// └────────────────────────────────────────────────────────────────────┘
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});

const failures = [];

for (const route of ECRANS) {
  const url = route.hub ? `${BASE}/#/hub` : `${BASE}/#/${route.section}/${route.page}`;
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

  // ┌─ POURQUOI LE DEBORDEMENT HORIZONTAL EST UNE PANNE ──────────────┐
  // │ Trouve par l'usage, pas par ce script : sur l'ecran Sante, une  │
  // │ URL insecable elargissait la page a 649 px pour 390 px d'ecran. │
  // │ Et `html { overflow-x: clip }` ROGNE ce debordement au lieu de  │
  // │ le laisser defiler — donc la fin de l'adresse, qui portait le   │
  // │ jeton, etait a la fois invisible et inatteignable.              │
  // │                                                                  │
  // │ Rien ne le signalait : aucune erreur console, l'ecran rendait   │
  // │ son texte, les trois moteurs s'accordaient sur la meme mise en  │
  // │ page fautive. Un contenu hors champ n'est pas une exception,    │
  // │ c'est une MESURE — il faut donc le mesurer.                     │
  // │                                                                  │
  // │ LA TOLERANCE EST DE 12 px, ET CE N'EST PAS UN CHIFFRE ROND.     │
  // │ La direction artistique fait DELIBEREMENT deborder les cartes :  │
  // │ `.grid > .card:nth-child(even)` porte `margin-right: -6px`, et   │
  // │ la legere rotation ajoute un ou deux pixels. Un ecran sain       │
  // │ mesure donc jusqu'a 8 px de trop, par choix.                     │
  // │                                                                  │
  // │ 12 px passe au-dessus de ce debord assume et reste tres en       │
  // │ dessous d'une vraie rupture : les deux defauts reels trouves     │
  // │ mesuraient 261 et 987 px de trop. Mettre 2 px aurait signale     │
  // │ quatre ecrans sains en permanence, et un controle qui crie tout  │
  // │ le temps finit par etre ignore.                                  │
  // │                                                                  │
  // │ ATTENTION A `innerWidth` : en emulation mobile, la fenetre       │
  // │ VISUELLE s'elargit pour englober le debordement. Sur l'ecran     │
  // │ fautif elle rapportait 651 px pour 651 px de contenu, et la      │
  // │ comparaison ne se declenchait JAMAIS : un controle toujours      │
  // │ vert, donc pire qu'aucun controle. C'est `clientWidth` de        │
  // │ l'element racine qu'il faut — la fenetre de MISE EN PAGE, qui    │
  // │ reste a 390 px.                                                  │
  // └──────────────────────────────────────────────────────────────────┘
  const large = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({ doc: document.documentElement.scrollWidth,'
      + ' vue: document.documentElement.clientWidth })',
    returnByValue: true,
  });
  const { doc, vue } = JSON.parse(large.result?.value ?? '{"doc":0,"vue":0}');

  const problems = [...new Set(collected)];
  if (length < MIN_TEXT_CHARS) {
    problems.push(`écran quasi vide (${length} caractères rendus)`);
  }
  if (doc > vue + 12) {
    problems.push(`débordement horizontal : ${doc} px de contenu pour ${vue} px d'écran`
      + ' — le contenu au-delà est rogné, donc illisible et inatteignable');
  }

  const name = route.hub ? 'hub' : `${route.section}/${route.page}`;
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
  console.error(`\n${failures.length} écran(s) en échec sur ${ECRANS.length}.`);
  process.exit(1);
}
console.log(`\nÉCRANS VALIDES — ${ECRANS.length} routes, aucune erreur console.`);
