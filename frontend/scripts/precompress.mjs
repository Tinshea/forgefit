// Precompresse les fichiers produits, au niveau maximal.
//
//   npm run build  (appele automatiquement apres vite build)
//
// Nginx sert le `.gz` voisin grace a `gzip_static`. Compresser au build
// permet le niveau 9 — trop couteux a la volee — et supprime tout
// calcul au moment de servir.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');

/** En dessous, l'en-tete de gzip coute plus que ce qu'il economise. */
const MIN = 1024;
const EXT = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest']);

let files = 0;
let before = 0;
let after = 0;

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!EXT.has(path.extname(entry.name))) continue;

    const raw = fs.readFileSync(full);
    if (raw.length < MIN) continue;

    const gz = zlib.gzipSync(raw, { level: 9 });
    // Un `.gz` plus gros que l'original serait servi a perte.
    if (gz.length >= raw.length) continue;

    fs.writeFileSync(`${full}.gz`, gz);
    files += 1;
    before += raw.length;
    after += gz.length;
  }
};

if (!fs.existsSync(DIST)) {
  console.error('dist/ introuvable — lancer `vite build` d’abord.');
  process.exit(1);
}

walk(DIST);
const ko = (n) => (n / 1024).toFixed(1);
console.log(
  `Precompresse : ${files} fichiers, ${ko(before)} Ko → ${ko(after)} Ko `
  + `(${Math.round((1 - after / before) * 100)} % de moins).`,
);
