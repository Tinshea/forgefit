// Génère src/lib/anatomy.js depuis les tracés MIT de
// react-muscle-highlighter (cf. THIRD_PARTY_NOTICES.md).
//
//   npm run generate:anatomy
//
// La source est figée dans scripts/anatomy-source.json : le rendu ne
// doit pas dépendre de la disponibilité d'un dépôt tiers au moment du
// build. Pour rafraîchir la source, réexécuter l'extraction décrite
// dans THIRD_PARTY_NOTICES.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unionBBox } from './svg-path.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? path.join(here, 'anatomy-source.json');
const OUT = process.argv[3] ?? path.join(here, '..', 'src', 'lib', 'anatomy.js');

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/**
 * Correspondance vocabulaire source -> nos clés canoniques.
 * Une région peut servir PLUSIEURS muscles quand le modèle source ne
 * les distingue pas (les dorsaux sont fondus dans le haut du dos).
 */
const MAP = {
  front: {
    chest: ['pectorals'],
    abs: ['abs'],
    obliques: ['abs', 'serratus anterior'],
    biceps: ['biceps'],
    triceps: ['triceps'],
    trapezius: ['traps'],
    deltoids: ['delts'],
    adductors: ['adductors'],
    quadriceps: ['quads', 'hip flexors'],
    calves: ['calves'],
    tibialis: ['calves'],
    forearm: ['forearms'],
    // Décor : ni cible d'entraînement, ni interactif.
    neck: null, head: null, hair: null, hands: null,
    knees: null, ankles: null, feet: null,
  },
  back: {
    trapezius: ['traps', 'levator scapulae'],
    deltoids: ['delts'],
    'upper-back': ['upper back', 'lats'],
    triceps: ['triceps'],
    'lower-back': ['lower back', 'spine'],
    forearm: ['forearms'],
    gluteal: ['glutes', 'abductors'],
    adductors: ['adductors'],
    hamstring: ['hamstrings'],
    calves: ['calves'],
    neck: null, head: null, hair: null, hands: null,
    ankles: null, feet: null,
  },
};

// ┌─ POURQUOI ON NE TOUCHE PAS AUX TRACÉS ────────────────────────────┐
// │ Les deux figures sont côte à côte dans le canevas source. La       │
// │ tentation est de translater le dos pour ramener les deux vues à    │
// │ une origine commune — c'est un piège.                              │
// │                                                                    │
// │ Ces tracés emploient des ARCS RELATIFS (`a`) dont les drapeaux     │
// │ s'écrivent en notation compacte : dans `a1.5 1.5 0 0114.6 3.5`,    │
// │ la séquence `0114.6` vaut drapeaux 0 et 1 puis abscisse 14.6. Un   │
// │ découpage naïf y lit UN nombre, se retrouve avec 5 arguments au    │
// │ lieu de 7, et TRONQUE le tracé — silencieusement.                  │
// │                                                                    │
// │ Résultat observé : moitié des muscles du dos amputés, figure       │
// │ asymétrique. Aucun test ne le voyait, puisque le tracé restait     │
// │ syntaxiquement valide.                                             │
// │                                                                    │
// │ On garde donc les tracés INTACTS et on recadre par le viewBox :    │
// │ le cadre du dos vise simplement la zone du canevas où le dos est   │
// │ dessiné. Zéro arithmétique sur la géométrie, zéro risque.          │
// └────────────────────────────────────────────────────────────────────┘

const regions = { front: [], back: [] };
const decor = { front: [], back: [] };

for (const view of ['front', 'back']) {
  for (const group of raw[view]) {
    const keys = MAP[view][group.slug];
    const target = keys === null ? decor[view] : regions[view];
    for (const d of group.paths) {
      // Tracé conservé tel quel — cf. l'encadré ci-dessus.
      if (keys === null) target.push(d);
      else target.push({ keys, d });
    }
  }
}

// --- Cadrage -------------------------------------------------------
// Un cadre unique ne peut pas convenir aux deux vues : elles n'ont ni
// la même largeur ni le même centre. On calcule donc un cadre par vue,
// mais de MÊMES dimensions, pour que la figure ne change pas de taille
// quand on bascule face/dos.

const MARGIN = 14;
const boxes = {};
for (const view of ['front', 'back']) {
  boxes[view] = unionBBox([...regions[view].map((r) => r.d), ...decor[view]]);
}
// Dimensions communes : la plus grande des deux vues, marge comprise.
const boxW = Math.ceil(Math.max(
  boxes.front.width,
  boxes.back.width,
) + MARGIN * 2);
const boxH = Math.ceil(Math.max(
  boxes.front.height,
  boxes.back.height,
) + MARGIN * 2);

const viewBoxes = {};
for (const view of ['front', 'back']) {
  const b = boxes[view];
  // Chaque vue est centrée dans le cadre commun.
  viewBoxes[view] = {
    x: Math.round(((b.minX + b.maxX) / 2 - boxW / 2) * 10) / 10,
    y: Math.round(((b.minY + b.maxY) / 2 - boxH / 2) * 10) / 10,
    width: boxW,
    height: boxH,
  };
  console.log(`cadre ${view}: x=${viewBoxes[view].x} y=${viewBoxes[view].y} `
    + `(contenu x ${b.minX.toFixed(1)}..${b.maxX.toFixed(1)})`);
}

const stats = (view) => {
  const ks = new Set(regions[view].flatMap((r) => r.keys));
  return `${regions[view].length} régions musculaires (${ks.size} muscles), `
    + `${decor[view].length} tracés de décor`;
};
console.log('front:', stats('front'));
console.log('back :', stats('back'));

const covered = new Set([...regions.front, ...regions.back].flatMap((r) => r.keys));
console.log('\nmuscles couverts :', [...covered].sort().join(', '));

const fmtRegions = (list) => list
  .map((r) => `  { keys: ${JSON.stringify(r.keys)}, d: '${r.d}' },`)
  .join('\n');
const fmtDecor = (list) => list.map((d) => `  '${d}',`).join('\n');

const header = `// Géométrie anatomique — tracés SVG.
//
// ┌─ ORIGINE DES TRACÉS ──────────────────────────────────────────────┐
// │ Adaptés de react-muscle-highlighter, sous licence MIT.            │
// │ https://github.com/soroojshehryar/react-muscle-highlighter        │
// │ Voir THIRD_PARTY_NOTICES.md à la racine du dépôt.                 │
// │                                                                    │
// │ Choisis après comparaison : le modèle précédent était dessiné à    │
// │ la main, et d'autres bibliothèques libres (body-highlighter)       │
// │ n'utilisent que des POLYGONES à segments droits, donc un rendu     │
// │ facetté. Celui-ci est tracé en courbes de Bézier, ce qui donne     │
// │ des galbes musculaires crédibles.                                  │
// └────────────────────────────────────────────────────────────────────┘
//
// FICHIER GÉNÉRÉ — ne pas éditer à la main.
//
// Une région porte plusieurs \`keys\` quand le modèle source ne sépare
// pas les muscles que notre catalogue distingue : les dorsaux sont
// fondus dans le haut du dos, les abducteurs dans les fessiers. La
// région s'allume alors dès que l'un de ses muscles est concerné.
`;

const body = `
export const MUSCLE_LABELS = {
  abs: 'Abdominaux',
  pectorals: 'Pectoraux',
  biceps: 'Biceps',
  triceps: 'Triceps',
  delts: 'Deltoïdes',
  traps: 'Trapèzes',
  lats: 'Dorsaux',
  'upper back': 'Haut du dos',
  forearms: 'Avant-bras',
  glutes: 'Fessiers',
  quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  calves: 'Mollets',
  spine: 'Lombaires',
  'lower back': 'Bas du dos',
  adductors: 'Adducteurs',
  abductors: 'Abducteurs',
  'serratus anterior': 'Dentelé antérieur',
  'levator scapulae': 'Élévateur de la scapula',
  'hip flexors': 'Fléchisseurs de hanche',
  'cardiovascular system': 'Système cardiovasculaire',
};

export const muscleLabel = (key) => MUSCLE_LABELS[key] ?? key;

/**
 * Un cadre PAR VUE : face et dos n'ont ni la même largeur ni le même
 * centre dans le canevas d'origine. Les dimensions sont en revanche
 * identiques, pour que la figure ne change pas de taille au basculement.
 */
export const VIEWBOX = ${JSON.stringify(viewBoxes, null, 2).replace(/"(\w+)":/g, '$1:')};

export const FRONT = [
${fmtRegions(regions.front)}
];

export const BACK = [
${fmtRegions(regions.back)}
];

/** Silhouette et parties non musculaires : tête, mains, pieds, cou. */
export const DECOR = {
  front: [
${fmtDecor(decor.front)}
  ],
  back: [
${fmtDecor(decor.back)}
  ],
};

export const FRONT_KEYS = new Set(FRONT.flatMap((r) => r.keys));
export const BACK_KEYS = new Set(BACK.flatMap((r) => r.keys));

/**
 * Vue qui montre le mieux un ensemble de muscles.
 * Un tirage se lit de dos, un développé de face.
 *
 * Le PREMIER muscle de la liste est le principal, et il prime : une
 * traction compte trois muscles visibles de face (biceps, avant-bras)
 * contre un seul de dos, si bien qu'un simple décompte affichait la
 * face — où les dorsaux, muscle principal du mouvement, n'apparaissent
 * pas du tout. Une figure qui n'allume pas le muscle travaillé est pire
 * qu'aucune figure.
 */
export function bestViewFor(muscles = []) {
  const [primary] = muscles;
  if (primary) {
    const onFront = FRONT_KEYS.has(primary);
    const onBack = BACK_KEYS.has(primary);
    // Visible d'un seul côté : le choix est fait, quoi que disent les
    // secondaires.
    if (onBack && !onFront) return 'back';
    if (onFront && !onBack) return 'front';
  }

  let front = 0;
  let back = 0;
  for (const m of muscles) {
    if (FRONT_KEYS.has(m)) front += 1;
    if (BACK_KEYS.has(m)) back += 1;
  }
  return back > front ? 'back' : 'front';
}
`;

fs.writeFileSync(OUT, header + body, 'utf8');
console.log(`\nÉcrit : ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} Ko)`);
