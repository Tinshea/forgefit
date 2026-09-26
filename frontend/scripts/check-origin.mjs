// Le paquet construit appelle-t-il une adresse qui n'existe que sur
// la machine qui l'a construit ?
//
// ┌─ LE DEFAUT QUI A MOTIVE CE CONTROLE ──────────────────────────────┐
// │ `.env` portait `VITE_API_BASE=http://localhost:3000`. Vite INLINE │
// │ cette valeur dans le paquet a la construction : ce n'est pas une  │
// │ variable lue a l'execution, c'est du texte fige dans le           │
// │ JavaScript livre.                                                 │
// │                                                                    │
// │ Consequence : depuis un telephone, « localhost » designe LE       │
// │ TELEPHONE. Toutes les requetes partaient vers une API inexistante │
// │ et echouaient en CORS — l'authentification, le calendrier, les    │
// │ courbes de sante, tout. L'application etait entierement cassee    │
// │ hors de l'hote Docker.                                            │
// │                                                                    │
// │ Et rien ne le signalait, parce que TOUS les controles tournaient  │
// │ depuis `localhost` : la seule adresse au monde ou cette valeur    │
// │ est correcte. Un defaut invisible depuis le poste de travail et   │
// │ total partout ailleurs.                                           │
// └────────────────────────────────────────────────────────────────────┘
//
// La regle : le paquet ne doit contenir AUCUNE origine absolue vers une
// adresse locale. Les requetes partent en relatif, nginx relaie.
//
//   node scripts/check-origin.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ICI, '../dist');

if (!fs.existsSync(DIST)) {
  console.error('Aucun dossier dist/ : construire d’abord (npm run build).');
  process.exit(2);
}

// `localhost`, la boucle locale en v4 et v6, et le nom d'hote Docker
// interne — qui ne se resout que DANS le reseau Docker, donc jamais
// depuis un navigateur.
const INTERDITS = [
  /https?:\/\/localhost(:\d+)?/g,
  /https?:\/\/127\.0\.0\.1(:\d+)?/g,
  /https?:\/\/\[::1\](:\d+)?/g,
  /https?:\/\/api:\d+/g,
];

const fichiers = [];
const parcourir = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) parcourir(p);
    else if (/\.(js|css|html|webmanifest)$/.test(e.name)) fichiers.push(p);
  }
};
parcourir(DIST);

const trouvailles = [];
for (const f of fichiers) {
  const contenu = fs.readFileSync(f, 'utf8');
  for (const motif of INTERDITS) {
    for (const m of contenu.matchAll(motif)) {
      trouvailles.push({ fichier: path.relative(DIST, f), adresse: m[0] });
    }
  }
}

if (trouvailles.length) {
  console.error('\n=== ORIGINE ABSOLUE DANS LE PAQUET ===\n');
  for (const t of trouvailles) {
    console.error(`  ✗ ${t.fichier} : ${t.adresse}`);
  }
  console.error('\nCette adresse est figee dans le JavaScript livre. Depuis un');
  console.error('telephone, elle designe le telephone : l’application ne');
  console.error('fonctionnera que depuis la machine qui l’a construite.\n');
  console.error('Vider VITE_API_BASE dans .env, puis reconstruire le service web.\n');
  process.exit(1);
}

console.log(`=== AUCUNE ORIGINE ABSOLUE — ${fichiers.length} fichier(s) du paquet ===`);
