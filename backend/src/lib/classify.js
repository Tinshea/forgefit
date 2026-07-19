// Classification des exercices.
//
// Le dataset ne porte aucune notion de discipline : `category` et
// `body_part` sont des regions anatomiques ("upper arms", "waist"). La
// separation musculation / callisthenie / stretching demandee doit donc
// etre derivee du materiel et du libelle.

const STRETCH_RE = /\b(stretch|stretching|mobility|foam roll|thoracic rotation)\b/i;

// Marqueurs d'amplitude ACTIVE. Un exercice d'assouplissement qui les
// porte releve de la mobilite, pas de la souplesse : il y a production
// de force et controle moteur, pas un simple allongement tenu.
//
// L'auto-massage (rouleau) est range en mobilite : l'objectif est de
// restaurer le glissement des tissus et l'amplitude utilisable, pas
// d'allonger passivement.
const ACTIVE_MOBILITY_RE =
  /\b(circles?|mobility|dynamic|cars|controlled articular|swing|walkout|inchworm|thread the needle|windmill|roller|foam roll|saw)\b/i;
const EXPLOSIVE_RE =
  /\b(jump|jumping|clean|snatch|jerk|plyo|plyometric|box|burpee|throw|sprint|explosive|hop|bound|kip)\b/i;
// Mouvements de callisthenie qui restent de la callisthenie une fois lestes.
const CALISTHENIC_RE =
  /\b(pull[- ]?up|chin[- ]?up|push[- ]?up|dip|dips|muscle[- ]?up|sit[- ]?up|crunch|plank|pistol|lunge|squat|bridge|hanging|leg raise|handstand|burpee|mountain climber)\b/i;

/** Materiels qui n'ajoutent aucune charge externe. */
const BODYWEIGHT_EQUIPMENT = new Set(['body weight', 'assisted']);

/** Materiels de mobilite / auto-massage. */
const MOBILITY_EQUIPMENT = new Set(['roller']);

/**
 * Discipline : 'musculation' | 'callisthenie' | 'mobilite' | 'souplesse'
 *            | 'cardio'.
 * L'ordre des tests compte : un etirement au poids de corps reste un
 * etirement, pas de la callisthenie.
 */
export function classifyDiscipline(exercise) {
  const name = exercise.name ?? '';
  const equipment = (exercise.equipment ?? '').toLowerCase();
  const category = (exercise.category ?? '').toLowerCase();

  if (STRETCH_RE.test(name) || MOBILITY_EQUIPMENT.has(equipment)) {
    // Actif -> mobilite ; tenu passivement -> souplesse.
    return ACTIVE_MOBILITY_RE.test(name) || MOBILITY_EQUIPMENT.has(equipment)
      ? 'mobilite'
      : 'souplesse';
  }
  if (category === 'cardio') return 'cardio';
  if (BODYWEIGHT_EQUIPMENT.has(equipment)) return 'callisthenie';
  // "weighted" = mouvement au poids de corps leste (traction lestee,
  // dips lestes) : c'est de la callisthenie chargee, pas de la fonte.
  if (equipment === 'weighted' && CALISTHENIC_RE.test(name)) return 'callisthenie';
  return 'musculation';
}

// Muscle primaire -> axe athletique.
const TARGET_AXIS = new Map(Object.entries({
  pectorals: 'push',
  delts: 'push',
  triceps: 'push',
  'serratus anterior': 'push',

  lats: 'pull',
  'upper back': 'pull',
  biceps: 'pull',
  traps: 'pull',
  forearms: 'pull',
  'levator scapulae': 'pull',

  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',

  abs: 'core',
  spine: 'core',

  'cardiovascular system': 'endurance',
}));

/**
 * Axe athletique.
 * Renvoie: push | pull | legs | endurance | mobility | flexibility
 *        | explosive | core
 *
 * Deux axes ne figurent pas tels quels sur le radar a 6 branches :
 *  - 'core' : le gainage est comptabilise dans l'endurance au scoring,
 *    et sert directement a la heatmap corporelle.
 *  - 'flexibility' : la souplesse est fusionnee avec la mobilite sur la
 *    branche du radar, mais les deux scores restent calcules et
 *    affiches separement (cf. scoring.js).
 */
export function classifyAxis(exercise, discipline) {
  if (discipline === 'mobilite') return 'mobility';
  if (discipline === 'souplesse') return 'flexibility';
  if (discipline === 'cardio') return 'endurance';
  // L'explosivite prime sur le muscle cible : un squat saute travaille
  // les quadriceps mais se juge sur la puissance.
  if (EXPLOSIVE_RE.test(exercise.name ?? '')) return 'explosive';

  const target = (exercise.target ?? '').toLowerCase();
  return TARGET_AXIS.get(target) ?? 'core';
}

/**
 * Normalise un libelle de muscle vers le vocabulaire de `target`.
 *
 * Le dataset emploie DEUX vocabulaires : `target` dit "delts",
 * "pectorals", "quads" ; `secondary_muscles` dit "shoulders", "chest",
 * "quadriceps" pour les memes muscles. Sans reconciliation :
 *   - la heatmap agrege "shoulders" et "delts" comme deux muscles
 *     distincts, et sous-compte donc le travail secondaire (400
 *     occurrences de "shoulders" a elles seules) ;
 *   - le schema anatomique n'allume pas les regions concernees.
 *
 * On aligne sur le vocabulaire de `target`, qui sert deja de cle aux
 * regions SVG.
 */
const MUSCLE_ALIASES = new Map(Object.entries({
  // Epaules
  shoulders: 'delts',
  deltoids: 'delts',
  'rear deltoids': 'delts',
  'rotator cuff': 'delts',

  // Pectoraux
  chest: 'pectorals',
  'upper chest': 'pectorals',

  // Jambes
  quadriceps: 'quads',
  soleus: 'calves',
  shins: 'calves',
  ankles: 'calves',
  'ankle stabilizers': 'calves',
  feet: 'calves',
  'inner thighs': 'adductors',
  groin: 'adductors',

  // Dos
  trapezius: 'traps',
  rhomboids: 'upper back',
  back: 'upper back',
  'latissimus dorsi': 'lats',

  // Tronc
  core: 'abs',
  abdominals: 'abs',
  'lower abs': 'abs',
  obliques: 'abs',

  // Bras
  brachialis: 'biceps',
  wrists: 'forearms',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  hands: 'forearms',
  'grip muscles': 'forearms',
}));

export function normalizeMuscle(raw) {
  const key = String(raw ?? '').toLowerCase().trim();
  if (!key) return null;
  return MUSCLE_ALIASES.get(key) ?? key;
}

/** Normalise une liste, deduplique, et retire le muscle principal. */
export function normalizeSecondary(list, primary) {
  const target = normalizeMuscle(primary);
  const out = new Set();
  for (const m of list ?? []) {
    const norm = normalizeMuscle(m);
    // Un muscle deja principal ne doit pas etre compte une seconde fois
    // en secondaire : il serait pondere deux fois dans la fatigue.
    if (norm && norm !== target) out.add(norm);
  }
  return [...out];
}
