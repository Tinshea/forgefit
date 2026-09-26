/**
 * Registre des manuels, par catégorie.
 *
 * ┌─ POURQUOI UN REGISTRE ────────────────────────────────────────────┐
 * │ Les sports de combat vivent dans `combat-manual.js` et            │
 * │ `combat-manual-detail.js`, écrits avant que la démarche ne soit   │
 * │ généralisée. Les catégories suivantes arrivent une par une, dans  │
 * │ ce dossier.                                                        │
 * │                                                                    │
 * │ Ce fichier les réunit pour que le reste de l'application ne       │
 * │ connaisse qu'UNE porte d'entrée. Ajouter une catégorie revient à  │
 * │ écrire son fichier et à l'inscrire ici : rien d'autre ne bouge.   │
 * └────────────────────────────────────────────────────────────────────┘
 */

import { MANUEL as COMBAT } from '../combat-manual.js';
import { DETAIL as COMBAT_DETAIL } from '../combat-manual-detail.js';
import { MANUEL as ENDURANCE, DETAIL as ENDURANCE_DETAIL } from './endurance.js';
import { MANUEL as FORCE, DETAIL as FORCE_DETAIL } from './force.js';
import { MANUEL as GRIMPE, DETAIL as GRIMPE_DETAIL } from './grimpe.js';
import { MANUEL as MOBILITE, DETAIL as MOBILITE_DETAIL } from './mobilite.js';

/** Les catégories couvertes, et ce qu'elles apportent. */
export const CATEGORIES_COUVERTES = {
  combat: { manuel: COMBAT, detail: COMBAT_DETAIL },
  endurance: { manuel: ENDURANCE, detail: ENDURANCE_DETAIL },
  force: { manuel: FORCE, detail: FORCE_DETAIL },
  grimpe: { manuel: GRIMPE, detail: GRIMPE_DETAIL },
  mobilite: { manuel: MOBILITE, detail: MOBILITE_DETAIL },
};

const fusionner = (champ) => Object.values(CATEGORIES_COUVERTES)
  .reduce((acc, c) => Object.assign(acc, c[champ]), {});

export const MANUELS = fusionner('manuel');
export const DETAILS = fusionner('detail');

export const manuelDe = (key) => MANUELS[key] ?? null;
export const detailDe = (key) => DETAILS[key] ?? null;

export const DISCIPLINES_DOCUMENTEES = Object.keys(MANUELS);

/**
 * Deux catégories ne doivent pas documenter la même discipline : la
 * seconde écraserait silencieusement la première à la fusion.
 */
export function collisions() {
  const vues = new Map();
  const problemes = [];
  for (const [cat, c] of Object.entries(CATEGORIES_COUVERTES)) {
    for (const k of Object.keys(c.manuel)) {
      if (vues.has(k)) problemes.push(`« ${k} » documenté par ${vues.get(k)} et ${cat}`);
      vues.set(k, cat);
    }
  }
  return problemes;
}

/**
 * Contrôles de complétude, appliqués à TOUTES les catégories.
 *
 * Les fichiers de combat portaient leurs propres vérifications, écrites
 * avant que la démarche ne se généralise. Les règles vivent désormais
 * ici : une catégorie ajoutée est vérifiée d'office, sans que personne
 * ait à penser à recopier le contrôle.
 */
const REQUIS_MANUEL = ['pourquoi', 'forces', 'techniques', 'methodes', 'esprit', 'lecons', 'demarrer', 'sources'];
const REQUIS_DETAIL = ['format', 'seance_type', 'progression', 'erreurs', 'securite', 'glossaire'];

export function problemes() {
  const p = [];

  for (const [cle, m] of Object.entries(MANUELS)) {
    for (const champ of REQUIS_MANUEL) {
      if (m[champ] == null) p.push(`${cle} : manuel, « ${champ} » manquant`);
    }
    if (typeof m.esprit?.codifie !== 'boolean') {
      p.push(`${cle} : « esprit.codifie » doit trancher, sans ambiguïté`);
    }
    // Annoncer une doctrine sans la citer, c'est en inventer une.
    if (m.esprit?.codifie && !(m.esprit.principes?.length > 0)) {
      p.push(`${cle} : esprit annoncé codifié, aucun principe cité`);
    }
    if (!(m.sources?.length > 0)) p.push(`${cle} : aucune source`);
    if (!(m.methodes?.length >= 3)) p.push(`${cle} : moins de trois méthodes`);
    for (const f of m.techniques ?? []) {
      if (!f.famille || !(f.items?.length > 0)) p.push(`${cle} : famille technique vide`);
    }
  }

  for (const [cle, d] of Object.entries(DETAILS)) {
    for (const champ of REQUIS_DETAIL) {
      if (d[champ] == null) p.push(`${cle} : détail, « ${champ} » manquant`);
    }
    // Une faute sans correction est un reproche, pas un enseignement.
    for (const e of d.erreurs ?? []) {
      if (!e.faute || !e.pourquoi || !e.correction) p.push(`${cle} : erreur incomplète`);
    }
    if (!(d.erreurs?.length >= 4)) p.push(`${cle} : moins de quatre fautes courantes`);
    if (!(d.securite?.prevention?.length >= 2)) p.push(`${cle} : prévention trop courte`);
    // ┌─ UNE BORNE LARGE, ET C'EST VOULU ───────────────────────────┐
    // │ La première version exigeait 55 à 140 min — la forme d'une   │
    // │ séance de sport de combat. Elle rejetait une randonnée de    │
    // │ 3 h 20 et une séance de corde de 45 min, qui sont l'une et   │
    // │ l'autre parfaitement ordinaires. La règle était fausse, pas  │
    // │ les données.                                                  │
    // │                                                               │
    // │ Ce contrôle ne juge plus la durée « raisonnable » : il       │
    // │ attrape l'absurde — une séance vide, ou une de deux jours.   │
    // └───────────────────────────────────────────────────────────────┘
    const total = (d.seance_type ?? []).reduce((a, x) => a + (x.minutes ?? 0), 0);
    if (total < 20 || total > 600) p.push(`${cle} : séance type de ${total} min, absurde`);
  }

  return p;
}
