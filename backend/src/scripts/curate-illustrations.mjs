#!/usr/bin/env node
// Curation des illustrations de techniques, depuis Wikimedia Commons.
//
// ┌─ POURQUOI COMMONS, ET PAS « DES IMAGES TROUVÉES SUR GITHUB » ─────┐
// │ Une illustration qu'on affiche est une œuvre qu'on republie. Les  │
// │ dépôts de techniques martiales qu'on croise ont des licences      │
// │ absentes, contradictoires ou simplement fausses — et je ne sais   │
// │ pas les vérifier.                                                 │
// │                                                                    │
// │ Commons expose la licence, l'auteur et la page de description de  │
// │ CHAQUE fichier, par API. On peut donc afficher l'attribution que  │
// │ les licences CC BY et CC BY-SA exigent, au lieu d'espérer que     │
// │ personne ne regarde.                                              │
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ CE QUE CE SCRIPT NE PEUT PAS FAIRE ──────────────────────────────┐
// │ Il ne SAIT PAS qu'une image montre bien la technique. Il retient  │
// │ un candidat quand le nom du fichier contient le nom de la         │
// │ technique — signal fort, mais pas une preuve.                     │
// │                                                                    │
// │ Chaque entrée retenue porte donc `verifie: false` jusqu'à ce      │
// │ qu'un humain l'ait regardée. L'interface n'affiche que ce qui est │
// │ vérifié : une illustration fausse est pire que pas d'illustration.│
// └────────────────────────────────────────────────────────────────────┘
//
//   node src/scripts/curate-illustrations.mjs            (aperçu)
//   node src/scripts/curate-illustrations.mjs --ecrire   (génère le module)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANUELS as MANUEL } from '../services/manuals/index.js';

const UA = 'ForgeFit/1.0 (application personnelle auto-hébergée ; curation Commons)';
const API = 'https://commons.wikimedia.org/w/api.php';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, '../services/combat-illustrations.js');

/** Contexte de recherche, pour lever les homonymies. */
const CONTEXTE = {
  boxe: 'boxing', boxe_thai: 'muay thai', mma: 'mixed martial arts',
  judo: 'judo', bjj: 'jiu-jitsu', karate: 'karate',
  lutte: 'wrestling', escrime: 'fencing',
  course: 'running', trail: 'trail running', velo_route: 'road cycling',
  vtt: 'mountain biking', home_trainer: 'indoor cycling', natation: 'swimming',
  aviron: 'rowing', rameur: 'indoor rowing', marche_rapide: 'racewalking',
  randonnee: 'hiking', corde_sauter: 'jump rope', ski_fond: 'cross-country skiing',
  musculation: 'weight training exercise', crossfit: 'crossfit',
  haltero: 'weightlifting', street_workout: 'calisthenics',
  escalade_voie: 'rock climbing', bloc: 'bouldering', pan_gouttes: 'climbing training',
  yoga: 'yoga', pilates: 'pilates', etirements: 'stretching',
};

/**
 * Licences acceptées.
 *
 * Toutes exigent l'attribution sauf CC0 et le domaine public ; aucune
 * n'interdit la republication. On écarte tout le reste — « fair use »
 * compris, qui n'a pas d'équivalent en droit français et ne s'applique
 * de toute façon pas à une republication.
 */
const LICENCES_OK = [
  /^CC0/i, /^Public domain/i, /^CC BY( |-)/i, /^CC BY-SA/i,
];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const normaliser = (s) => s.toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Une requête, avec reprise progressive sur 429.
 *
 * Commons limite les clients anonymes. Marteler malgré un 429 est le
 * comportement qui fait bannir une adresse — on attend, et on double
 * l'attente à chaque refus.
 */
async function requete(u, essai = 0) {
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (r.status === 429 && essai < 5) {
    const pause = 2000 * 2 ** essai;
    console.error(`    (limité, pause de ${pause / 1000} s)`);
    await attendre(pause);
    return requete(u, essai + 1);
  }
  if (!r.ok) throw new Error(`Commons a répondu ${r.status}`);
  return r.json();
}

async function chercher(terme, n = 6) {
  const u = new URL(API);
  u.search = new URLSearchParams({
    action: 'query', format: 'json',
    generator: 'search', gsrsearch: `filetype:bitmap|drawing ${terme}`,
    gsrnamespace: '6', gsrlimit: String(n),
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '480',
  });
  const d = await requete(u);
  return Object.values(d.query?.pages ?? {}).map((p) => {
    const ii = p.imageinfo[0];
    const em = ii.extmetadata ?? {};
    const net = (v) => (v ? String(v.value).replace(/<[^>]+>/g, '').trim() : null);
    return {
      fichier: p.title.replace(/^File:/, ''),
      licence: net(em.LicenseShortName),
      auteur: net(em.Artist),
      page: ii.descriptionurl,
      image: ii.thumburl,
      mime: ii.mime,
    };
  });
}

/** Le nom de la technique apparaît-il dans le nom du fichier ? */
function pertinent(nom, fichier) {
  const mots = normaliser(nom).split(' ').filter((m) => m.length > 2);
  if (mots.length === 0) return false;
  const cible = normaliser(fichier);
  // Tous les mots significatifs, pas seulement un : « garde » seul
  // ramènerait n'importe quoi.
  return mots.every((m) => cible.includes(m));
}

async function main() {
  const ecrire = process.argv.includes('--ecrire');
  // Les verdicts humains déjà rendus sont CONSERVÉS : relancer la
  // curation ne doit pas effacer une relecture.
  let anciens = {};
  try {
    ({ ILLUSTRATIONS: anciens } = await import('../services/combat-illustrations.js'));
  } catch { anciens = {}; }
  const trouve = {};
  let cherchees = 0;
  let retenues = 0;

  for (const [discipline, m] of Object.entries(MANUEL)) {
    for (const famille of m.techniques) {
      for (const item of famille.items) {
        cherchees += 1;
        const terme = `${item.nom} ${CONTEXTE[discipline] ?? ''}`.trim();
        let candidats = [];
        try {
          candidats = await chercher(terme);
        } catch (err) {
          console.error(`  ! ${item.nom} : ${err.message}`);
        }

        const bon = candidats.find((c) => pertinent(item.nom, c.fichier)
          && LICENCES_OK.some((re) => re.test(c.licence ?? ''))
          && /image\/(jpeg|png|gif|svg)/.test(c.mime ?? ''));

        const cle = `${discipline}:${normaliser(item.nom).replace(/ /g, '-')}`;
        if (bon) {
          retenues += 1;
          const avant = anciens[cle];
          const memeFichier = avant && avant.fichier === bon.fichier;
          trouve[cle] = {
            ...bon, discipline, technique: item.nom,
            verifie: memeFichier ? avant.verifie : false,
            ...(memeFichier && avant.rejet ? { rejet: avant.rejet } : {}),
          };
          console.log(`  ✓ ${item.nom.padEnd(26)} ${bon.licence}`);
        } else {
          console.log(`  – ${item.nom.padEnd(26)} rien de probant`);
        }
        // Commons demande de ne pas marteler : une requête à la fois,
        // avec une pause franche. Le script tourne rarement — il peut
        // prendre trois minutes, personne n'attend devant.
        await attendre(1500);
      }
    }
  }

  console.log(`\n${retenues} illustration(s) retenue(s) sur ${cherchees} technique(s).`);

  if (!ecrire) {
    console.log('Aperçu seulement. Relance avec --ecrire pour générer le module.');
    return;
  }

  const entetes = `// GÉNÉRÉ par src/scripts/curate-illustrations.mjs — ne pas éditer à la main,
// SAUF le champ \`verifie\`, qui est le seul jugement humain de ce fichier.
//
// Chaque entrée porte sa licence, son auteur et sa page Commons :
// CC BY et CC BY-SA exigent l'attribution, et l'interface l'affiche.
//
// \`verifie: false\` signifie « le nom du fichier correspond, mais
// personne n'a encore regardé l'image ». L'interface ne montre que les
// entrées vérifiées — une illustration fausse est pire que rien.

export const ILLUSTRATIONS = ${JSON.stringify(trouve, null, 2)};

export const illustrationDe = (discipline, technique) => {
  const cle = \`\${discipline}:\${technique.toLowerCase().normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}\`;
  const i = ILLUSTRATIONS[cle];
  return i && i.verifie ? i : null;
};

/** Toutes les entrées, vérifiées ou non — pour l'outil de relecture. */
export const TOUTES = Object.values(ILLUSTRATIONS);
`;
  fs.writeFileSync(SORTIE, entetes, 'utf8');
  console.log(`Écrit : ${SORTIE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
