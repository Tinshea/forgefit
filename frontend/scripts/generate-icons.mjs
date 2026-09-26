// Extrait les tracés des icônes RÉELLEMENT utilisées.
//
//   npm run generate:icons
//
// ┌─ POURQUOI EXTRAIRE PLUTÔT QU'IMPORTER ────────────────────────────┐
// │ Phosphor compte 1 512 icônes par graisse. En importer la          │
// │ bibliothèque — même arborescente — installe une dépendance de     │
// │ plus dans une application qui n'en a que deux, et fait dépendre   │
// │ l'interface d'un paquet dont la prochaine version majeure peut    │
// │ redessiner ce qu'on affiche.                                      │
// │                                                                    │
// │ Ce script lit les fichiers SVG et écrit UNIQUEMENT les tracés     │
// │ dont on se sert, dans un module généré. Le paquet reste une       │
// │ dépendance de développement : il ne part ni dans le lot, ni dans  │
// │ l'image Docker de production.                                     │
// │                                                                    │
// │ Licence MIT — le fichier généré porte la mention de copyright,    │
// │ que la licence exige de conserver.                                │
// └────────────────────────────────────────────────────────────────────┘

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'node_modules', '@phosphor-icons', 'core', 'assets');
const OUT = path.join(here, '..', 'src', 'lib', 'icons.js');

/**
 * Nom interne → icône source.
 *
 * Les noms internes restent en français et décrivent l'USAGE, pas le
 * dessin : si l'on change d'icône pour « salle », rien d'autre ne bouge.
 */
const WANTED = {
  // Météo
  soleil: ['fill', 'sun'],
  nuage: ['fill', 'cloud'],
  pluie: ['fill', 'cloud-rain'],
  neige: ['fill', 'cloud-snow'],
  brume: ['fill', 'cloud-fog'],
  orage: ['fill', 'cloud-lightning'],

  // Lieux
  maison: ['fill', 'house'],
  halteres: ['fill', 'barbell'],
  arbre: ['fill', 'tree'],
  bureau: ['fill', 'briefcase'],
  rails: ['fill', 'train'],
  vague: ['fill', 'waves'],

  // Domaines du hub — un pictogramme par constellation
  cerveau: ['fill', 'brain'],
  gens: ['fill', 'users-three'],

  // Modules et sections
  app: ['fill', 'squares-four'],
  livre: ['fill', 'books'],
  carte: ['fill', 'map-trifold'],
  halterophile: ['fill', 'person-simple-run'],
  assiette: ['fill', 'fork-knife'],
  courbe: ['fill', 'chart-line-up'],
  reglage: ['fill', 'gear'],
  calendrier: ['fill', 'calendar-blank'],

  // Actions
  plus: ['bold', 'plus'],
  croix: ['bold', 'x'],
  moins: ['bold', 'minus'],
  cible: ['fill', 'crosshair'],
  agrandir: ['bold', 'arrows-out'],
  reduire: ['bold', 'arrows-in'],
  epingle: ['fill', 'push-pin'],
  corbeille: ['fill', 'trash'],
  inconnu: ['fill', 'question'],
};

/** Récupère les `d` d'un SVG, dans l'ordre. */
function pathsOf(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const ds = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!ds.length) throw new Error(`aucun tracé dans ${file}`);
  return ds;
}

const entries = [];
let bytes = 0;

for (const [key, [weight, name]] of Object.entries(WANTED)) {
  const file = path.join(SRC, weight, `${name}-${weight}.svg`);
  if (!fs.existsSync(file)) throw new Error(`icône introuvable : ${weight}/${name}`);
  const ds = pathsOf(file);
  bytes += ds.join('').length;
  entries.push(`  ${key}: ${JSON.stringify(ds)},`);
  console.log(`  ok  ${key.padEnd(14)} ← ${weight}/${name}`);
}

const out = `// Tracés d'icônes — FICHIER GÉNÉRÉ, ne pas éditer à la main.
//
//   npm run generate:icons
//
// Source : Phosphor Icons — https://phosphoricons.com
// Copyright (c) 2023 Phosphor Icons, licence MIT.
// Seuls les tracés réellement employés sont repris ici ; la
// bibliothèque complète n'entre ni dans le lot, ni dans l'image de
// production.
//
// Toutes les icônes partagent le cadre 256 × 256 de Phosphor, ce qui
// permet de les échanger sans retoucher la mise en page.

export const ICON_VIEWBOX = '0 0 256 256';

export const ICON_PATHS = {
${entries.join('\n')}
};

export const ICON_NAMES = Object.keys(ICON_PATHS);
`;

fs.writeFileSync(OUT, out, 'utf8');
console.log(`\nÉcrit : ${OUT} — ${Object.keys(WANTED).length} icônes, ${(bytes / 1024).toFixed(1)} Ko de tracés.`);
