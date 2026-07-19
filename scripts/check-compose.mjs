// Valide docker-compose.yml sans Docker : syntaxe, references croisees,
// et les pieges specifiques a Portainer.
import fs from 'node:fs';
import * as yaml from 'js-yaml';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ?? path.join(here, '..', 'docker-compose.yml');
let problems = 0;
const fail = (m) => { console.log(`  ECHEC  ${m}`); problems += 1; };
const warn = (m) => console.log(`  NOTE   ${m}`);
const ok = (m) => console.log(`  ok     ${m}`);

let doc;
try {
  doc = yaml.load(fs.readFileSync(FILE, 'utf8'));
  ok('YAML syntaxiquement valide');
} catch (e) {
  fail(`YAML invalide : ${e.message}`);
  process.exit(1);
}

console.log('\n=== Structure ===');
const services = Object.keys(doc.services ?? {});
ok(`services : ${services.join(', ')}`);
ok(`reseaux  : ${Object.keys(doc.networks ?? {}).join(', ')}`);
ok(`volumes  : ${Object.keys(doc.volumes ?? {}).join(', ')}`);

console.log('\n=== References croisees ===');
const declaredNets = new Set(Object.keys(doc.networks ?? {}));
const declaredVols = new Set(Object.keys(doc.volumes ?? {}));
for (const [name, svc] of Object.entries(doc.services ?? {})) {
  for (const n of svc.networks ?? []) {
    if (!declaredNets.has(n)) fail(`${name} utilise le reseau non declare « ${n} »`);
  }
  for (const v of svc.volumes ?? []) {
    const src = String(v).split(':')[0];
    if (!src.startsWith('.') && !src.startsWith('/') && !declaredVols.has(src)) {
      fail(`${name} utilise le volume non declare « ${src} »`);
    }
  }
  // depends_on accepte deux formes : une liste (« - api ») ou un objet
  // avec conditions. Object.keys sur une liste renvoie ses INDEX.
  const deps = Array.isArray(svc.depends_on)
    ? svc.depends_on
    : Object.keys(svc.depends_on ?? {});
  for (const dep of deps) {
    if (!services.includes(dep)) fail(`${name} depend du service inexistant « ${dep} »`);
  }
}
if (!problems) ok('tous les reseaux, volumes et dependances sont declares');

console.log('\n=== Pieges Portainer ===');
const withBuild = services.filter((s) => doc.services[s].build);
if (withBuild.length) {
  warn(`${withBuild.join(', ')} utilisent « build: » — l'editeur web de Portainer`);
  warn('       ne dispose d\'aucun contexte de build. Deployer via « Repository »,');
  warn('       ou pousser des images pre-construites.');
} else {
  ok('aucun build : deployable depuis l\'editeur web');
}

const extNets = Object.entries(doc.networks ?? {}).filter(([, n]) => n?.external);
if (extNets.length) {
  fail(`reseau externe « ${extNets.map(([k]) => k).join(', ')} » : doit exister AVANT `
    + 'le deploiement, sinon « network not found »');
} else {
  ok('aucun reseau externe : la stack se deploie sans preparation');
}

const named = services.filter((s) => doc.services[s].container_name);
if (named.length) {
  warn(`container_name fixe sur ${named.join(', ')} — empeche de deployer`);
  warn('       deux fois la meme stack sur un hote. Sans consequence ici.');
}

console.log('\n=== Verifications applicatives ===');
const web = doc.services.web;
const viteBase = web?.build?.args?.VITE_API_BASE;
if (viteBase === null || viteBase === '' || /\$\{VITE_API_BASE:-\}$/.test(String(viteBase))) {
  ok('VITE_API_BASE vide : le front appellera son. propre origine, relayee par nginx');
} else {
  fail(`VITE_API_BASE = « ${viteBase} » — inline dans le bundle au build. `
    + 'Une valeur en dur casse l\'acces depuis toute autre machine que l\'hote.');
}

const api = doc.services.api;
if (!api?.environment?.DATABASE_URL) fail('api sans DATABASE_URL');
else ok('DATABASE_URL cablee sur le service db');

const db = doc.services.db;
if (db?.ports) {
  fail('la base publie un port sur l\'hote — elle ne devrait etre joignable '
    + 'que depuis le reseau interne');
} else {
  ok('la base ne publie aucun port');
}

if (!db?.healthcheck) warn('pas de healthcheck sur la base');
else ok('healthcheck present sur la base');

const cond = api?.depends_on?.db?.condition;
if (cond === 'service_healthy') ok('api attend que la base soit saine');
else warn(`api ne depend pas de la sante de la base (condition=${cond})`);

// Le secret par defaut ne doit jamais rester en production.
const secret = String(api?.environment?.WEBHOOK_SECRET ?? '');
if (/dev-secret/.test(secret)) {
  warn('WEBHOOK_SECRET a une valeur de developpement par defaut : a definir');
}

console.log(problems ? `\n=== ${problems} PROBLEME(S) ===` : '\n=== COMPOSE VALIDE ===');
process.exit(problems ? 1 : 0);
