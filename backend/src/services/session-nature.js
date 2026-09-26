import { SPORTS } from './sports.js';

/**
 * De quelle NATURE est une séance : technique, physique, ou souplesse.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ──────────────────────────────────────┐
 * │ La règle précédente devinait la nature à partir de MOTS dans le   │
 * │ titre :                                                            │
 * │                                                                    │
 * │   if (/physique|force|puissance|muscu/.test(titre)) …             │
 * │                                                                    │
 * │ Testée sur les dix-huit titres que les modèles de programme        │
 * │ produisent réellement — « Bas du corps A », « Poussée B »,        │
 * │ « Squat lourd » — elle n'en reconnaissait AUCUN. Toutes les       │
 * │ séances de musculation étaient comptées comme « technique », et   │
 * │ l'équilibre hebdomadaire du coach était donc systématiquement     │
 * │ faux.                                                              │
 * │                                                                    │
 * │ On s'appuie désormais sur des DONNÉES STRUCTURÉES, dans l'ordre   │
 * │ de fiabilité décroissante : le `focus` du jour de programme, puis │
 * │ la catégorie du sport, puis — en dernier recours seulement — le   │
 * │ titre.                                                            │
 * └────────────────────────────────────────────────────────────────────┘
 */

export const NATURES = ['technique', 'physique', 'souplesse'];

/** Ce que chaque `focus` de jour de programme désigne. */
const PAR_FOCUS = {
  push: 'physique',
  pull: 'physique',
  legs: 'physique',
  core: 'physique',
  explosive: 'physique',
  endurance: 'physique',
  mobility: 'souplesse',
};

/**
 * Ce que chaque catégorie de sport désigne.
 *
 * Une discipline se pratique : le temps qu'on y passe est du temps
 * TECHNIQUE, même s'il est physiquement exigeant. La distinction n'est
 * pas « facile / dur », c'est « j'apprends un geste » contre « je
 * développe une qualité ».
 */
const PAR_CATEGORIE = {
  force: 'physique',
  endurance: 'physique',
  mobilite: 'souplesse',
  combat: 'technique',
  collectif: 'technique',
  raquette: 'technique',
  grimpe: 'technique',
  glisse: 'technique',
  mouvement: 'technique',
};

/** Dernier recours, quand ni focus ni sport ne sont renseignés. */
const PAR_TITRE = [
  [/souplesse|mobilit|stretch|étirement|etirement|yoga|pilates/i, 'souplesse'],
  // Les marqueurs de travail TECHNIQUE, avant ceux du travail physique :
  // « Kata du soir » tombait sinon sur le repli « physique », alors
  // que c'est exactement le temps technique qui compte pour quelqu'un
  // dont l'objectif est une discipline.
  [/kata|kumit|randori|sparring|tatami|technique|drill|cours\b|uchi.?komi|assaut|kihon/i, 'technique'],
  [/muscu|force|puissance|renfor|squat|développé|developpe|soulevé|souleve|poussée|poussee|tirage|jambes|haut du corps|bas du corps|corps entier|séance [ab]|seance [ab]/i, 'physique'],
];

/**
 * @param {object} s
 * @param {string} [s.focus]      le `focus` du jour de programme
 * @param {string} [s.sport_key]  la discipline, si c'en est une
 * @param {string} [s.title]      le titre, en dernier recours
 */
export function natureDe({ focus, sport_key: sportKey, title } = {}) {
  if (focus && PAR_FOCUS[focus]) return PAR_FOCUS[focus];

  if (sportKey && SPORTS[sportKey]) {
    const cat = SPORTS[sportKey].category;
    if (PAR_CATEGORIE[cat]) return PAR_CATEGORIE[cat];
  }

  const t = String(title ?? '');
  for (const [motif, nature] of PAR_TITRE) if (motif.test(t)) return nature;

  // Rien de reconnaissable : « physique » plutôt que « technique ».
  // Une séance libre est le plus souvent une séance de salle, et se
  // tromper de ce côté-là fausse moins le plan qu'attribuer du temps
  // technique à quelqu'un qui n'en a pas fait.
  return 'physique';
}
