// Modèles de programme, par catégorie.
//
// Un modèle est une STRUCTURE EN PATRONS DE MOUVEMENT, pas une liste
// d'exercices. « Un tirage vertical » survit à un changement de salle ;
// « traction à la barre fixe » non. C'est ce qui permet au même modèle
// de s'instancier en salle complète, avec deux haltères ou à mains nues :
// seule la résolution patron → exercice change.
//
// Le dosage suit les mêmes repères que le générateur (`evidence.js`) :
// séries hebdomadaires par groupe musculaire, fréquence ≥ 2, arrêt des
// séries à 1–3 répétitions de la réserve. Un modèle qui sortirait de ces
// bornes serait signalé par `templateVolume()` plutôt que corrigé en
// douce — le lecteur doit voir l'écart.
//
// Aucun de ces modèles n'est validé par un professionnel de santé. Ils
// appliquent des paramètres publiés, cités modèle par modèle.

import { WEEKLY_SETS, FREQUENCY, GOALS, AEROBIC } from './evidence.js';
import {
  MOVEMENT_PATTERNS, MUSCLE_GROUPS, SECONDARY_WEIGHT, REFERENCES,
} from './exercise-evidence.js';

// ---------------------------------------------------------------------
// Profils de matériel
//
// Le filtre porte sur la colonne `equipment` du dataset, dont les
// valeurs sont figées à l'ingestion. `null` = aucune restriction.
// ---------------------------------------------------------------------

export const EQUIPMENT_PROFILES = {
  salle: {
    label: 'Salle complète',
    hint: 'Barres, haltères, poulies et machines.',
    equipment: null,
  },
  barre: {
    label: 'Barre et rack',
    hint: 'Garage ou salle minimale : barre, disques, banc, barre fixe.',
    equipment: ['barbell', 'ez barbell', 'olympic barbell', 'trap bar',
      'dumbbell', 'body weight', 'weighted', 'assisted'],
  },
  halteres: {
    label: 'Deux haltères',
    hint: 'À la maison : une paire d’haltères, un banc, éventuellement des élastiques.',
    equipment: ['dumbbell', 'body weight', 'kettlebell', 'band',
      'resistance band', 'weighted', 'stability ball'],
  },
  poids_du_corps: {
    label: 'Poids du corps',
    hint: 'Aucun matériel, hors barre fixe ou barres parallèles.',
    equipment: ['body weight', 'assisted', 'weighted', 'band', 'resistance band', 'rope'],
  },
};

export const TEMPLATE_CATEGORIES = [
  {
    key: 'demarrage',
    label: 'Démarrage',
    hint: 'Peu de séances, mouvements de base, marge de progression longue.',
  },
  {
    key: 'hypertrophie',
    label: 'Prise de muscle',
    hint: 'Volume hebdomadaire élevé, réparti sur au moins deux séances par muscle.',
  },
  {
    key: 'force',
    label: 'Force maximale',
    hint: 'Charges lourdes, peu de répétitions, repos longs.',
  },
  {
    key: 'sans_salle',
    label: 'Sans salle',
    hint: 'Poids du corps ou deux haltères, à la maison.',
  },
  {
    key: 'cardio',
    label: 'Endurance',
    hint: 'Capacité aérobie : sorties longues faciles et fractionné, dans la bonne proportion.',
  },
  {
    key: 'hybride',
    label: 'Force et endurance',
    hint: 'Les deux à la fois, en limitant ce que l’une coûte à l’autre.',
  },
  {
    key: 'sante',
    label: 'Santé & mobilité',
    hint: 'Le minimum qui compte : recommandations d’activité physique et amplitude.',
  },
];

// Raccourci de lecture : un créneau de séance.
const s = (pattern, sets, reps, opts = {}) => ({
  pattern,
  sets,
  reps: Array.isArray(reps) ? reps[0] : reps,
  reps_max: Array.isArray(reps) ? reps[1] : null,
  seconds: opts.seconds ?? null,
  rest: opts.rest ?? 150,
  note: opts.note ?? null,
});

// Créneau chronométré (gainage, mobilité, souplesse).
const t = (pattern, sets, seconds, opts = {}) => ({
  pattern,
  sets,
  reps: null,
  reps_max: null,
  seconds,
  rest: opts.rest ?? 60,
  note: opts.note ?? null,
});

const PER_LEG = { note: 'par jambe' };

export const TEMPLATES = [
  // -------------------------------------------------------------------
  {
    key: 'demarrage-3',
    name: 'Corps entier — 3 jours',
    category: 'demarrage',
    level: 'Débutant',
    goal: 'equilibre',
    days_per_week: 3,
    weeks: 8,
    equipment_profile: 'salle',
    summary: 'Trois séances identiques en structure, différentes en dosage. Chaque muscle '
      + 'est travaillé trois fois par semaine.',
    why: [
      'En corps entier, chaque muscle revient trois fois par semaine — bien au-delà du '
        + 'minimum de deux, et c’est la répartition qui fait la différence à volume égal.',
      'Le volume par séance reste modeste : c’est le total hebdomadaire qui compte, pas '
        + 'la longueur d’une séance.',
      'Les fourchettes de répétitions servent la double progression : on monte les '
        + 'répétitions jusqu’au haut de la fourchette, puis on augmente la charge et on '
        + 'repart en bas.',
    ],
    sources: ['schoenfeld2016frequency', 'schoenfeld2017volume', 'progression2022'],
    days: [
      {
        title: 'Corps entier A', focus: 'legs',
        slots: [
          s('squat', 3, [8, 10], { rest: 180 }),
          s('horizontal_push', 3, [8, 10], { rest: 150 }),
          s('horizontal_pull', 3, [10, 12], { rest: 120 }),
          s('hinge', 2, [10, 12], { rest: 150 }),
          s('shoulder_abduction', 2, [12, 15], { rest: 60 }),
          t('core_antiextension', 2, 40),
        ],
      },
      {
        title: 'Corps entier B', focus: 'push',
        slots: [
          s('hinge', 3, [6, 8], { rest: 180 }),
          s('vertical_push', 3, [8, 10], { rest: 150 }),
          s('vertical_pull', 3, [6, 10], { rest: 150 }),
          s('lunge', 2, [10, 12], { rest: 120, ...PER_LEG }),
          s('calf', 2, [12, 15], { rest: 60 }),
          s('core_flexion', 2, [12, 15], { rest: 60 }),
        ],
      },
      {
        title: 'Corps entier C', focus: 'pull',
        slots: [
          s('squat', 3, [10, 12], { rest: 150 }),
          s('horizontal_push', 4, [10, 12], { rest: 150 }),
          s('horizontal_pull', 3, [12, 15], { rest: 120 }),
          s('knee_flexion', 3, [10, 12], { rest: 90 }),
          s('calf', 3, [12, 15], { rest: 60 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'haut-bas-4',
    name: 'Haut / Bas — 4 jours',
    category: 'hypertrophie',
    level: 'Intermédiaire',
    goal: 'hypertrophie',
    days_per_week: 4,
    weeks: 8,
    equipment_profile: 'salle',
    summary: 'Deux séances de haut du corps, deux de bas. Le compromis le plus court '
      + 'entre volume élevé et fréquence de deux par muscle.',
    why: [
      'Quatre séances suffisent à donner deux passages par muscle, le seuil au-delà '
        + 'duquel répartir cesse d’apporter à volume constant.',
      'Le volume vise le haut de la fenêtre d’adaptation (12–20 séries par muscle et '
        + 'par semaine), sans dépasser le plafond récupérable de 22.',
      'Les isolations retenues ne doublent pas les polyarticulaires : elles couvrent ce '
        + 'que ceux-ci laissent de côté — droit fémoral, chef long du triceps, '
        + 'deltoïde postérieur.',
    ],
    sources: ['schoenfeld2017volume', 'schoenfeld2016frequency',
      'kassiano2026quads', 'maeo2023triceps'],
    days: [
      {
        title: 'Haut du corps A', focus: 'push',
        slots: [
          s('horizontal_push', 4, [6, 8], { rest: 180 }),
          s('vertical_pull', 4, [8, 10], { rest: 150 }),
          s('vertical_push', 3, [10, 12], { rest: 150 }),
          s('horizontal_pull', 3, [10, 12], { rest: 120 }),
          s('elbow_extension', 3, [10, 12], { rest: 90 }),
          s('elbow_flexion', 3, [10, 12], { rest: 90 }),
        ],
      },
      {
        title: 'Bas du corps A', focus: 'legs',
        slots: [
          s('squat', 4, [6, 8], { rest: 210 }),
          s('knee_flexion', 3, [10, 12], { rest: 90 }),
          s('lunge', 3, [10, 12], { rest: 120, ...PER_LEG }),
          s('calf', 4, [12, 15], { rest: 60 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Haut du corps B', focus: 'pull',
        slots: [
          s('horizontal_pull', 4, [8, 10], { rest: 150 }),
          s('horizontal_push', 4, [10, 12], { rest: 150 }),
          s('vertical_pull', 3, [10, 12], { rest: 120 }),
          s('shoulder_abduction', 4, [12, 15], { rest: 75 }),
          s('rear_delt', 3, [15, 20], { rest: 60 }),
          s('elbow_extension', 3, [12, 15], { rest: 90 }),
        ],
      },
      {
        title: 'Bas du corps B', focus: 'legs',
        slots: [
          s('hinge', 4, [6, 8], { rest: 210 }),
          s('knee_extension', 3, [12, 15], { rest: 90 }),
          s('hip_extension', 3, [10, 12], { rest: 120 }),
          s('calf', 3, [15, 20], { rest: 60 }),
          s('elbow_flexion', 3, [10, 12], { rest: 75 }),
          s('core_flexion', 3, [12, 15], { rest: 60 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'ppl-6',
    name: 'Poussée / Tirage / Jambes — 6 jours',
    category: 'hypertrophie',
    level: 'Avancé',
    goal: 'hypertrophie',
    days_per_week: 6,
    weeks: 6,
    equipment_profile: 'salle',
    summary: 'Le cycle poussée / tirage / jambes répété deux fois. Volume maximal, '
      + 'exigence de récupération maximale.',
    why: [
      'Six séances permettent de placer le volume près du plafond récupérable sans '
        + 'jamais dépasser une poignée d’exercices par séance.',
      'Chaque groupe revient deux fois par semaine : la fréquence est respectée malgré '
        + 'la spécialisation de chaque journée.',
      'La seconde passe de chaque axe travaille en répétitions plus hautes que la '
        + 'première : le volume total prime, et varier la charge répartit la fatigue.',
      'À ce niveau de volume, la récupération devient le facteur limitant. Un sommeil '
        + 'ou un apport alimentaire insuffisant annule le surplus de séries.',
    ],
    sources: ['schoenfeld2017volume', 'schoenfeld2016frequency', 'lengthened2025'],
    days: [
      {
        title: 'Poussée A', focus: 'push',
        slots: [
          s('horizontal_push', 4, [5, 7], { rest: 210 }),
          s('vertical_push', 3, [8, 10], { rest: 150 }),
          s('chest_isolation', 3, [12, 15], { rest: 75 }),
          s('shoulder_abduction', 3, [12, 15], { rest: 60 }),
          s('elbow_extension', 3, [10, 12], { rest: 90 }),
        ],
      },
      {
        title: 'Tirage A', focus: 'pull',
        slots: [
          s('vertical_pull', 4, [6, 8], { rest: 180 }),
          s('horizontal_pull', 4, [8, 10], { rest: 150 }),
          s('rear_delt', 3, [15, 20], { rest: 60 }),
          s('elbow_flexion', 3, [8, 10], { rest: 90 }),
        ],
      },
      {
        title: 'Jambes A', focus: 'legs',
        slots: [
          s('squat', 4, [5, 7], { rest: 240 }),
          s('knee_flexion', 3, [10, 12], { rest: 90 }),
          s('lunge', 3, [10, 12], { rest: 120, ...PER_LEG }),
          s('calf', 4, [10, 12], { rest: 60 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Poussée B', focus: 'push',
        slots: [
          s('vertical_push', 4, [8, 10], { rest: 180 }),
          s('horizontal_push', 4, [10, 12], { rest: 150 }),
          s('chest_isolation', 3, [15, 20], { rest: 60 }),
          s('shoulder_abduction', 4, [15, 20], { rest: 60 }),
          s('elbow_extension', 3, [12, 15], { rest: 75 }),
        ],
      },
      {
        title: 'Tirage B', focus: 'pull',
        slots: [
          s('horizontal_pull', 4, [10, 12], { rest: 150 }),
          s('vertical_pull', 4, [10, 12], { rest: 150 }),
          s('shoulder_extension', 3, [12, 15], { rest: 75 }),
          s('elbow_flexion', 3, [12, 15], { rest: 75 }),
        ],
      },
      {
        title: 'Jambes B', focus: 'legs',
        slots: [
          s('hinge', 4, [5, 7], { rest: 240 }),
          s('knee_extension', 3, [12, 15], { rest: 90 }),
          s('hip_extension', 3, [10, 12], { rest: 120 }),
          s('calf', 4, [15, 20], { rest: 60 }),
          s('core_flexion', 3, [12, 15], { rest: 60 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'force-3',
    name: 'Force — 3 jours',
    category: 'force',
    level: 'Intermédiaire',
    goal: 'force',
    days_per_week: 3,
    weeks: 8,
    equipment_profile: 'barre',
    summary: 'Une journée par mouvement lourd — squat, développé, soulevé — puis le '
      + 'travail complémentaire qui le soutient.',
    why: [
      'L’adaptation en force maximale est largement nerveuse et spécifique à la charge : '
        + 'elle exige des séries courtes au-dessus de 80 % du 1RM.',
      'Les repos sont longs (3 à 4 min) : couper court ampute les séries suivantes et '
        + 'fait perdre le bénéfice de la charge.',
      'Le volume reste dans le bas de la fenêtre d’adaptation. Lourd et abondant à la '
        + 'fois ne se récupère pas.',
      'Les séries s’arrêtent 2 à 4 répétitions avant l’échec : l’échec ne rend pas plus, '
        + 'il coûte plus.',
    ],
    sources: ['schoenfeld2017volume', 'progression2022'],
    days: [
      {
        title: 'Squat lourd', focus: 'legs',
        slots: [
          s('squat', 5, [3, 5], { rest: 240 }),
          s('hinge', 3, [5, 6], { rest: 210 }),
          s('lunge', 3, [8, 10], { rest: 120, ...PER_LEG }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Développé lourd', focus: 'push',
        slots: [
          s('horizontal_push', 5, [3, 5], { rest: 240 }),
          s('vertical_push', 4, [5, 6], { rest: 210 }),
          s('horizontal_pull', 4, [8, 10], { rest: 150 }),
          s('elbow_extension', 3, [8, 10], { rest: 90 }),
        ],
      },
      {
        title: 'Soulevé lourd', focus: 'pull',
        slots: [
          s('hinge', 5, [3, 4], { rest: 300 }),
          s('vertical_pull', 4, [5, 8], { rest: 180 }),
          s('horizontal_pull', 3, [8, 10], { rest: 150 }),
          s('elbow_flexion', 3, [8, 10], { rest: 90 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'minimal-2',
    name: 'Minimaliste — 2 jours',
    category: 'sante',
    level: 'Débutant',
    goal: 'equilibre',
    days_per_week: 2,
    weeks: 12,
    equipment_profile: 'halteres',
    summary: 'Deux séances par semaine, tous les grands groupes musculaires. Le plancher '
      + 'recommandé par l’OMS, tenu sur la durée.',
    why: [
      'L’OMS recommande un renforcement musculaire de tous les grands groupes au moins '
        + 'deux jours par semaine : ce modèle en est l’application littérale.',
      'Deux séances suffisent à respecter la fréquence de deux passages par muscle — le '
        + 'strict minimum efficace, mais bien au-dessus de zéro.',
      'Le volume vise la progression, pas l’entretien : chaque muscle reçoit autour de '
        + 'dix séries hebdomadaires.',
      'Ce modèle se complète d’activité d’endurance : 150 à 300 minutes par semaine à '
        + 'intensité modérée, marche comprise.',
    ],
    sources: ['who2020', 'schoenfeld2016frequency', 'schoenfeld2017volume'],
    days: [
      {
        title: 'Séance A', focus: 'legs',
        slots: [
          s('squat', 3, [8, 12], { rest: 150 }),
          s('horizontal_push', 3, [8, 12], { rest: 150 }),
          s('horizontal_pull', 3, [10, 12], { rest: 120 }),
          s('calf', 2, [12, 15], { rest: 60 }),
          t('core_antiextension', 2, 45),
        ],
      },
      {
        title: 'Séance B', focus: 'pull',
        slots: [
          s('hinge', 3, [8, 12], { rest: 150 }),
          s('vertical_pull', 3, [6, 12], { rest: 150 }),
          s('vertical_push', 3, [8, 12], { rest: 150 }),
          s('lunge', 2, [10, 12], { rest: 120, ...PER_LEG }),
          s('core_flexion', 2, [12, 15], { rest: 60 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'poids-du-corps-3',
    name: 'Poids du corps — 3 jours',
    category: 'sans_salle',
    level: 'Débutant',
    goal: 'equilibre',
    days_per_week: 3,
    weeks: 8,
    equipment_profile: 'poids_du_corps',
    summary: 'Aucune charge externe. Trois séances de corps entier, pour que chaque muscle '
      + 'revienne trois fois par semaine.',
    why: [
      'Corps entier plutôt que poussée / tirage / jambes : sans charge, le volume par '
        + 'séance est vite plafonné par la fatigue locale. Répartir sur trois passages '
        + 'donne davantage de séries utiles qu’une seule séance spécialisée.',
      'Sans charge réglable, la surcharge progressive passe par les répétitions : les '
        + 'adaptations obtenues sont comparables à une progression en charge.',
      'Les fourchettes sont hautes parce que la résistance, elle, est fixe. Quand le haut '
        + 'de la fourchette devient facile, il faut durcir le levier — pompes déclinées, '
        + 'traction lestée, fente sautée — et non ajouter indéfiniment des répétitions.',
      'Le tirage vertical reste le point dur : sans barre fixe ni élastique, aucun '
        + 'mouvement au poids de corps ne le remplace vraiment. Le tirage horizontal sous '
        + 'une table prend alors le relais.',
    ],
    sources: ['progression2022', 'schoenfeld2016frequency', 'schoenfeld2017volume', 'who2020'],
    days: [
      {
        title: 'Corps entier A', focus: 'push',
        slots: [
          s('horizontal_push', 4, [10, 20], { rest: 120 }),
          s('vertical_pull', 4, [4, 10], { rest: 180 }),
          s('lunge', 3, [12, 20], { rest: 120, ...PER_LEG }),
          s('elbow_extension', 2, [10, 15], { rest: 75 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Corps entier B', focus: 'pull',
        slots: [
          s('horizontal_pull', 4, [10, 15], { rest: 120 }),
          s('vertical_push', 3, [8, 12], { rest: 120 }),
          s('knee_flexion', 3, [6, 10], { rest: 120 }),
          s('hip_extension', 3, [15, 20], { rest: 90 }),
          s('core_flexion', 3, [12, 20], { rest: 60 }),
        ],
      },
      {
        title: 'Corps entier C', focus: 'legs',
        slots: [
          s('squat', 4, [15, 25], { rest: 90 }),
          s('horizontal_push', 3, [12, 20], { rest: 120 }),
          s('vertical_pull', 3, [4, 10], { rest: 150 }),
          s('elbow_flexion', 3, [10, 15], { rest: 75 }),
          s('calf', 3, [20, 30], { rest: 60 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'halteres-3',
    name: 'Deux haltères — 3 jours',
    category: 'sans_salle',
    level: 'Débutant',
    goal: 'hypertrophie',
    days_per_week: 3,
    weeks: 8,
    equipment_profile: 'halteres',
    summary: 'Une paire d’haltères et un banc. Tout le corps, trois fois par semaine.',
    why: [
      'Les haltères couvrent tous les patrons sauf le tirage vertical : le rowing prend '
        + 'le relais, avec un volume de tirage horizontal volontairement plus élevé.',
      'Chaque bras porte sa propre charge : les déséquilibres droite / gauche deviennent '
        + 'visibles au lieu d’être compensés par la barre.',
      'Quand la charge disponible plafonne, la progression passe par les répétitions — '
        + 'les adaptations sont comparables.',
    ],
    sources: ['progression2022', 'schoenfeld2016frequency', 'lengthened2025'],
    days: [
      {
        title: 'Corps entier A', focus: 'push',
        slots: [
          s('horizontal_push', 4, [8, 12], { rest: 150 }),
          s('horizontal_pull', 4, [10, 12], { rest: 150 }),
          s('hinge', 3, [12, 15], { rest: 150 }),
          s('lunge', 3, [10, 12], { rest: 120, ...PER_LEG }),
          s('shoulder_abduction', 3, [12, 15], { rest: 60 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Corps entier B', focus: 'legs',
        slots: [
          s('hinge', 4, [8, 12], { rest: 180 }),
          s('vertical_push', 4, [8, 12], { rest: 150 }),
          s('horizontal_pull', 3, [12, 15], { rest: 120 }),
          s('elbow_flexion', 3, [10, 12], { rest: 75 }),
          s('elbow_extension', 3, [10, 12], { rest: 75 }),
          s('calf', 3, [15, 20], { rest: 60 }),
        ],
      },
      {
        title: 'Corps entier C', focus: 'pull',
        slots: [
          s('squat', 4, [10, 15], { rest: 150 }),
          s('lunge', 3, [10, 12], { rest: 120, ...PER_LEG }),
          s('horizontal_push', 3, [12, 15], { rest: 120 }),
          s('rear_delt', 3, [15, 20], { rest: 60 }),
          s('elbow_extension', 3, [10, 12], { rest: 75 }),
          s('core_flexion', 3, [12, 15], { rest: 60 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'mobilite-sante-3',
    name: 'Mobilité & santé — 3 jours',
    category: 'sante',
    level: 'Tous niveaux',
    goal: 'mobilite',
    days_per_week: 3,
    weeks: 12,
    equipment_profile: 'poids_du_corps',
    summary: 'Amplitude active, étirement tenu et renforcement léger. Pour une reprise, '
      + 'une semaine de décharge, ou en complément d’un autre programme.',
    why: [
      'Mobilité et souplesse sont deux qualités distinctes : l’une est une amplitude '
        + 'contrôlée activement, l’autre une amplitude subie. Les deux sont travaillées '
        + 'séparément ici.',
      'La mobilité se juge à la fréquence, la souplesse au temps cumulé sous tension : '
        + 'les dosages sont donc différents par construction.',
      'Le renforcement léger reste présent : l’OMS le recommande au moins deux jours par '
        + 'semaine quel que soit l’objectif.',
      'À combiner avec 150 à 300 minutes hebdomadaires d’endurance modérée.',
    ],
    sources: ['who2020'],
    days: [
      {
        title: 'Amplitude — haut du corps', focus: 'mobility',
        slots: [
          t('mobility', 2, 40),
          s('horizontal_pull', 3, [12, 15], { rest: 90 }),
          s('vertical_push', 2, [10, 12], { rest: 90 }),
          t('flexibility', 2, 45),
          t('core_antiextension', 2, 40),
        ],
      },
      {
        title: 'Amplitude — bas du corps', focus: 'mobility',
        slots: [
          t('mobility', 2, 40),
          s('squat', 3, [12, 15], { rest: 90 }),
          s('hinge', 3, [10, 12], { rest: 90 }),
          t('flexibility', 3, 45),
          s('calf', 2, [15, 20], { rest: 60 }),
        ],
      },
      {
        title: 'Endurance & tronc', focus: 'endurance',
        slots: [
          t('cardio', 3, 300, { rest: 90, note: 'intensité modérée : conversation encore possible' }),
          t('core_antirotation', 3, 30),
          s('core_flexion', 3, [12, 15], { rest: 60 }),
          t('flexibility', 3, 45),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------
  {
    key: 'endurance-base-3',
    name: 'Endurance — 3 jours',
    category: 'cardio',
    level: 'Intermédiaire',
    goal: 'mobilite',
    days_per_week: 3,
    weeks: 8,
    equipment_profile: 'salle',
    summary: 'Deux sorties longues faciles et une séance de fractionné. La proportion '
      + 'compte plus que l’intensité de chaque séance.',
    why: [
      'Environ 80 % du volume à basse intensité, 15 à 20 % à haute : c’est la '
        + 'répartition qu’adoptent les athlètes d’endurance de tous sports, et très peu '
        + 'de travail se situe entre les deux.',
      'Le facile doit être VRAIMENT facile : on doit pouvoir tenir une conversation. '
        + 'C’est l’erreur la plus courante — des sorties trop dures pour progresser, pas '
        + 'assez pour constituer un stimulus intense.',
      'Une seule séance intense par semaine suffit à ce volume. En ajouter une seconde '
        + 'reviendrait à supprimer la polarisation, donc l’intérêt du modèle.',
      'Le renforcement musculaire reste présent : l’OMS le recommande au moins deux '
        + 'jours par semaine quel que soit l’objectif.',
    ],
    sources: ['seilerPolarized', 'who2020'],
    days: [
      {
        title: 'Sortie longue facile', focus: 'endurance',
        slots: [
          t('cardio', 1, 3600, { rest: 0, note: 'intensité conversationnelle, sans à-coups' }),
          t('flexibility', 2, 45),
        ],
      },
      {
        title: 'Fractionné', focus: 'endurance',
        slots: [
          t('cardio', 1, 600, { rest: 0, note: 'échauffement progressif' }),
          t('cardio_interval', 8, 60, { rest: 60, note: 'effort maximal soutenable 1 min' }),
          t('cardio', 1, 300, { rest: 0, note: 'retour au calme' }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Endurance & renforcement', focus: 'legs',
        slots: [
          t('cardio', 1, 3600, { rest: 0, note: 'intensité conversationnelle' }),
          s('squat', 3, [10, 15], { rest: 120 }),
          s('horizontal_push', 3, [10, 15], { rest: 120 }),
          s('horizontal_pull', 3, [10, 15], { rest: 120 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'fractionne-3',
    name: 'Fractionné court — 3 jours',
    category: 'cardio',
    level: 'Intermédiaire',
    goal: 'mobilite',
    days_per_week: 3,
    weeks: 6,
    equipment_profile: 'poids_du_corps',
    summary: 'Trois séances courtes et denses, sans matériel. Pour qui manque de temps '
      + 'plutôt que de motivation.',
    why: [
      'Le fractionné obtient une partie des adaptations aérobies en bien moins de temps '
        + 'que le travail continu. Il ne le remplace pas : il le complète quand le temps '
        + 'manque.',
      'Trois séances intenses par semaine est un plafond, pas une cible : à ce format, '
        + 'la récupération limite avant le volume.',
      'Ce modèle sort volontairement de la répartition 80/20 — il assume d’être une '
        + 'solution de contrainte de temps, pas un plan de préparation.',
      'À compléter par de la marche quotidienne : l’OMS compte 150 à 300 minutes '
        + 'hebdomadaires d’activité modérée, que trois séances courtes n’atteignent pas.',
    ],
    sources: ['who2020', 'seilerPolarized'],
    days: [
      {
        title: 'Intervalles longs', focus: 'endurance',
        slots: [
          t('cardio', 1, 300, { rest: 0, note: 'échauffement' }),
          t('cardio_interval', 5, 120, { rest: 90 }),
          t('flexibility', 2, 45),
        ],
      },
      {
        title: 'Intervalles courts', focus: 'endurance',
        slots: [
          t('cardio', 1, 300, { rest: 0, note: 'échauffement' }),
          t('cardio_interval', 10, 30, { rest: 30 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Circuit corps entier', focus: 'endurance',
        slots: [
          t('cardio_interval', 4, 45, { rest: 30 }),
          s('horizontal_push', 3, [12, 20], { rest: 60 }),
          s('lunge', 3, [12, 20], { rest: 60, ...PER_LEG }),
          s('horizontal_pull', 3, [10, 15], { rest: 60 }),
          s('core_flexion', 3, [15, 20], { rest: 45 }),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'hybride-4',
    name: 'Force et endurance — 4 jours',
    category: 'hybride',
    level: 'Intermédiaire',
    goal: 'equilibre',
    days_per_week: 4,
    weeks: 8,
    equipment_profile: 'salle',
    summary: 'Deux séances de force, deux d’endurance, organisées pour que l’une coûte '
      + 'le moins possible à l’autre.',
    why: [
      'L’interférence de l’endurance sur la force n’est pas une fatalité : elle dépend '
        + 'de la modalité, de la fréquence et de la durée. Le vélo n’a pas montré de '
        + 'pénalité mesurable, la course si.',
      'D’où le choix du vélo et de l’elliptique plutôt que de la course : c’est le seul '
        + 'réglage qui ne demande de renoncer ni au volume de force ni au volume aérobie.',
      'Les séances sont séparées par jour plutôt qu’enchaînées : plus la durée '
        + 'd’endurance accumulée est longue, plus la pénalité sur la force augmente.',
      'La force est travaillée en corps entier pour que deux séances suffisent à revenir '
        + 'deux fois sur chaque muscle.',
      'Le volume d’endurance reste sous le plancher de santé de 150 min hebdomadaires : '
        + 'c’est l’arbitrage assumé de ce modèle, puisque plus la durée accumulée est '
        + 'longue, plus elle pénalise la force. La marche quotidienne comble l’écart.',
    ],
    sources: ['wilson2012concurrent', 'schoenfeld2016frequency', 'who2020', 'seilerPolarized'],
    days: [
      {
        title: 'Force — corps entier A', focus: 'legs',
        slots: [
          s('squat', 4, [5, 8], { rest: 210 }),
          s('horizontal_push', 4, [6, 10], { rest: 180 }),
          s('horizontal_pull', 4, [8, 12], { rest: 150 }),
          s('knee_flexion', 3, [10, 12], { rest: 90 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Endurance longue', focus: 'endurance',
        slots: [
          t('cardio', 1, 2700, { rest: 0, note: 'vélo ou elliptique, intensité conversationnelle' }),
          t('flexibility', 3, 45),
        ],
      },
      {
        title: 'Force — corps entier B', focus: 'pull',
        slots: [
          s('hinge', 4, [5, 8], { rest: 210 }),
          s('vertical_pull', 4, [6, 10], { rest: 180 }),
          s('vertical_push', 4, [8, 12], { rest: 150 }),
          s('lunge', 3, [10, 12], { rest: 120, ...PER_LEG }),
          s('elbow_flexion', 3, [10, 12], { rest: 75 }),
        ],
      },
      {
        title: 'Fractionné & amplitude', focus: 'endurance',
        slots: [
          t('cardio', 1, 600, { rest: 0, note: 'échauffement' }),
          t('cardio_interval', 6, 90, { rest: 90 }),
          t('mobility', 2, 40),
          t('flexibility', 2, 45),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'callisthenie-4',
    name: 'Callisthénie — 4 jours',
    category: 'sans_salle',
    level: 'Intermédiaire',
    goal: 'equilibre',
    days_per_week: 4,
    weeks: 8,
    equipment_profile: 'poids_du_corps',
    summary: 'Haut / bas deux fois par semaine, au poids de corps. La progression passe '
      + 'par le levier avant de passer par le lest.',
    why: [
      'Quatre séances donnent deux passages par muscle, ce qui n’est pas atteignable '
        + 'avec trois séances spécialisées.',
      'La résistance étant fixe, la surcharge se fait d’abord en répétitions : à ce '
        + 'titre, progresser en répétitions donne des adaptations comparables à '
        + 'progresser en charge.',
      'Quand le haut de la fourchette devient facile, il faut durcir le LEVIER — pompes '
        + 'déclinées, traction lestée, fente sautée — et non ajouter indéfiniment des '
        + 'répétitions : au-delà d’une trentaine, la limite devient l’endurance locale.',
      'Le tirage vertical reste le point dur du poids de corps : il concentre donc le '
        + 'volume le plus élevé des deux séances de haut du corps.',
    ],
    sources: ['progression2022', 'schoenfeld2016frequency', 'schoenfeld2017volume'],
    days: [
      {
        title: 'Haut du corps A', focus: 'push',
        slots: [
          s('vertical_pull', 5, [3, 8], { rest: 180 }),
          s('horizontal_push', 4, [8, 15], { rest: 150 }),
          s('horizontal_pull', 4, [8, 15], { rest: 120 }),
          s('elbow_extension', 3, [10, 15], { rest: 75 }),
          t('core_antiextension', 3, 45),
        ],
      },
      {
        title: 'Bas du corps A', focus: 'legs',
        slots: [
          s('lunge', 4, [10, 20], { rest: 120, ...PER_LEG }),
          s('knee_flexion', 4, [5, 10], { rest: 120 }),
          s('hip_extension', 3, [15, 25], { rest: 90 }),
          s('calf', 4, [20, 30], { rest: 60 }),
          s('core_flexion', 3, [12, 20], { rest: 60 }),
        ],
      },
      {
        title: 'Haut du corps B', focus: 'pull',
        slots: [
          s('vertical_push', 4, [5, 12], { rest: 150 }),
          s('vertical_pull', 4, [3, 8], { rest: 180 }),
          s('horizontal_push', 4, [10, 20], { rest: 120 }),
          s('elbow_flexion', 3, [8, 15], { rest: 75 }),
          t('mobility', 2, 40),
        ],
      },
      {
        title: 'Bas du corps & explosivité', focus: 'legs',
        slots: [
          s('squat', 4, [15, 25], { rest: 90 }),
          t('cardio_interval', 5, 40, { rest: 60 }),
          s('hinge', 3, [12, 20], { rest: 120 }),
          s('core_antirotation', 3, [10, 15], { rest: 45 }),
          t('flexibility', 3, 45),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'souplesse-5',
    name: 'Souplesse — 5 séances courtes',
    category: 'sante',
    level: 'Tous niveaux',
    goal: 'mobilite',
    days_per_week: 5,
    weeks: 12,
    equipment_profile: 'poids_du_corps',
    summary: 'Une dizaine de minutes par jour, cinq jours par semaine. Le dosage vient '
      + 'directement de la littérature, pas d’une habitude.',
    why: [
      'Environ dix minutes d’étirement statique par groupe musculaire et par semaine '
        + 'suffisent aux gains d’amplitude à long terme. Au-delà de quatre minutes par '
        + 'séance, aucun bénéfice supplémentaire n’est observé.',
      'C’est le VOLUME CUMULÉ qui compte, pas la durée d’une tenue isolée : trente '
        + 'secondes par répétition suffisent, il faut simplement les répéter.',
      'Cinq séances courtes plutôt que deux longues : à volume égal le résultat est '
        + 'comparable, mais dix minutes se trouvent là où quarante ne se trouvent pas.',
      'La mobilité est travaillée à part : amplitude ACTIVE sous contrôle musculaire, '
        + 'qui protège mieux qu’une amplitude subie.',
    ],
    sources: ['stretching2024dose', 'who2020'],
    days: [
      {
        title: 'Chaîne postérieure', focus: 'mobility',
        slots: [t('mobility', 2, 40), t('flexibility', 4, 40)],
      },
      {
        title: 'Hanches et adducteurs', focus: 'mobility',
        slots: [t('mobility', 2, 40), t('flexibility', 4, 40)],
      },
      {
        title: 'Épaules et poitrine', focus: 'mobility',
        slots: [t('mobility', 3, 40), t('flexibility', 3, 40)],
      },
      {
        title: 'Quadriceps et fléchisseurs', focus: 'mobility',
        slots: [t('mobility', 2, 40), t('flexibility', 4, 40)],
      },
      {
        title: 'Dos et tronc', focus: 'mobility',
        slots: [
          t('mobility', 2, 40),
          t('flexibility', 3, 40),
          t('core_antiextension', 2, 40),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'reprise-3',
    name: 'Reprise — 3 jours',
    category: 'demarrage',
    level: 'Débutant',
    goal: 'mobilite',
    days_per_week: 3,
    weeks: 6,
    equipment_profile: 'halteres',
    summary: 'Après une longue interruption : charges légères, amplitudes complètes, et '
      + 'un volume délibérément sous le seuil de progression.',
    why: [
      'Le volume est volontairement placé au niveau d’ENTRETIEN, sous le seuil de '
        + 'progression. Reprendre au volume qu’on tenait avant l’arrêt est la façon la '
        + 'plus fiable de s’arrêter à nouveau.',
      'Les séries s’arrêtent loin de l’échec : la première limite d’une reprise est la '
        + 'tolérance des tendons et des articulations, pas celle des muscles.',
      'Chaque séance ouvre par de la mobilité et ferme par de la souplesse : ce sont les '
        + 'amplitudes qui se perdent le plus vite à l’arrêt.',
      'À compléter par de la marche : 150 à 300 minutes hebdomadaires d’activité '
        + 'modérée, marche comprise.',
      'Ce modèle est un point de départ général, pas un protocole de rééducation. Après '
        + 'une blessure, un avis médical prime.',
    ],
    sources: ['who2020', 'schoenfeld2017volume', 'stretching2024dose'],
    days: [
      {
        title: 'Corps entier A', focus: 'legs',
        slots: [
          t('mobility', 2, 40),
          s('squat', 2, [10, 15], { rest: 120 }),
          s('horizontal_push', 2, [10, 15], { rest: 120 }),
          s('horizontal_pull', 2, [10, 15], { rest: 120 }),
          t('flexibility', 3, 40),
        ],
      },
      {
        title: 'Marche & tronc', focus: 'endurance',
        slots: [
          t('cardio', 1, 1800, { rest: 0, note: 'marche soutenue, conversation possible' }),
          t('core_antiextension', 2, 30),
          s('core_flexion', 2, [10, 15], { rest: 60 }),
          t('flexibility', 3, 40),
        ],
      },
      {
        title: 'Corps entier B', focus: 'pull',
        slots: [
          t('mobility', 2, 40),
          s('hinge', 2, [10, 15], { rest: 120 }),
          s('vertical_push', 2, [10, 15], { rest: 120 }),
          s('lunge', 2, [10, 12], { rest: 120, ...PER_LEG }),
          t('flexibility', 3, 40),
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    key: 'oms-complet-5',
    name: 'Recommandations OMS — 5 jours',
    category: 'sante',
    level: 'Tous niveaux',
    goal: 'mobilite',
    days_per_week: 5,
    weeks: 12,
    equipment_profile: 'halteres',
    summary: 'L’application littérale des recommandations d’activité physique : '
      + '150 minutes d’endurance modérée et deux séances de renforcement par semaine.',
    why: [
      'L’OMS recommande 150 à 300 minutes d’activité d’endurance modérée par semaine, '
        + 'ET un renforcement musculaire de tous les grands groupes au moins deux jours '
        + 'par semaine. Les deux, pas l’un ou l’autre.',
      'Trois sorties de 50 minutes atteignent le bas de la fourchette d’endurance ; les '
        + 'deux séances de renforcement couvrent tous les grands groupes.',
      'Le renforcement est en corps entier : c’est le seul format qui permette à deux '
        + 'séances de couvrir l’ensemble des groupes musculaires.',
      'Ce modèle vise la SANTÉ, pas la performance. Le volume par muscle reste sous le '
        + 'seuil de progression : c’est assumé, ce n’est pas ce qu’il cherche.',
    ],
    sources: ['who2020', 'schoenfeld2016frequency', 'stretching2024dose'],
    days: [
      {
        title: 'Renforcement A', focus: 'legs',
        slots: [
          t('mobility', 2, 40),
          s('squat', 3, [10, 15], { rest: 120 }),
          s('horizontal_push', 3, [10, 15], { rest: 120 }),
          s('horizontal_pull', 3, [10, 15], { rest: 120 }),
          t('core_antiextension', 2, 40),
        ],
      },
      {
        title: 'Endurance modérée', focus: 'endurance',
        slots: [
          t('cardio', 1, 3000, { rest: 0, note: 'intensité modérée : conversation possible' }),
          t('flexibility', 3, 40),
        ],
      },
      {
        title: 'Renforcement B', focus: 'pull',
        slots: [
          t('mobility', 2, 40),
          s('hinge', 3, [10, 15], { rest: 120 }),
          s('vertical_push', 3, [10, 15], { rest: 120 }),
          s('lunge', 3, [10, 12], { rest: 120, ...PER_LEG }),
          s('calf', 2, [15, 20], { rest: 60 }),
        ],
      },
      {
        title: 'Endurance modérée', focus: 'endurance',
        slots: [
          t('cardio', 1, 3000, { rest: 0, note: 'intensité modérée' }),
          s('core_flexion', 3, [12, 15], { rest: 60 }),
        ],
      },
      {
        title: 'Endurance & amplitude', focus: 'endurance',
        slots: [
          t('cardio', 1, 3000, { rest: 0, note: 'intensité modérée' }),
          t('mobility', 3, 40),
          t('flexibility', 4, 40),
        ],
      },
    ],
  },
];

export const TEMPLATES_BY_KEY = new Map(TEMPLATES.map((x) => [x.key, x]));

export const getTemplate = (key) => TEMPLATES_BY_KEY.get(key) ?? null;

// ---------------------------------------------------------------------
// Vérification du dosage
//
// Un modèle affiché sans son volume hebdomadaire demande de croire sur
// parole. On le calcule, on le compare aux repères, et on affiche l'écart
// quand il y en a un — plutôt que de retoucher le modèle en silence.
// ---------------------------------------------------------------------

/**
 * Volume hebdomadaire d'un modèle, par groupe musculaire.
 *
 * L'agrégation se fait PAR MUSCLE, pas par axe. « Poussée » mélange
 * pectoraux, deltoïdes et triceps : comparer son total au plafond de 22
 * séries par muscle produirait des alertes fausses sur tout programme un
 * peu fourni. Une série de développé couché compte pour les pectoraux,
 * et pour 40 % aux triceps et aux deltoïdes — la même pondération que
 * la vue de fatigue musculaire, afin que les deux chiffres concordent.
 */
export function templateVolume(template) {
  const byPattern = new Map();
  const byMuscle = new Map();

  const credit = (muscle, sets, dayTitle, weight) => {
    const m = byMuscle.get(muscle)
      ?? { muscle, label: MUSCLE_GROUPS[muscle], sets: 0, days: new Set() };
    m.sets += sets * weight;
    // La fréquence ne compte que le travail direct : un muscle effleuré
    // en second ne reçoit pas un stimulus comparable à une séance dédiée.
    if (weight === 1) m.days.add(dayTitle);
    byMuscle.set(muscle, m);
  };

  for (const day of template.days) {
    for (const slot of day.slots) {
      const meta = MOVEMENT_PATTERNS[slot.pattern];
      if (!meta) continue;

      const p = byPattern.get(slot.pattern)
        ?? { pattern: slot.pattern, label: meta.label, axis: meta.axis, sets: 0, sessions: 0 };
      p.sets += slot.sets;
      p.sessions += 1;
      byPattern.set(slot.pattern, p);

      for (const muscle of meta.primary) credit(muscle, slot.sets, day.title, 1);
      for (const muscle of meta.secondary) {
        credit(muscle, slot.sets, day.title, SECONDARY_WEIGHT);
      }
    }
  }

  const muscles = [...byMuscle.values()].map((m) => ({
    muscle: m.muscle,
    label: m.label,
    weekly_sets: Math.round(m.sets * 10) / 10,
    sessions_per_week: m.days.size,
    meets_frequency: m.days.size >= FREQUENCY.minimumPerMuscle,
    // Un muscle sans aucune séance dédiée n'est pas ciblé : il ne
    // récolte que du travail indirect, et n'a donc pas à être jugé
    // contre des repères qui supposent un travail direct.
    is_targeted: m.days.size > 0,
    ...verdictFor(m.sets),
  })).sort((x, y) => y.weekly_sets - x.weekly_sets);

  const warnings = buildWarnings(muscles);

  // L'amplitude et l'endurance se dosent autrement : en fréquence pour
  // la mobilité, en temps cumulé pour la souplesse et l'endurance.
  const TIMED_PATTERNS = ['mobility', 'flexibility', 'cardio', 'cardio_interval'];
  const timed = [...byPattern.values()]
    .filter((p) => TIMED_PATTERNS.includes(p.pattern))
    .map((p) => {
      const seconds = template.days.reduce((n, d) => n + d.slots
        .filter((x) => x.pattern === p.pattern)
        .reduce((k, x) => k + x.sets * (x.seconds ?? 0), 0), 0);
      return {
        pattern: p.pattern,
        label: p.label,
        sessions_per_week: p.sessions,
        weekly_minutes: Math.round((seconds / 60) * 10) / 10,
      };
    });

  // Minutes d'endurance de la semaine. Le fractionné compte double :
  // une minute vigoureuse vaut deux minutes modérées dans les
  // recommandations d'activité physique.
  const steady = timed.find((x) => x.pattern === 'cardio')?.weekly_minutes ?? 0;
  const intervals = timed.find((x) => x.pattern === 'cardio_interval')?.weekly_minutes ?? 0;
  const aerobicMinutes = Math.round(
    (steady + intervals * AEROBIC.vigorousEquivalence) * 10,
  ) / 10;

  // On ne juge le volume d'endurance que d'un programme qui en PREND un
  // engagement. Reprocher à un modèle de force de ne pas faire de cardio
  // n'aurait aucun sens, et quelques minutes d'intervalles en fin de
  // séance sont du conditionnement, pas une préparation aérobie.
  const AEROBIC_CLAIM_MINUTES = 15;
  if (aerobicMinutes >= AEROBIC_CLAIM_MINUTES
      && aerobicMinutes < AEROBIC.weeklyMinutesFloor) {
    warnings.push(`Endurance : ${aerobicMinutes} min hebdomadaires en équivalent modéré, `
      + `sous le plancher de ${AEROBIC.weeklyMinutesFloor} min recommandé pour la santé. `
      + 'À compléter par de la marche ou des déplacements actifs, qui comptent.');
  }

  return {
    total_weekly_sets: Math.round(muscles.reduce((n, m) => n + m.weekly_sets, 0) * 10) / 10,
    total_exercises: template.days.reduce((n, d) => n + d.slots.length, 0),
    patterns: [...byPattern.values()].sort((x, y) => y.sets - x.sets),
    muscles,
    timed,
    aerobic: {
      steady_minutes: steady,
      interval_minutes: intervals,
      moderate_equivalent_minutes: aerobicMinutes,
      floor: AEROBIC.weeklyMinutesFloor,
      upper: AEROBIC.weeklyMinutesUpper,
      meets_floor: aerobicMinutes >= AEROBIC.weeklyMinutesFloor,
    },
    warnings,
    landmarks: {
      maintenance: WEEKLY_SETS.maintenance,
      minimum_effective: WEEKLY_SETS.minimumEffective,
      adaptive_range: WEEKLY_SETS.adaptiveRange,
      maximum_recoverable: WEEKLY_SETS.maximumRecoverable,
    },
  };
}

// `label` est déjà pris par le nom du muscle : le verdict a ses propres
// clés, sinon la diffusion de l'objet écrase le libellé et chaque ligne
// du tableau s'appelle « Volume d'entretien ».
function verdictFor(weeklySets) {
  if (weeklySets >= WEEKLY_SETS.adaptiveRange[1]) {
    return { volume_label: 'Volume maximal', volume_note: 'proche du plafond récupérable' };
  }
  if (weeklySets >= WEEKLY_SETS.minimumEffective) {
    return { volume_label: 'Volume de progression', volume_note: 'dans la fenêtre d’adaptation' };
  }
  if (weeklySets >= WEEKLY_SETS.maintenance) {
    return { volume_label: 'Volume d’entretien', volume_note: 'acquis conservés, progression lente' };
  }
  return { volume_label: 'Volume d’appoint', volume_note: 'sous le seuil d’entretien' };
}

/**
 * Avertissements sur le dosage.
 *
 * Un avertissement par muscle sous-dosé noierait le seul qui compte. Les
 * cas de même nature sont donc regroupés en une ligne, et seuls les
 * muscles réellement CIBLÉS sont jugés : les trapèzes d'un programme qui
 * ne les travaille qu'en second n'ont pas à déclencher d'alerte.
 */
function buildWarnings(muscles) {
  const warnings = [];
  const targeted = muscles.filter((m) => m.is_targeted);

  const over = targeted.filter((m) => m.weekly_sets > WEEKLY_SETS.maximumRecoverable);
  for (const m of over) {
    warnings.push(`${m.label} : ${m.weekly_sets} séries hebdomadaires, au-dessus du `
      + `plafond récupérable de ${WEEKLY_SETS.maximumRecoverable}. À surveiller si la `
      + 'progression stagne ou si les séances deviennent pénibles.');
  }

  const under = targeted.filter((m) => m.weekly_sets < WEEKLY_SETS.maintenance);
  if (under.length) {
    warnings.push(`${under.map((m) => m.label).join(', ')} : sous le volume d’entretien `
      + `de ${WEEKLY_SETS.maintenance} séries hebdomadaires. Ce sont des muscles `
      + 'd’appoint dans ce modèle — s’ils sont une priorité, il faut leur ajouter un exercice.');
  }

  // La fréquence ne se juge que sur les muscles qui portent un volume
  // significatif : deux séries hebdomadaires réparties sur deux séances
  // ne valent pas mieux que sur une seule.
  const lowFrequency = targeted.filter(
    (m) => !m.meets_frequency && m.weekly_sets >= WEEKLY_SETS.maintenance,
  );
  if (lowFrequency.length) {
    warnings.push(`${lowFrequency.map((m) => m.label).join(', ')} : une seule séance de `
      + `travail direct par semaine. À volume égal, ${FREQUENCY.minimumPerMuscle} passages `
      + 'font mieux — mais il faut un jour d’entraînement de plus pour les placer.');
  }

  return warnings;
}

/** Fiche d'un modèle, dosage et sources résolues — prête pour l'API. */
export function describeTemplate(template) {
  const preset = GOALS[template.goal] ?? GOALS.equilibre;
  return {
    key: template.key,
    name: template.name,
    category: template.category,
    level: template.level,
    goal: template.goal,
    goal_label: preset.label,
    days_per_week: template.days_per_week,
    weeks: template.weeks,
    equipment_profile: template.equipment_profile,
    equipment_label: EQUIPMENT_PROFILES[template.equipment_profile]?.label ?? null,
    summary: template.summary,
    why: template.why,
    rir: preset.rir,
    volume: templateVolume(template),
    sources: template.sources
      .map((key) => (REFERENCES[key] ? { key, ...REFERENCES[key] } : null))
      .filter(Boolean),
    days: template.days.map((d, i) => ({
      day_index: i + 1,
      title: d.title,
      focus: d.focus,
      slots: d.slots.map((slot) => ({
        ...slot,
        pattern_label: MOVEMENT_PATTERNS[slot.pattern]?.label ?? slot.pattern,
        axis: MOVEMENT_PATTERNS[slot.pattern]?.axis ?? null,
      })),
    })),
  };
}
