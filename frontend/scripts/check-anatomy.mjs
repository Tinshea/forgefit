// Vérifie l'intégrité de la géométrie anatomique.
//
//   npm run check:anatomy
//
// `anatomy.js` étant généré, un défaut géométrique ne casse aucun build :
// il produit une figure difforme qu'on ne voit qu'à l'œil. Deux
// régressions réelles l'ont montré :
//   1. un cadre unique rognait la vue de dos et amputait un bras ;
//   2. une translation naïve tronquait les tracés contenant des arcs
//      relatifs, supprimant la moitié des muscles du dos.
//
// D'où les trois contrôles ci-dessous : cadrage, symétrie, couverture.

import { FRONT, BACK, DECOR, VIEWBOX, MUSCLE_LABELS } from '../src/lib/anatomy.js';
import { unionBBox, pathBBox, parsePath } from './svg-path.mjs';

let problems = 0;
const fail = (m) => { console.log(`  ÉCHEC  ${m}`); problems += 1; };
const ok = (m) => console.log(`  ok     ${m}`);

const VIEWS = {
  front: { regions: FRONT, decor: DECOR.front },
  back: { regions: BACK, decor: DECOR.back },
};

// --- 1. Cadrage ------------------------------------------------------
console.log('\n=== Cadrage ===');
const sizes = new Set();
for (const [name, { regions, decor }] of Object.entries(VIEWS)) {
  const box = VIEWBOX[name];
  sizes.add(`${box.width}x${box.height}`);
  const b = unionBBox([...regions.map((r) => r.d), ...decor]);

  const over = {
    gauche: box.x - b.minX,
    droite: b.maxX - (box.x + box.width),
    haut: box.y - b.minY,
    bas: b.maxY - (box.y + box.height),
  };
  const clipped = Object.entries(over).filter(([, v]) => v > 0.01);

  if (clipped.length) {
    fail(`${name} : rogné — ${clipped.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
  } else {
    ok(`${name} : entier dans le cadre (marge min ${Math.min(...Object.values(over).map((v) => -v)).toFixed(1)})`);
  }
}
if (sizes.size !== 1) {
  fail(`les deux vues n'ont pas la même échelle : ${[...sizes].join(' vs ')}`);
} else {
  ok(`même échelle pour les deux vues (${[...sizes][0]})`);
}

// --- 2. Symétrie -----------------------------------------------------
// Le corps est bilatéralement symétrique : un groupe musculaire doit
// présenter des surfaces comparables de part et d'autre de l'axe. Un
// fort déséquilibre signale des tracés perdus ou corrompus.
console.log('\n=== Symétrie gauche/droite ===');
for (const [name, { regions }] of Object.entries(VIEWS)) {
  const box = VIEWBOX[name];
  const axis = box.x + box.width / 2;

  const byGroup = new Map();
  for (const r of regions) {
    const key = r.keys.join('+');
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(pathBBox(r.d));
  }

  const bad = [];
  for (const [key, list] of byGroup) {
    // Les structures médianes (colonne) n'ont pas de pendant.
    const lateral = list.filter((b) => Math.abs(b.centerX - axis) > box.width * 0.04);
    if (lateral.length < 2) continue;

    const area = (arr) => arr.reduce((s, b) => s + b.width * b.height, 0);
    const left = area(lateral.filter((b) => b.centerX < axis));
    const right = area(lateral.filter((b) => b.centerX >= axis));
    const ratio = Math.max(left, right) > 0
      ? Math.min(left, right) / Math.max(left, right) : 0;
    if (ratio < 0.6) bad.push(`${key} (ratio ${ratio.toFixed(2)})`);
  }

  if (bad.length) fail(`${name} : groupes asymétriques — ${bad.join(', ')}`);
  else ok(`${name} : tous les groupes latéraux sont équilibrés`);
}

// --- 3. Couverture ---------------------------------------------------
console.log('\n=== Couverture ===');
const covered = new Set([...FRONT, ...BACK].flatMap((r) => r.keys));
const API_MUSCLES = [
  'delts', 'hamstrings', 'forearms', 'triceps', 'biceps', 'quads', 'calves',
  'glutes', 'upper back', 'abs', 'pectorals', 'traps', 'hip flexors',
  'lower back', 'lats', 'adductors', 'abductors', 'spine',
  'serratus anterior', 'levator scapulae',
];
const missing = API_MUSCLES.filter((m) => !covered.has(m));
if (missing.length) fail(`muscles renvoyés par l'API mais absents : ${missing.join(', ')}`);
else ok(`les ${API_MUSCLES.length} muscles de l'API ont une région`);

const unlabelled = [...covered].filter((k) => !MUSCLE_LABELS[k]);
if (unlabelled.length) fail(`sans libellé FR : ${unlabelled.join(', ')}`);
else ok('tous les muscles ont un libellé français');

// --- 4. Intégrité des tracés ----------------------------------------
console.log('\n=== Intégrité des tracés ===');
let truncated = 0;
for (const [name, { regions, decor }] of Object.entries(VIEWS)) {
  for (const d of [...regions.map((r) => r.d), ...decor]) {
    const cmds = parsePath(d);
    // Un tracé de forme fermée doit finir par Z et compter assez de
    // segments : un tracé tronqué perd son Z final.
    if (cmds.length < 3) { truncated += 1; continue; }
    const last = cmds[cmds.length - 1].cmd.toUpperCase();
    if (last !== 'Z') truncated += 1;
  }
}
if (truncated > 0) fail(`${truncated} tracé(s) non fermé(s) — signe de troncature`);
else ok('tous les tracés sont fermés');

console.log(problems ? `\n=== ${problems} PROBLÈME(S) ===` : '\n=== GÉOMÉTRIE VALIDE ===');
process.exit(problems ? 1 : 0);
