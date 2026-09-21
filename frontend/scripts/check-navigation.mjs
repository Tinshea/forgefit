// Vérifie la cohérence de la navigation.
//
//   npm run check:nav
//
// Une page orpheline (déclarée sans composant, ou l'inverse) ne casse
// aucun build : elle produit un onglet qui ouvre du vide. Ce contrôle
// compare la structure déclarée au câblage réel de App.jsx.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECTIONS, findRoute, parseHash, toHash, defaultRoute, allRoutes,
} from '../src/lib/navigation.js';
import { MODULES, keyCollisions } from '../src/lib/modules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let problems = 0;
const fail = (m) => { console.log(`  ÉCHEC  ${m}`); problems += 1; };
const ok = (m) => console.log(`  ok     ${m}`);

console.log('\n=== Structure ===');
{
  const sectionKeys = SECTIONS.map((s) => s.key);
  const dupSections = sectionKeys.filter((k, i) => sectionKeys.indexOf(k) !== i);
  if (dupSections.length) fail(`sections en double : ${dupSections.join(', ')}`);
  else ok(`${SECTIONS.length} sections, clés uniques`);

  const pageKeys = allRoutes().map((r) => r.page);
  const dupPages = pageKeys.filter((k, i) => pageKeys.indexOf(k) !== i);
  // Les clés de page servent d'index dans la table des composants :
  // un doublon ferait pointer deux onglets sur le même écran.
  if (dupPages.length) fail(`clés de page en double : ${dupPages.join(', ')}`);
  else ok(`${pageKeys.length} pages, clés uniques`);

  for (const s of SECTIONS) {
    if (!s.pages.length) fail(`section « ${s.label} » sans page`);
    if (!s.icon) fail(`section « ${s.label} » sans pictogramme (barre basse mobile)`);
    for (const p of s.pages) {
      if (!p.hint) fail(`page « ${p.label} » sans description`);
    }
  }
  if (!problems) ok('chaque section a un pictogramme, chaque page une description');

  // Une barre basse au-delà de cinq entrées devient illisible sur un
  // téléphone : chaque cible passe sous la largeur du pouce.
  if (SECTIONS.length > 5) {
    fail(`${SECTIONS.length} sections — au-delà de 5, la barre basse mobile sature`);
  } else {
    ok(`${SECTIONS.length} sections tiennent dans la barre basse`);
  }
}

console.log('\n=== Câblage des composants ===');
{
  const app = fs.readFileSync(path.join(here, '..', 'src', 'App.jsx'), 'utf8');
  const block = app.match(/const PAGES = \{([\s\S]*?)\};/);
  if (!block) {
    fail('table PAGES introuvable dans App.jsx');
  } else {
    const wired = [...block[1].matchAll(/^\s*([\w-]+)\s*:/gm)].map((m) => m[1]);
    const declared = allRoutes().map((r) => r.page);

    const missing = declared.filter((k) => !wired.includes(k));
    const orphan = wired.filter((k) => !declared.includes(k));

    if (missing.length) fail(`pages déclarées sans composant : ${missing.join(', ')}`);
    else ok('toutes les pages déclarées ont un composant');

    if (orphan.length) fail(`composants câblés hors navigation : ${orphan.join(', ')}`);
    else ok('aucun composant orphelin');

    // Chaque composant importé doit exister sur le disque.
    for (const m of app.matchAll(/from '\.\/pages\/([\w]+\.jsx)'/g)) {
      const file = path.join(here, '..', 'src', 'pages', m[1]);
      if (!fs.existsSync(file)) fail(`page importée mais absente : ${m[1]}`);
    }
  }
}

console.log('\n=== Routage ===');
{
  for (const r of allRoutes()) {
    const round = parseHash(toHash(r));
    if (!round || round.section !== r.section || round.page !== r.page) {
      fail(`aller-retour d’URL cassé pour ${toHash(r)}`);
    }
  }
  ok('toutes les routes survivent à un aller-retour d’URL');

  // Une URL périmée ou tronquée doit atterrir quelque part de sensé,
  // pas sur un écran blanc.
  const partial = parseHash('#/nutrition');
  if (partial?.page !== 'journal') fail('une URL sans page ne retombe pas sur la première');
  else ok('URL sans page → première page de la section');

  if (parseHash('#/inexistant/xyz') !== null) fail('une section inconnue devrait être rejetée');
  else ok('section inconnue rejetée');

  if (parseHash('') !== null || parseHash(null) !== null) fail('fragment vide mal géré');
  else ok('fragment vide géré');

  const unknownPage = parseHash('#/progression/nimportequoi');
  if (unknownPage?.page !== 'apercu') fail('une page inconnue devrait retomber sur la première');
  else ok('page inconnue → première page de la section');

  for (const [isDesktop, expected] of [[true, 'progression'], [false, 'entrainement']]) {
    const d = defaultRoute(isDesktop);
    if (d.section !== expected) {
      fail(`route par défaut ${isDesktop ? 'desktop' : 'mobile'} : ${d.section}`);
    }
    if (!findRoute(d.section, d.page)) fail('route par défaut invalide');
  }
  ok('routes par défaut valides et adaptées au contexte');
}

console.log('\n=== Modules ===');
{
  if (MODULES.length > 0) ok('au moins un module déclaré');
  else fail('aucun module déclaré');

  const complete = MODULES.every((m) => m.label && m.glyph && m.sections.length > 0);
  if (complete) ok('chaque module a libellé, pictogramme et sections');
  else fail('un module est incomplet');

  // L'URL est `#/section/page` et ne porte PAS le module : deux
  // sections homonymes dans deux modules produiraient la même adresse,
  // et l'une des deux deviendrait inatteignable. Ce contrôle est la
  // seule chose qui empêche cette collision silencieuse.
  const collisions = keyCollisions();
  if (collisions.length === 0) ok('aucune collision de clé entre modules');
  else fail(`collisions de clés : ${collisions.join(' | ')}`);
}

console.log(problems ? `\n=== ${problems} PROBLÈME(S) ===` : '\n=== NAVIGATION VALIDE ===');
process.exit(problems ? 1 : 0);
