// Standards de force et conversion en score /100.
//
// ┌─ CE QUE CES PERCENTILES SONT, ET NE SONT PAS ─────────────────────┐
// │                                                                    │
// │ Ce ne sont PAS des percentiles mondiaux. Personne ne dispose de la │
// │ distribution de force de la population mondiale : cela supposerait │
// │ d'avoir testé le 1RM d'un échantillon représentatif de l'humanité, │
// │ ce qui n'existe pas.                                               │
// │                                                                    │
// │ Les tables de référence publiques (type StrengthLevel) sont        │
// │ calculées sur les charges saisies par les utilisateurs             │
// │ d'applications de suivi de musculation. Cette population est :     │
// │   - auto-sélectionnée : on n'y entre qu'en décidant de logger ;    │
// │   - déjà entraînée : le sédentaire n'y figure pas ;                │
// │   - majoritairement masculine et jeune ;                           │
// │   - déclarative : les charges ne sont pas vérifiées.               │
// │                                                                    │
// │ Le « 50e percentile » signifie donc : médiane DES PRATIQUANTS QUI  │
// │ SUIVENT LEURS CHARGES. Rapporté à la population générale, ce même  │
// │ niveau se situerait bien plus haut — la plupart des adultes n'ont  │
// │ jamais fait de développé couché.                                   │
// │                                                                    │
// │ Le classement reste utile pour se situer entre pratiquants et      │
// │ mesurer sa progression. Il ne dit rien du rang mondial.            │
// └────────────────────────────────────────────────────────────────────┘
//
// Modele : pour un mouvement donne, le ratio (charge soulevee / poids de
// corps) suit approximativement une loi LOG-normale dans cette
// population -- la distribution est bornee a gauche par zero et etalee a
// droite, ce qu'une gaussienne simple modelise mal.
//
// On calibre donc ln(ratio) ~ N(mu, sigma) a partir de deux ancres
// issues des tables de reference type StrengthLevel :
//   mu    = ln(ratio intermediaire)   -> 50e percentile
//   sigma = (ln(ratio avance) - mu) / z(0.80)
//
// Le percentile devient alors continu et extrapolable, la ou une simple
// interpolation par paliers saturerait aux extremites.

import { normalCdf, normalInv, clamp } from './stats-math.js';

const Z80 = 0.8416212335729143; // quantile normal a 80 %

/**
 * Ratios charge/poids de corps par niveau, HOMME.
 * Ordre : [debutant, novice, intermediaire, avance, elite]
 * Valeurs alignees sur les tables publiques de standards de force pour
 * un 1RM, athlete adulte, categorie de poids moyenne.
 */
const MALE_STANDARDS = {
  bench_press:    [0.50, 0.75, 1.25, 1.75, 2.20],
  squat:          [0.75, 1.25, 1.75, 2.50, 3.20],
  deadlift:       [1.00, 1.50, 2.25, 3.00, 3.70],
  overhead_press: [0.35, 0.55, 0.80, 1.10, 1.45],
  barbell_row:    [0.50, 0.75, 1.00, 1.40, 1.85],
  pull_up:        [1.00, 1.15, 1.45, 1.85, 2.30], // charge totale / PDC
  dip:            [1.00, 1.20, 1.55, 2.00, 2.50],
  front_squat:    [0.60, 1.00, 1.45, 2.05, 2.60],
  hip_thrust:     [1.00, 1.60, 2.35, 3.20, 4.10],
  leg_press:      [1.20, 2.00, 3.00, 4.20, 5.40],
  bicep_curl:     [0.30, 0.45, 0.65, 0.90, 1.20],
  lat_pulldown:   [0.55, 0.80, 1.10, 1.45, 1.85],
  push_up:        [0.40, 0.55, 0.70, 0.85, 1.00],
};

/**
 * Rapport femme/homme a niveau egal. Il varie fortement selon le
 * mouvement : l'ecart est maximal sur le haut du corps (masse musculaire
 * relative), nettement plus faible sur le bas du corps.
 */
const FEMALE_RATIO = {
  bench_press: 0.60,
  squat: 0.72,
  deadlift: 0.73,
  overhead_press: 0.60,
  barbell_row: 0.65,
  pull_up: 0.80,
  dip: 0.80,
  front_squat: 0.72,
  hip_thrust: 0.80,
  leg_press: 0.75,
  bicep_curl: 0.60,
  lat_pulldown: 0.65,
  push_up: 0.65,
};

const DEFAULT_FEMALE_RATIO = 0.68;

/** Mouvements exprimes en charge TOTALE (poids de corps inclus). */
const BODYWEIGHT_LIFTS = new Set(['pull_up', 'dip', 'push_up']);

/** Fraction du poids de corps effectivement mobilisee. */
const BODYWEIGHT_FRACTION = {
  pull_up: 1.0,
  dip: 1.0,
  push_up: 0.64, // appui sur les mains en position haute
};

/** Reconnaissance du mouvement de reference a partir du libelle. */
const LIFT_PATTERNS = [
  [/\b(developpe couche|bench press)\b/i, 'bench_press'],
  [/\b(front squat|squat avant)\b/i, 'front_squat'],
  [/\b(hack squat|squat)\b/i, 'squat'],
  [/\b(souleve de terre|deadlift)\b/i, 'deadlift'],
  [/\b(developpe militaire|developpe vertical|overhead press|military press)\b/i, 'overhead_press'],
  [/\b(rowing|barbell row|bent over row)\b/i, 'barbell_row'],
  [/\b(traction|pull[- ]?up|chin[- ]?up)\b/i, 'pull_up'],
  [/\b(dips?)\b/i, 'dip'],
  [/\b(hip thrust|pont fessier)\b/i, 'hip_thrust'],
  [/\b(presse a cuisses|leg press)\b/i, 'leg_press'],
  [/\b(curl)\b/i, 'bicep_curl'],
  [/\b(tirage vertical|lat pulldown|pulldown)\b/i, 'lat_pulldown'],
  [/\b(pompe|push[- ]?up)\b/i, 'push_up'],
];

/** Identifie le mouvement de reference, ou null si non standardise. */
export function matchLift(exerciseName) {
  const name = (exerciseName ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  for (const [pattern, lift] of LIFT_PATTERNS) {
    if (pattern.test(name)) return lift;
  }
  return null;
}

/** Table de standards applicable, ajustee au sexe. */
export function standardsFor(lift, sex) {
  const base = MALE_STANDARDS[lift];
  if (!base) return null;
  if (sex !== 'female') return base;
  const factor = FEMALE_RATIO[lift] ?? DEFAULT_FEMALE_RATIO;
  return base.map((v) => v * factor);
}

/**
 * Estimation du 1RM.
 * Epley au-dela d'une repetition ; la formule derive au-dela de ~12 reps,
 * on borne donc l'extrapolation plutot que de produire un chiffre faux.
 */
export function estimateOneRepMax(weightKg, reps) {
  if (!(weightKg > 0) || !(reps > 0)) return null;
  if (reps === 1) return weightKg;
  const effectiveReps = Math.min(reps, 12);
  return weightKg * (1 + effectiveReps / 30);
}

/** Fiabilite de l'estimation : elle chute quand le nombre de reps monte. */
export function oneRepMaxConfidence(reps) {
  if (reps <= 1) return 1;
  if (reps <= 5) return 0.95;
  if (reps <= 8) return 0.85;
  if (reps <= 12) return 0.7;
  return 0.5;
}

/**
 * Percentile d'une performance DANS LA POPULATION DE RÉFÉRENCE
 * (pratiquants qui suivent leurs charges) — pas dans la population
 * mondiale. Voir l'encadré en tête de fichier.
 *
 * @returns {{percentile:number, z:number, ratio:number, level:string}}
 */
export function percentileFor({ lift, sex, bodyweightKg, oneRepMaxKg, addedWeightKg = 0 }) {
  const standards = standardsFor(lift, sex);
  if (!standards || !(bodyweightKg > 0)) return null;

  // Charge de reference : totale pour les mouvements au poids de corps.
  let load = oneRepMaxKg;
  if (BODYWEIGHT_LIFTS.has(lift)) {
    const fraction = BODYWEIGHT_FRACTION[lift] ?? 1;
    load = bodyweightKg * fraction + addedWeightKg;
  }
  if (!(load > 0)) return null;

  const ratio = load / bodyweightKg;
  const [, , intermediate, advanced] = standards;

  const mu = Math.log(intermediate);
  const sigma = (Math.log(advanced) - mu) / Z80;
  if (!(sigma > 0)) return null;

  const z = (Math.log(ratio) - mu) / sigma;
  const percentile = clamp(normalCdf(z) * 100, 0.1, 99.9);

  return { percentile, z, ratio, level: levelFor(ratio, standards) };
}

/** Palier nomme correspondant a un ratio. */
export function levelFor(ratio, standards) {
  const labels = ['Debutant', 'Novice', 'Intermediaire', 'Avance', 'Elite'];
  let level = 'Non classe';
  for (let i = 0; i < standards.length; i += 1) {
    if (ratio >= standards[i]) level = labels[i];
  }
  return level;
}

/** Charge attendue, en kg, pour un percentile vise. */
export function loadForPercentile({ lift, sex, bodyweightKg, percentile }) {
  const standards = standardsFor(lift, sex);
  if (!standards || !(bodyweightKg > 0)) return null;
  const [, , intermediate, advanced] = standards;
  const mu = Math.log(intermediate);
  const sigma = (Math.log(advanced) - mu) / Z80;
  const z = normalInv(clamp(percentile, 0.1, 99.9) / 100);
  return Math.exp(mu + z * sigma) * bodyweightKg;
}



/**
 * Description de la population de référence, servie par l'API et
 * affichée dans l'interface.
 *
 * Un score de classement sans énoncé de sa base est trompeur : il donne
 * l'autorité d'une mesure à ce qui n'est qu'un modèle. On expose donc
 * la base, ses biais et sa portée avec le chiffre.
 */
export const REFERENCE_POPULATION = {
  label: 'Pratiquants qui suivent leurs charges',
  short: 'population de référence',
  basis:
    'Tables de standards de force publiques, calculées sur les charges '
    + 'déclarées par les utilisateurs d’applications de suivi de musculation.',
  model:
    'Ratio charge/poids de corps modélisé par une loi log-normale, calibrée '
    + 'sur deux ancres des tables (intermédiaire = 50e, avancé = 80e).',
  biases: [
    'Auto-sélection : n’y figurent que ceux qui décident de logger leurs séances.',
    'Population déjà entraînée : les sédentaires en sont absents.',
    'Majoritairement masculine et jeune.',
    'Charges déclaratives, non vérifiées, et exécution non contrôlée.',
  ],
  caveat:
    'Ce n’est pas un classement mondial. Rapporté à la population générale, '
    + 'un même niveau se situerait bien plus haut : la plupart des adultes '
    + 'n’ont jamais réalisé de 1RM.',
  useful_for: [
    'Se situer parmi les pratiquants.',
    'Repérer un déséquilibre entre mouvements.',
    'Mesurer sa progression dans le temps.',
  ],
};
