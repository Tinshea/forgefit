// Le hub — DONNÉES PURES.
//
// ┌─ CE QUI SE TROUVE AU-DESSUS DES MODULES ──────────────────────────┐
// │ Un module est une application : ForgeFit, le Carnet. Une          │
// │ CONSTELLATION est un domaine de vie, et elle survit au module qui │
// │ l'occupe — « Corps » existerait même si ForgeFit disparaissait.   │
// │                                                                    │
// │ C'est pour cela que la catégorie n'est pas déclarée ici module par │
// │ module : les quatre domaines sont posés d'abord, et les modules    │
// │ viennent s'y loger. Deux restent vides, et le disent.              │
// └────────────────────────────────────────────────────────────────────┘
//
// Aucun import de composant : ce fichier doit rester lisible par Node
// pour que `npm run check:nav` vérifie la cohérence sans navigateur.

import { MODULES } from './modules.js';

/**
 * Les tracés.
 *
 * Coordonnées dans un carré de 100 × 100, converties en pourcentages à
 * l'affichage — le hub doit tenir aussi bien sur un téléphone que sur
 * un écran large, et une géométrie en pixels ne le permettrait pas.
 *
 * Les positions sont FIGÉES et non tirées au hasard : une constellation
 * qui change de forme à chaque visite n'est plus un repère. On doit
 * pouvoir apprendre que « Corps » est la silhouette aux bras levés.
 *
 * `edges` désigne des index de `stars`. Le premier point de chaque
 * tracé porte le nom : c'est l'étoile la plus haute, là où l'œil arrive.
 */
export const CONSTELLATIONS = [
  {
    key: 'corps',
    label: 'Corps',
    tagline: 'Force, entraînement, nutrition, sommeil',
    glyph: 'halterophile',
    // Une silhouette bras levés — la forme d'un haltérophile au verrouillage.
    stars: [
      [50, 10], [27, 28], [73, 28], [15, 50], [85, 50], [40, 64], [60, 64],
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 6], [5, 6]],
  },
  {
    key: 'mental',
    label: 'Mental',
    tagline: 'Humeur, sommeil, méditation, attention',
    glyph: 'cerveau',
    // Une spirale qui se resserre : ce qui tourne et qu'on ramène au centre.
    stars: [
      [50, 12], [76, 27], [82, 56], [56, 76], [30, 64], [37, 41],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    key: 'social',
    label: 'Social',
    tagline: 'Gens, sorties, liens, messages',
    glyph: 'gens',
    // Un anneau relié en son centre : des liens, et ce qui les tient.
    stars: [
      [50, 12], [80, 31], [80, 65], [50, 84], [20, 65], [20, 31], [50, 48],
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [6, 0], [6, 2], [6, 4],
    ],
  },
  {
    key: 'savoir',
    label: 'Savoir',
    tagline: 'Lecture, cours, notes, archives',
    glyph: 'livre',
    // Un livre ouvert, la reliure au milieu.
    stars: [
      [21, 28], [50, 20], [79, 28], [21, 68], [50, 76], [79, 68],
    ],
    edges: [[0, 1], [1, 2], [0, 3], [2, 5], [3, 4], [4, 5], [1, 4]],
  },
];

/**
 * Le module qui occupe une constellation, ou `null`.
 *
 * La correspondance se lit dans `MODULES`, pas ici : c'est le module
 * qui déclare le domaine auquel il appartient, de la même façon qu'il
 * déclare ses sections. Le hub ne fait que le constater.
 */
export function moduleForCategory(categoryKey) {
  return MODULES.find((m) => m.category === categoryKey) ?? null;
}

/**
 * Où mène une constellation : la première page de son premier module.
 *
 * Renvoie `null` quand le domaine n'est pas encore habité — l'étoile
 * reste éteinte, et rien ne l'ouvre.
 */
export function entryRoute(categoryKey) {
  const mod = moduleForCategory(categoryKey);
  if (!mod) return null;
  const section = mod.sections[0];
  return { section: section.key, page: section.pages[0].key };
}

/** Les quatre domaines, enrichis de ce qui les occupe. */
export const hubBoard = () => CONSTELLATIONS.map((c) => {
  const mod = moduleForCategory(c.key);
  return { ...c, module: mod, route: entryRoute(c.key), lit: mod != null };
});

/**
 * Contrôles de cohérence, exécutés par `npm run check:nav`.
 *
 * Deux fautes sont silencieuses à l'exécution et ruinent le hub :
 * un module rangé dans un domaine qui n'existe pas — sa tuile
 * disparaîtrait sans erreur — et deux modules dans le même domaine,
 * auquel cas le second deviendrait inatteignable depuis le hub.
 */
export function hubProblems() {
  const problems = [];
  const keys = new Set(CONSTELLATIONS.map((c) => c.key));
  const taken = new Map();

  for (const mod of MODULES) {
    if (!mod.category) {
      problems.push(`module « ${mod.key} » sans domaine : invisible depuis le hub`);
      continue;
    }
    if (!keys.has(mod.category)) {
      problems.push(`module « ${mod.key} » rangé dans « ${mod.category} », qui n'existe pas`);
    }
    if (taken.has(mod.category)) {
      problems.push(
        `domaine « ${mod.category} » réclamé par ${taken.get(mod.category)} et ${mod.key}`,
      );
    }
    taken.set(mod.category, mod.key);
  }

  for (const c of CONSTELLATIONS) {
    for (const [a, b] of c.edges) {
      if (!c.stars[a] || !c.stars[b]) {
        problems.push(`constellation « ${c.key} » : segment ${a}–${b} hors des étoiles`);
      }
    }
  }
  return problems;
}
