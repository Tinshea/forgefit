#!/usr/bin/env node
// Contrôle MULTI-MOTEURS.
//
// ┌─ POURQUOI CE SCRIPT EXISTE ───────────────────────────────────────┐
// │ Tout le travail visuel a été mesuré dans un seul moteur, Blink.   │
// │ `check:screens` le pilote par CDP et ne peut donc rien dire de    │
// │ Gecko ni de WebKit — or c'est WebKit qui rend l'application sur   │
// │ iPhone, où elle est censée vivre.                                 │
// │                                                                    │
// │ On ouvre ici CHAQUE route dans les trois moteurs et on vérifie ce │
// │ qui casse silencieusement de l'un à l'autre : une erreur de       │
// │ script, une page vide, un débordement horizontal, une barre       │
// │ collante qui décroche.                                            │
// └────────────────────────────────────────────────────────────────────┘
//
//   npm run check:browsers
//   BASE=http://localhost:8080 npm run check:browsers

import { chromium, firefox, webkit } from 'playwright';
import { allRoutes } from '../src/lib/navigation.js';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const ECRANS = [{ hub: true }, ...allRoutes()];
const MOTEURS = [['Chromium', chromium], ['Firefox', firefox], ['WebKit', webkit]];

let problemes = 0;
const fail = (m) => { console.log(`  ÉCHEC  ${m}`); problemes += 1; };

/**
 * Empreinte de disposition.
 *
 * Un écran peut se charger sans erreur dans les trois moteurs et n'y
 * ressembler à rien de commun. On relève donc quelques grandeurs qui
 * doivent concorder, et on les compare d'un moteur à l'autre : une
 * barre deux fois plus haute ou une carte deux fois plus étroite
 * signale une propriété comprise différemment.
 *
 * ┌─ LA TOLÉRANCE DOIT ÊTRE PROPORTIONNELLE ────────────────────────┐
 * │ Une première version comparait à 3 px près et signalait vingt-   │
 * │ trois « divergences ». Presque toutes étaient du bruit : les     │
 * │ moteurs n'ont pas exactement les mêmes métriques de police, et   │
 * │ l'écart s'ACCUMULE ligne après ligne. Trente pixels sur une page │
 * │ de cinq mille ne disent rien ; cinquante sur une carte de        │
 * │ quatre cents disent que quelque chose n'est pas compris pareil.  │
 * │                                                                   │
 * │ Seuil : 8 px, ou 4 % de la grandeur — le plus grand des deux.    │
 * └───────────────────────────────────────────────────────────────────┘
 */
const EMPREINTE = `(() => {
  // ┌─ NEUTRALISER content-visibility AVANT DE MESURER ─────────────┐
  // │ Les listes longues sautent la mise en page de ce qui est hors │
  // │ écran et réservent la place d'après contain-intrinsic-size.   │
  // │ La hauteur totale d'une page compte donc des ESTIMATIONS, que │
  // │ chaque moteur fait à sa façon : le calendrier mesurait 1468   │
  // │ dans Blink et 1224 dans Gecko, pour un rendu identique.       │
  // │                                                                │
  // │ On force le rendu complet le temps de la mesure : ce qu'on    │
  // │ compare est alors la mise en page réelle, pas l'estimation.   │
  // └────────────────────────────────────────────────────────────────┘
  //
  // La neutralisation vise les SEULS sélecteurs qui déclarent la
  // propriété. Une première version l'appliquait à « * » : dans Blink,
  // cela raccourcissait l'Aperçu de 400 px et fabriquait la divergence
  // qu'elle prétendait mesurer.
  const st = document.createElement('style');
  st.textContent = '.exercise-list > li, .cal-day, .badge, .note, .session-row,'
    + '.sport-chip, .category-card, .muscle-table tbody tr'
    + '{content-visibility:visible !important}';
  document.head.appendChild(st);
  document.body.offsetHeight;

  const boite = (sel) => { const e = document.querySelector(sel);
    if (!e) return null; const r = e.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height), Math.round(r.top)]; };
  return {
    'barre haute': boite('.topbar'),
    'zone de contenu': boite('main.content'),
    'première carte': boite('.card, .constellation'),
    'sous-navigation': boite('.subnav'),
  };
})()`;


const tolerance = (valeur) => Math.max(8, Math.abs(valeur) * 0.04);
const empreintes = new Map();

/**
 * Ce qu'on mesure une fois la page posée. Doit rester vrai partout.
 *
 * Le débordement se constate en TENTANT DE DÉFILER, jamais en comparant
 * `scrollWidth` à `clientWidth` : cette différence compte les couches
 * décoratives, plus larges que l'écran par construction, et signale un
 * débordement là où la main ne peut rien faire bouger.
 */
const SONDE = `(() => {
  window.scrollTo(200, 0);
  const debordeVraiment = window.scrollX !== 0;
  window.scrollTo(0, 0);

  // La barre haute est COLLANTE : au repos elle peut être précédée
  // d'un bandeau légitime, et sa position n'apprend rien. Ce qui se
  // vérifie, c'est qu'elle remonte à zéro une fois la page défilée —
  // le contraire trahit un conteneur de défilement créé par mégarde.
  window.scrollTo(0, 400);
  const topbarApresDefilement = document.querySelector('.topbar')
    ?.getBoundingClientRect().top ?? null;
  window.scrollTo(0, 0);

  const main = document.querySelector('main');
  return {
    texte: (main ?? document.body).innerText.trim().length,
    debordeVraiment,
    // Une barre collante qui décroche au défilement est le symptôme
    // classique d'un conteneur de défilement créé par inadvertance.
    topbarHaut: topbarApresDefilement,
  };
})()`;

for (const [nom, moteur] of MOTEURS) {
  const navigateur = await moteur.launch();
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 860 } });

  const erreurs = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(`exception : ${e.message}`));

  console.log(`\n=== ${nom} ===`);
  let ok = 0;

  for (const route of ECRANS) {
    const url = route.hub ? `${BASE}/#/hub` : `${BASE}/#/${route.section}/${route.page}`;
    const label = route.hub ? 'hub' : `${route.section}/${route.page}`;
    erreurs.length = 0;

    // Rechargement franc : changer le seul fragment ne recharge pas.
    await page.goto('about:blank');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2600);

    const r = await page.evaluate(SONDE);
    const soucis = [];
    if (r.texte < 40) soucis.push(`écran quasi vide (${r.texte} caractères)`);
    if (r.debordeVraiment) soucis.push('défilement horizontal');
    if (r.topbarHaut !== null && Math.abs(r.topbarHaut) > 1) {
      soucis.push(`barre haute décollée : ${Math.round(r.topbarHaut)}px après défilement`);
    }
    // Un échec réseau n'est pas du ressort du moteur de rendu.
    const vraies = erreurs.filter((e) => !/Failed to load resource|NetworkError|net::/i.test(e));
    if (vraies.length) soucis.push(`console : ${vraies.slice(0, 2).join(' | ')}`);

    if (soucis.length) fail(`${label} — ${soucis.join(' ; ')}`);
    else ok += 1;

    const emp = await page.evaluate(EMPREINTE);
    if (!empreintes.has(label)) empreintes.set(label, {});
    empreintes.get(label)[nom] = emp;
  }

  console.log(`  ${ok}/${ECRANS.length} écrans sains`);
  await navigateur.close();
}

console.log('\n=== Concordance des dispositions ===');
{
  let divergences = 0;
  for (const [label, parMoteur] of empreintes) {
    const noms = Object.keys(parMoteur);
    const reference = parMoteur[noms[0]];
    for (const piece of Object.keys(reference)) {
      const valeurs = noms.map((n) => [n, parMoteur[n][piece]]);
      // Une pièce absente partout n'est pas une divergence : toutes
      // les routes n'ont pas de sous-navigation.
      if (valeurs.every(([, v]) => v === null)) continue;
      if (valeurs.some(([, v]) => v === null)) {
        const manquants = valeurs.filter(([, v]) => v === null).map(([n]) => n);
        fail(`${label} · ${piece} — absente de ${manquants.join(', ')}`);
        divergences += 1;
        continue;
      }
      for (let i = 0; i < 3; i += 1) {
        const nums = valeurs.map(([, v]) => v[i]);
        const ecart = Math.max(...nums) - Math.min(...nums);
        if (ecart > tolerance(Math.max(...nums))) {
          const dims = ['largeur', 'hauteur', 'haut'][i];
          fail(`${label} · ${piece} — ${dims} : `
            + valeurs.map(([n, v]) => `${n} ${v[i]}px`).join(', ')
            + ` (écart ${ecart}px)`);
          divergences += 1;
        }
      }
    }
  }
  if (!divergences) {
    console.log(`  ok     les ${empreintes.size} écrans se disposent pareil dans les trois moteurs`);
  }
}

console.log(problemes
  ? `\n=== ${problemes} PROBLÈME(S) MULTI-MOTEURS ===`
  : `\n=== TROIS MOTEURS VALIDES — ${ECRANS.length} écrans chacun ===`);
process.exit(problemes ? 1 : 0);
