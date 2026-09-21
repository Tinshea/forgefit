// Paramètres d'entraînement issus de la littérature.
//
// Chaque valeur porte sa source. Un générateur de programme qui sort des
// chiffres sans référence n'est qu'une opinion déguisée en algorithme :
// on doit pouvoir vérifier, contester et mettre à jour chaque paramètre.
//
// L'unité de dosage est la SÉRIE HEBDOMADAIRE PAR GROUPE MUSCULAIRE.
// C'est la variable sur laquelle porte la relation dose-réponse, et non
// le nombre d'exercices par séance — deux programmes à 6 exercices
// peuvent différer du simple au double en volume réel.

/**
 * Volume hebdomadaire par groupe musculaire, en séries dures.
 *
 * Schoenfeld, Ogborn & Krieger (2017), méta-analyse dose-réponse :
 * relation quasi linéaire entre séries hebdomadaires et hypertrophie,
 * ≈ +0,37 % de gain par série hebdomadaire supplémentaire. Moins de 5
 * séries produit un effet, 5–9 un effet net, ≥ 10 le meilleur effet
 * observé. Au-delà d'une vingtaine, les gains marginaux s'aplatissent
 * et la récupération devient le facteur limitant.
 */
export const WEEKLY_SETS = {
  // Volume minimal d'entretien : conserve les acquis sans progresser.
  maintenance: 6,
  // Volume minimal efficace : seuil de progression.
  minimumEffective: 10,
  // Fenêtre d'adaptation : la zone où l'on veut placer un point faible.
  adaptiveRange: [12, 20],
  // Plafond raisonnable : au-delà, la récupération limite le rendement.
  maximumRecoverable: 22,
  source: 'Schoenfeld, Ogborn & Krieger (2017), J Sports Sci — '
    + 'méta-analyse dose-réponse volume / hypertrophie',
};

/**
 * Fréquence par groupe musculaire.
 *
 * Schoenfeld et al. (2016/2018) : à volume hebdomadaire ÉGAL, répartir
 * en 2 séances ou plus par muscle donne de meilleurs résultats qu'une
 * seule. L'effet vient de la répartition, pas du volume supplémentaire.
 */
export const FREQUENCY = {
  minimumPerMuscle: 2,
  source: 'Schoenfeld, Ogborn & Krieger (2016), Sports Med — '
    + 'méta-analyse fréquence hebdomadaire, à volume équivalent',
};

/**
 * Repos entre les séries.
 *
 * Les repos courts (≈ 1 min) réduisent le volume réalisable aux séries
 * suivantes et pénalisent l'hypertrophie face à des repos de 2–3 min.
 * En force, la restauration du système nerveux prime : 3–5 min.
 */
export const REST = {
  strength: [180, 300],
  hypertrophy: [120, 180],
  endurance: [45, 90],
  source: 'Schoenfeld et al. (2016) et méta-analyse bayésienne sur la '
    + 'durée des intervalles inter-séries (2024)',
};

/**
 * Proximité de l'échec, en répétitions en réserve (RIR).
 *
 * S'entraîner jusqu'à l'échec n'est pas nécessaire : à volume égal,
 * 1–3 RIR produit une hypertrophie comparable, avec nettement moins de
 * fatigue neuromusculaire (perte de vitesse −8 % à 3 RIR contre −25 %
 * à l'échec) et une récupération plus rapide.
 */
const PROXIMITY_TO_FAILURE = {
  hypertrophy: [1, 3],
  strength: [2, 4],
  source: 'Refalo et al. (2024) et travaux sur la proximité de l’échec '
    + 'mesurée en RIR',
};

/**
 * Intensité et répétitions par objectif.
 *
 * L'hypertrophie tolère une plage large (≈ 60–80 % du 1RM) dès lors que
 * le volume est équivalent et les séries proches de l'échec. La force
 * maximale, elle, exige des charges élevées : l'adaptation y est en
 * grande partie nerveuse et spécifique à la charge.
 */
export const GOALS = {
  force: {
    label: 'Force maximale',
    reps: [3, 6],
    repsTarget: 5,
    intensity: 0.85,
    intensityRange: [0.80, 0.90],
    setsPerExercise: 4,
    rest: 210,
    rir: PROXIMITY_TO_FAILURE.strength,
    // En force, la charge élevée coûte cher en récupération : on vise le
    // bas de la fenêtre d'adaptation.
    weeklySetsTarget: 12,
    rationale: 'Charges ≥ 80 % du 1RM : l’adaptation est largement nerveuse '
      + 'et spécifique à la charge travaillée.',
  },
  hypertrophie: {
    label: 'Hypertrophie',
    reps: [6, 12],
    repsTarget: 9,
    intensity: 0.72,
    intensityRange: [0.65, 0.80],
    setsPerExercise: 3,
    rest: 150,
    rir: PROXIMITY_TO_FAILURE.hypertrophy,
    // Haut de la fenêtre d'adaptation : c'est le volume qui pilote.
    weeklySetsTarget: 18,
    rationale: 'Le volume hebdomadaire est le principal moteur : ≈ +0,37 % '
      + 'de gain par série hebdomadaire supplémentaire.',
  },
  equilibre: {
    label: 'Équilibré',
    reps: [6, 10],
    repsTarget: 8,
    intensity: 0.75,
    intensityRange: [0.70, 0.82],
    setsPerExercise: 3,
    rest: 150,
    rir: PROXIMITY_TO_FAILURE.hypertrophy,
    weeklySetsTarget: 14,
    rationale: 'Compromis force / hypertrophie, dans la fenêtre '
      + 'd’adaptation basse.',
  },
  mobilite: {
    label: 'Mobilité & santé',
    reps: [10, 15],
    repsTarget: 12,
    intensity: 0.55,
    intensityRange: [0.45, 0.65],
    setsPerExercise: 2,
    rest: 75,
    rir: [3, 5],
    weeklySetsTarget: 10,
    rationale: 'Volume minimal efficace, charges modérées, priorité à '
      + 'l’amplitude et à la régularité.',
  },
};

/**
 * Endurance : repères d'activité physique.
 *
 * Ce ne sont pas des repères de performance mais de SANTÉ. Ils valent
 * pour l'activité modérée cumulée — marche comprise —, pas seulement
 * pour les séances déclarées comme telles.
 */
export const AEROBIC = {
  // Plancher hebdomadaire, en minutes d'intensité modérée.
  weeklyMinutesFloor: 150,
  weeklyMinutesUpper: 300,
  // Équivalence : une minute d'intensité vigoureuse en vaut deux de
  // modérée. C'est la conversion retenue par les recommandations.
  vigorousEquivalence: 2,
  source: 'OMS (2020), Lignes directrices sur l’activité physique et la sédentarité — '
    + '150 à 300 min d’activité modérée par semaine, ou 75 à 150 min d’activité '
    + 'vigoureuse, et un renforcement musculaire ≥ 2 jours par semaine',
};

/**
 * Dosage du travail chronométré (mobilité, souplesse).
 *
 * L'étirement statique produit son effet par le temps cumulé sous
 * tension ; la mobilité active par la fréquence et l'amplitude.
 */
export const TIMED_WORK = {
  flexibility: { holdSeconds: 40, setsPerExercise: 2, weeklyMinutesTarget: 10 },
  mobility: { holdSeconds: 30, setsPerExercise: 2, weeklyMinutesTarget: 8 },
  source: 'Recommandations générales sur l’amplitude articulaire : le '
    + 'temps total sous étirement prime sur la durée d’une répétition.',
};

/** Toutes les sources, pour affichage dans l'interface. */
export const SOURCES = [
  {
    claim: 'Volume hebdomadaire par muscle (≥ 10 séries, plafond ≈ 22)',
    source: WEEKLY_SETS.source,
  },
  { claim: 'Fréquence ≥ 2 séances par muscle et par semaine', source: FREQUENCY.source },
  { claim: 'Repos inter-séries selon l’objectif', source: REST.source },
  { claim: 'Arrêt des séries à 1–3 répétitions de la réserve', source: PROXIMITY_TO_FAILURE.source },
  { claim: 'Dosage du travail d’amplitude', source: TIMED_WORK.source },
  { claim: 'Volume hebdomadaire d’endurance (150–300 min modérées)', source: AEROBIC.source },
];
