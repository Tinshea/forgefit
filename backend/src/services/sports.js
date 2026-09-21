// Catalogue des sports.
//
// ┌─ CE QUE CE FICHIER RÉSOUT ────────────────────────────────────────┐
// │ L'application savait doser la salle de musculation : séries,      │
// │ répétitions, volume par muscle. Elle ne savait rien faire d'une   │
// │ sortie vélo, d'un entraînement de boxe ou d'une séance de bloc.   │
// │                                                                    │
// │ Or ces sports ne se dosent PAS en séries. Ils se dosent en        │
// │ DURÉE × INTENSITÉ — c'est la charge d'entraînement de Foster      │
// │ (cf. session-load.js), validée précisément parce qu'elle          │
// │ s'applique à tout ce qui se pratique.                             │
// │                                                                    │
// │ Ce fichier apporte les trois choses qui manquaient pour           │
// │ l'appliquer :                                                     │
// │   1. une TAXONOMIE, pour comparer ce qui est comparable ;         │
// │   2. un PROFIL MUSCULAIRE, pour que la silhouette reste juste     │
// │      quand l'entraînement n'a pas de tonnage ;                    │
// │   3. un coût énergétique (MET), pour la dépense.                  │
// └────────────────────────────────────────────────────────────────────┘

/**
 * ┌─ HONNÊTETÉ DES DONNÉES DE CE FICHIER ─────────────────────────────┐
 * │ MET : valeurs du Compendium of Physical Activities (Ainsworth et  │
 * │ al., 2011). Ce sont des MOYENNES DE POPULATION pour une intensité │
 * │ donnée. Deux personnes courant à 10 km/h ne dépensent pas la      │
 * │ même chose, et le MET ignore la technique — un nageur débutant    │
 * │ dépense bien plus qu'un nageur efficace à vitesse égale.          │
 * │                                                                    │
 * │ PROFILS MUSCULAIRES : attributions qualitatives, tirées de la     │
 * │ biomécanique du geste. Ce ne sont PAS des mesures                 │
 * │ électromyographiques, et elles ne prétendent pas au dixième. Leur │
 * │ rôle est de répondre à « ce sport sollicite-t-il surtout le haut  │
 * │ ou le bas du corps », ce à quoi elles répondent bien, et non à    │
 * │ « combien de pour cent pour le vaste médial ».                    │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const REFERENCES = {
  compendium: {
    citation: 'Ainsworth BE et al. (2011), Compendium of Physical Activities: '
      + 'a second update of codes and MET values. Med Sci Sports Exerc 43(8).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21681120/',
  },
  foster: {
    citation: 'Foster C et al. (2001), A new approach to monitoring exercise '
      + 'training. J Strength Cond Res 15(1):109-115.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11708692/',
  },
  seiler: {
    citation: 'Seiler S (2010), What is best practice for training intensity '
      + 'and duration distribution in endurance athletes? Int J Sports Physiol '
      + 'Perform 5(3):276-291.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20861519/',
  },
  who: {
    citation: 'OMS (2020), Lignes directrices sur l’activité physique et la '
      + 'sédentarité.',
    url: 'https://www.who.int/publications/i/item/9789240015128',
  },
  wilson: {
    citation: 'Wilson JM et al. (2012), Concurrent training: a meta-analysis '
      + 'examining interference of aerobic and resistance exercises. '
      + 'J Strength Cond Res 26(8):2293-2307.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22002517/',
  },
};

/**
 * Catégories.
 *
 * Le découpage suit la QUALITÉ PHYSIQUE DOMINANTE, pas la popularité ni
 * le matériel. C'est ce qui rend les catégories utiles : deux sports de
 * la même catégorie se substituent sans déséquilibrer la semaine, deux
 * sports de catégories différentes se complètent.
 *
 * `interference` note le risque d'interférence avec le développement de
 * la force, à volume élevé (Wilson et al., 2012) : l'endurance de longue
 * durée l'émousse, les sports intermittents beaucoup moins.
 */
export const CATEGORIES = {
  force: {
    label: 'Force et haltérophilie',
    icon: '🏋️',
    quality: 'Force maximale et hypertrophie',
    dosing: 'séries hebdomadaires par muscle',
    interference: 'nulle',
    note: 'Le module historique de l’application. Dosé à la série, pas à la '
      + 'durée — c’est le seul domaine où la relation dose-réponse porte sur '
      + 'le nombre de séries.',
  },
  endurance: {
    label: 'Endurance',
    icon: '🏃',
    quality: 'Capacité aérobie',
    dosing: 'minutes hebdomadaires, réparties 80 / 20',
    interference: 'élevée au-delà de 3 séances longues par semaine',
    note: 'La distribution polarisée — environ 80 % du temps en basse '
      + 'intensité — est le schéma le mieux documenté chez les athlètes '
      + 'd’endurance (Seiler, 2010).',
  },
  collectif: {
    label: 'Sports collectifs',
    icon: '⚽',
    quality: 'Intermittent : accélérations, changements de direction',
    dosing: 'séances hebdomadaires et charge cumulée',
    interference: 'modérée',
    note: 'Effort intermittent de haute intensité. La charge ne se lit pas '
      + 'dans la durée seule : une heure de match et une heure de tactique '
      + 'n’ont rien à voir, d’où le RPE.',
  },
  combat: {
    label: 'Sports de combat',
    icon: '🥊',
    quality: 'Puissance, endurance anaérobie, technique',
    dosing: 'reprises et charge cumulée',
    interference: 'modérée',
    note: 'Le sparring et le travail technique se dosent très différemment. '
      + 'Deux séances de même durée peuvent différer du simple au triple en '
      + 'charge réelle.',
  },
  raquette: {
    label: 'Sports de raquette',
    icon: '🎾',
    quality: 'Intermittent, latéralisé',
    dosing: 'séances hebdomadaires',
    interference: 'faible',
    note: 'Fortement asymétriques. Un travail de compensation du côté non '
      + 'dominant a sa place dans la semaine.',
  },
  grimpe: {
    label: 'Escalade et grimpe',
    icon: '🧗',
    quality: 'Force de préhension, force relative',
    dosing: 'voies, blocs, et temps suspendu',
    interference: 'faible',
    note: 'Les tendons des doigts s’adaptent bien plus lentement que les '
      + 'muscles : la progression de volume doit y être plus prudente '
      + 'qu’ailleurs.',
  },
  glisse: {
    label: 'Glisse et plein air',
    icon: '🎿',
    quality: 'Proprioception, endurance de force',
    dosing: 'durée de pratique',
    interference: 'faible à modérée',
    note: 'Pratique souvent saisonnière et par blocs longs. La charge d’une '
      + 'journée entière se compare mal à celle d’une séance.',
  },
  mouvement: {
    label: 'Arts du mouvement',
    icon: '🤸',
    quality: 'Coordination, amplitude, contrôle',
    dosing: 'durée et régularité',
    interference: 'nulle à faible',
    note: 'Beaucoup de travail à charge faible et forte exigence de contrôle. '
      + 'La fréquence prime sur la durée.',
  },
  mobilite: {
    label: 'Mobilité et souplesse',
    icon: '🧘',
    quality: 'Amplitude articulaire',
    dosing: 'minutes cumulées sous étirement',
    interference: 'nulle',
    note: 'Le temps total sous tension prime sur la durée d’une répétition. '
      + 'Module déjà couvert par le catalogue d’exercices.',
  },
};

/** Ordre d'affichage : du plus structurant au plus complémentaire. */
export const CATEGORY_ORDER = [
  'force', 'endurance', 'collectif', 'combat', 'raquette',
  'grimpe', 'glisse', 'mouvement', 'mobilite',
];

// Raccourcis de profils musculaires : la plupart des sports en
// partagent. Les écrire une fois évite qu'ils divergent.
const JAMBES_COURSE = {
  primary: ['quads', 'hamstrings', 'calves', 'glutes'],
  secondary: ['abs', 'hip flexors', 'spine'],
};
const JAMBES_CYCLE = {
  primary: ['quads', 'glutes'],
  secondary: ['hamstrings', 'calves', 'spine', 'lower back'],
};
const HAUT_TIRAGE = {
  primary: ['lats', 'upper back', 'delts'],
  secondary: ['biceps', 'forearms', 'abs', 'traps'],
};
const CORPS_ENTIER_INTERMITTENT = {
  primary: ['quads', 'hamstrings', 'glutes', 'calves'],
  secondary: ['abs', 'spine', 'delts', 'adductors', 'abductors'],
};
const FRAPPE = {
  primary: ['delts', 'abs', 'quads'],
  secondary: ['pectorals', 'triceps', 'upper back', 'calves', 'spine', 'forearms'],
};

/**
 * Le catalogue.
 *
 * `met`      — coût énergétique à intensité usuelle (Compendium 2011).
 * `metrics`  — champs de saisie PERTINENTS pour ce sport. Demander une
 *              distance pour un entraînement de judo n'aurait pas de sens ;
 *              l'omettre pour une sortie vélo en perdrait l'essentiel.
 * `rpe`      — RPE typique, proposé par défaut et toujours modifiable.
 * `muscles`  — profil de sollicitation, pour la silhouette.
 */
export const SPORTS = {
  // --- Endurance ------------------------------------------------------
  course: {
    label: 'Course à pied', category: 'endurance', met: 9.8, rpe: 6,
    metrics: ['distance', 'elevation'], muscles: JAMBES_COURSE,
    note: 'MET donné pour ≈ 10 km/h. L’allure change tout : 8 km/h vaut 8,3, '
      + '16 km/h vaut 14,5.',
  },
  trail: {
    label: 'Trail', category: 'endurance', met: 10.5, rpe: 7,
    metrics: ['distance', 'elevation'], muscles: {
      primary: ['quads', 'glutes', 'calves', 'hamstrings'],
      secondary: ['abs', 'spine', 'lower back', 'abductors'],
    },
    note: 'Le dénivelé négatif provoque un travail excentrique marqué : '
      + 'courbatures plus longues qu’après une distance équivalente sur plat.',
  },
  velo_route: {
    label: 'Vélo de route', category: 'endurance', met: 8.5, rpe: 5,
    metrics: ['distance', 'elevation'], muscles: JAMBES_CYCLE,
    note: 'Sans impact : tolère un volume hebdomadaire bien supérieur à la '
      + 'course, à charge cardiaque égale.',
  },
  vtt: {
    label: 'VTT', category: 'endurance', met: 8.5, rpe: 6,
    metrics: ['distance', 'elevation'], muscles: {
      primary: ['quads', 'glutes'],
      secondary: ['abs', 'delts', 'forearms', 'spine', 'calves', 'triceps'],
    },
  },
  home_trainer: {
    label: 'Home-trainer', category: 'endurance', met: 7.0, rpe: 6,
    metrics: [], muscles: JAMBES_CYCLE,
    note: 'Intensité mieux contrôlée qu’en extérieur, mais refroidissement '
      + 'moindre : le RPE monte plus vite à puissance égale.',
  },
  natation: {
    label: 'Natation', category: 'endurance', met: 8.3, rpe: 6,
    metrics: ['distance'], muscles: {
      primary: ['lats', 'delts', 'upper back', 'pectorals'],
      secondary: ['triceps', 'abs', 'glutes', 'quads', 'spine'],
    },
    note: 'Le coût énergétique dépend surtout de la TECHNIQUE : un nageur '
      + 'peu efficace dépense bien davantage à vitesse égale.',
  },
  aviron: {
    label: 'Aviron', category: 'endurance', met: 8.5, rpe: 7,
    metrics: ['distance'], muscles: {
      primary: ['quads', 'lats', 'upper back', 'glutes'],
      secondary: ['biceps', 'hamstrings', 'abs', 'spine', 'lower back', 'forearms'],
    },
    note: 'L’un des rares gestes vraiment complets. La chaîne postérieure y '
      + 'travaille autant que les jambes.',
  },
  rameur: {
    label: 'Rameur', category: 'endurance', met: 7.0, rpe: 7,
    metrics: ['distance'], muscles: {
      primary: ['quads', 'lats', 'upper back'],
      secondary: ['glutes', 'hamstrings', 'biceps', 'abs', 'lower back'],
    },
  },
  marche_rapide: {
    label: 'Marche rapide', category: 'endurance', met: 4.3, rpe: 3,
    metrics: ['distance', 'elevation'], muscles: {
      primary: ['quads', 'calves', 'glutes'],
      secondary: ['hamstrings', 'hip flexors', 'spine'],
    },
    note: 'Compte pleinement dans les 150 minutes hebdomadaires de l’OMS. '
      + 'C’est l’activité la plus sous-estimée du lot.',
  },
  randonnee: {
    label: 'Randonnée', category: 'endurance', met: 6.0, rpe: 4,
    metrics: ['distance', 'elevation'], muscles: {
      primary: ['quads', 'glutes', 'calves'],
      secondary: ['hamstrings', 'spine', 'lower back', 'traps'],
    },
  },
  corde_sauter: {
    label: 'Corde à sauter', category: 'endurance', met: 12.3, rpe: 7,
    metrics: [], muscles: {
      primary: ['calves', 'quads'],
      secondary: ['delts', 'forearms', 'abs', 'hamstrings'],
    },
    note: 'Densité énergétique très élevée pour l’espace occupé, mais charge '
      + 'importante sur les mollets et le tendon d’Achille.',
  },
  ski_fond: {
    label: 'Ski de fond', category: 'endurance', met: 9.0, rpe: 6,
    metrics: ['distance', 'elevation'], muscles: {
      primary: ['quads', 'glutes', 'lats', 'triceps'],
      secondary: ['hamstrings', 'abs', 'delts', 'spine', 'calves'],
    },
    note: 'Sollicitation la plus complète des sports d’endurance : c’est là '
      + 'qu’on mesure les plus hautes VO₂max jamais enregistrées.',
  },

  // --- Sports collectifs ---------------------------------------------
  football: {
    label: 'Football', category: 'collectif', met: 10.0, rpe: 7,
    metrics: ['distance'], muscles: {
      primary: ['quads', 'hamstrings', 'glutes', 'calves'],
      secondary: ['adductors', 'abs', 'hip flexors', 'spine', 'abductors'],
    },
    note: 'Les ischio-jambiers sont la première localisation de blessure du '
      + 'football : le travail excentrique en prévention a sa place dans la '
      + 'semaine.',
  },
  basketball: {
    label: 'Basketball', category: 'collectif', met: 8.0, rpe: 7,
    metrics: [], muscles: CORPS_ENTIER_INTERMITTENT,
  },
  handball: {
    label: 'Handball', category: 'collectif', met: 12.0, rpe: 8,
    metrics: [], muscles: {
      primary: ['quads', 'glutes', 'delts', 'abs'],
      secondary: ['hamstrings', 'calves', 'pectorals', 'triceps', 'spine'],
    },
  },
  rugby: {
    label: 'Rugby', category: 'collectif', met: 8.3, rpe: 8,
    metrics: [], muscles: {
      primary: ['quads', 'glutes', 'hamstrings', 'upper back'],
      secondary: ['traps', 'delts', 'abs', 'spine', 'calves', 'pectorals'],
    },
    note: 'Contacts répétés : la charge réelle dépasse largement ce que la '
      + 'durée laisse supposer.',
  },
  volleyball: {
    label: 'Volleyball', category: 'collectif', met: 6.0, rpe: 6,
    metrics: [], muscles: {
      primary: ['quads', 'calves', 'delts'],
      secondary: ['glutes', 'abs', 'triceps', 'upper back', 'spine'],
    },
  },
  futsal: {
    label: 'Futsal', category: 'collectif', met: 10.0, rpe: 8,
    metrics: [], muscles: CORPS_ENTIER_INTERMITTENT,
  },
  ultimate: {
    label: 'Ultimate', category: 'collectif', met: 8.0, rpe: 7,
    metrics: ['distance'], muscles: CORPS_ENTIER_INTERMITTENT,
  },

  // --- Sports de combat ----------------------------------------------
  boxe: {
    label: 'Boxe anglaise', category: 'combat', met: 7.8, rpe: 7,
    metrics: ['rounds'], muscles: FRAPPE,
    note: 'MET donné pour le sparring. Le travail au sac vaut ≈ 5,5, le '
      + 'combat en ring ≈ 12,8 : le RPE fait la différence, pas la durée.',
  },
  boxe_thai: {
    label: 'Boxe thaï', category: 'combat', met: 10.3, rpe: 8,
    metrics: ['rounds'], muscles: {
      primary: ['delts', 'abs', 'quads', 'calves'],
      secondary: ['hamstrings', 'glutes', 'pectorals', 'triceps', 'spine', 'hip flexors'],
    },
  },
  mma: {
    label: 'MMA', category: 'combat', met: 10.3, rpe: 8,
    metrics: ['rounds'], muscles: {
      primary: ['quads', 'glutes', 'abs', 'upper back', 'delts'],
      secondary: ['forearms', 'lats', 'hamstrings', 'spine', 'traps', 'biceps'],
    },
  },
  judo: {
    label: 'Judo', category: 'combat', met: 10.3, rpe: 8,
    metrics: ['rounds'], muscles: {
      primary: ['forearms', 'lats', 'upper back', 'glutes'],
      secondary: ['quads', 'abs', 'spine', 'traps', 'biceps', 'hamstrings'],
    },
    note: 'La préhension est le facteur limitant avant la force générale : '
      + 'les avant-bras récupèrent souvent plus lentement que le reste.',
  },
  bjj: {
    label: 'Jiu-jitsu brésilien', category: 'combat', met: 9.0, rpe: 7,
    metrics: ['rounds'], muscles: {
      primary: ['forearms', 'abs', 'upper back', 'hip flexors'],
      secondary: ['lats', 'glutes', 'quads', 'spine', 'biceps', 'adductors'],
    },
  },
  karate: {
    label: 'Karaté', category: 'combat', met: 10.3, rpe: 7,
    metrics: ['rounds'], muscles: FRAPPE,
  },
  lutte: {
    label: 'Lutte', category: 'combat', met: 6.0, rpe: 8,
    metrics: ['rounds'], muscles: {
      primary: ['upper back', 'glutes', 'quads', 'forearms'],
      secondary: ['traps', 'lats', 'abs', 'spine', 'hamstrings', 'delts'],
    },
  },
  escrime: {
    label: 'Escrime', category: 'combat', met: 6.0, rpe: 6,
    metrics: ['rounds'], muscles: {
      primary: ['quads', 'glutes', 'delts'],
      secondary: ['calves', 'abs', 'forearms', 'triceps', 'adductors'],
    },
    note: 'Très asymétrique : la jambe avant et le bras armé encaissent '
      + 'l’essentiel de la charge.',
  },

  // --- Sports de raquette ---------------------------------------------
  tennis: {
    label: 'Tennis', category: 'raquette', met: 8.0, rpe: 6,
    metrics: [], muscles: {
      primary: ['quads', 'delts', 'abs', 'calves'],
      secondary: ['glutes', 'forearms', 'pectorals', 'upper back', 'spine'],
    },
  },
  badminton: {
    label: 'Badminton', category: 'raquette', met: 7.0, rpe: 6,
    metrics: [], muscles: {
      primary: ['calves', 'quads', 'delts'],
      secondary: ['abs', 'forearms', 'glutes', 'upper back'],
    },
  },
  squash: {
    label: 'Squash', category: 'raquette', met: 12.0, rpe: 8,
    metrics: [], muscles: {
      primary: ['quads', 'glutes', 'calves', 'delts'],
      secondary: ['abs', 'forearms', 'hamstrings', 'spine', 'adductors'],
    },
    note: 'L’un des MET les plus élevés du catalogue : espace réduit, '
      + 'échanges quasi continus.',
  },
  padel: {
    label: 'Padel', category: 'raquette', met: 6.5, rpe: 5,
    metrics: [], muscles: {
      primary: ['quads', 'delts', 'calves'],
      secondary: ['abs', 'forearms', 'glutes', 'upper back'],
    },
  },
  tennis_table: {
    label: 'Tennis de table', category: 'raquette', met: 4.0, rpe: 4,
    metrics: [], muscles: {
      primary: ['forearms', 'delts', 'abs'],
      secondary: ['quads', 'calves', 'upper back'],
    },
  },

  // --- Escalade --------------------------------------------------------
  escalade_voie: {
    label: 'Escalade en voie', category: 'grimpe', met: 8.0, rpe: 6,
    metrics: ['ascents'], muscles: {
      primary: ['forearms', 'lats', 'biceps', 'upper back'],
      secondary: ['abs', 'delts', 'quads', 'glutes', 'calves', 'spine'],
    },
    note: 'Les tendons des doigts s’adaptent plus lentement que les muscles. '
      + 'C’est la structure qui limite la progression de volume, pas la force.',
  },
  bloc: {
    label: 'Bloc', category: 'grimpe', met: 8.0, rpe: 7,
    metrics: ['ascents'], muscles: {
      primary: ['forearms', 'lats', 'biceps', 'abs'],
      secondary: ['delts', 'upper back', 'glutes', 'quads', 'triceps'],
    },
    note: 'Efforts courts et maximaux, donc charge par minute bien plus '
      + 'élevée qu’en voie.',
  },
  pan_gouttes: {
    label: 'Poutre et pan', category: 'grimpe', met: 5.0, rpe: 7,
    metrics: [], muscles: {
      primary: ['forearms'],
      secondary: ['lats', 'biceps', 'upper back', 'abs'],
    },
    note: 'Travail très localisé et très exigeant pour les tendons. À '
      + 'réserver aux grimpeurs avec plusieurs années de pratique.',
  },

  // --- Glisse et plein air ---------------------------------------------
  ski_alpin: {
    label: 'Ski alpin', category: 'glisse', met: 6.8, rpe: 5,
    metrics: ['elevation'], muscles: {
      primary: ['quads', 'glutes'],
      secondary: ['abs', 'calves', 'hamstrings', 'spine', 'adductors'],
    },
    note: 'Travail isométrique et excentrique prolongé des quadriceps : les '
      + 'courbatures y sont plus fortes que la dépense ne le laisse croire.',
  },
  snowboard: {
    label: 'Snowboard', category: 'glisse', met: 5.3, rpe: 5,
    metrics: ['elevation'], muscles: {
      primary: ['quads', 'glutes', 'abs'],
      secondary: ['calves', 'hamstrings', 'spine', 'adductors'],
    },
  },
  surf: {
    label: 'Surf', category: 'glisse', met: 5.0, rpe: 5,
    metrics: [], muscles: {
      primary: ['lats', 'delts', 'upper back', 'abs'],
      secondary: ['triceps', 'quads', 'glutes', 'spine', 'pectorals'],
    },
    note: 'L’essentiel du temps se passe à ramer : la charge est surtout sur '
      + 'le haut du corps, pas sur les jambes.',
  },
  skate: {
    label: 'Skateboard', category: 'glisse', met: 5.0, rpe: 5,
    metrics: [], muscles: {
      primary: ['quads', 'calves', 'glutes'],
      secondary: ['abs', 'hamstrings', 'spine', 'abductors'],
    },
  },
  kayak: {
    label: 'Kayak', category: 'glisse', met: 5.0, rpe: 5,
    metrics: ['distance'], muscles: {
      primary: ['lats', 'upper back', 'abs', 'delts'],
      secondary: ['biceps', 'forearms', 'triceps', 'spine'],
    },
  },
  equitation: {
    label: 'Équitation', category: 'glisse', met: 5.5, rpe: 4,
    metrics: [], muscles: {
      primary: ['adductors', 'abs', 'spine'],
      secondary: ['quads', 'glutes', 'lower back', 'calves'],
    },
  },

  // --- Arts du mouvement -----------------------------------------------
  gymnastique: {
    label: 'Gymnastique', category: 'mouvement', met: 5.3, rpe: 7,
    metrics: [], muscles: {
      primary: ['abs', 'delts', 'lats', 'triceps'],
      secondary: ['pectorals', 'forearms', 'glutes', 'quads', 'spine', 'upper back'],
    },
  },
  parkour: {
    label: 'Parkour', category: 'mouvement', met: 8.0, rpe: 7,
    metrics: [], muscles: {
      primary: ['quads', 'calves', 'glutes', 'abs'],
      secondary: ['delts', 'lats', 'forearms', 'hamstrings', 'spine'],
    },
  },
  danse: {
    label: 'Danse', category: 'mouvement', met: 6.5, rpe: 5,
    metrics: [], muscles: {
      primary: ['quads', 'calves', 'glutes', 'abs'],
      secondary: ['hamstrings', 'spine', 'hip flexors', 'adductors', 'delts'],
    },
  },
  arts_cirque: {
    label: 'Arts du cirque', category: 'mouvement', met: 4.8, rpe: 6,
    metrics: [], muscles: {
      primary: ['lats', 'abs', 'forearms', 'delts'],
      secondary: ['biceps', 'upper back', 'spine', 'glutes', 'pectorals'],
    },
  },
  patinage: {
    label: 'Patinage', category: 'mouvement', met: 7.0, rpe: 5,
    metrics: [], muscles: {
      primary: ['quads', 'glutes', 'adductors', 'abductors'],
      secondary: ['calves', 'hamstrings', 'abs', 'spine'],
    },
  },

  // --- Mobilité ---------------------------------------------------------
  yoga: {
    label: 'Yoga', category: 'mobilite', met: 3.0, rpe: 3,
    metrics: [], muscles: {
      primary: ['abs', 'spine', 'hamstrings'],
      secondary: ['delts', 'glutes', 'quads', 'lower back', 'adductors'],
    },
  },
  pilates: {
    label: 'Pilates', category: 'mobilite', met: 3.0, rpe: 4,
    metrics: [], muscles: {
      primary: ['abs', 'spine', 'lower back'],
      secondary: ['glutes', 'hip flexors', 'adductors', 'delts'],
    },
  },
  etirements: {
    label: 'Étirements', category: 'mobilite', met: 2.3, rpe: 2,
    metrics: [], muscles: {
      primary: ['hamstrings', 'hip flexors', 'spine'],
      secondary: ['glutes', 'quads', 'calves', 'adductors', 'pectorals'],
    },
  },

  // --- Force (pont vers le module historique) ---------------------------
  musculation: {
    label: 'Musculation', category: 'force', met: 6.0, rpe: 7,
    metrics: [], muscles: null,
    note: 'Dosée à la série, pas à la durée. Le profil musculaire vient des '
      + 'exercices réellement enregistrés, pas d’une attribution moyenne.',
  },
  crossfit: {
    label: 'CrossFit', category: 'force', met: 8.0, rpe: 8,
    metrics: [], muscles: {
      primary: ['quads', 'glutes', 'delts', 'abs'],
      secondary: ['lats', 'hamstrings', 'triceps', 'forearms', 'spine', 'upper back'],
    },
    note: 'À cheval entre force et endurance. C’est précisément la '
      + 'configuration où l’interférence est la plus marquée (Wilson, 2012).',
  },
  haltero: {
    label: 'Haltérophilie', category: 'force', met: 6.0, rpe: 8,
    metrics: [], muscles: {
      primary: ['quads', 'glutes', 'traps', 'delts'],
      secondary: ['hamstrings', 'spine', 'lower back', 'triceps', 'calves', 'forearms'],
    },
  },
  street_workout: {
    label: 'Street workout', category: 'force', met: 6.0, rpe: 7,
    metrics: [], muscles: {
      primary: ['lats', 'pectorals', 'abs', 'delts'],
      secondary: ['biceps', 'triceps', 'forearms', 'upper back', 'glutes'],
    },
  },
};

/**
 * Lieux de pratique.
 *
 * ┌─ POURQUOI UNE CARTE DE LIEUX ─────────────────────────────────────┐
 * │ La question qu'on se pose vraiment n'est pas « quel sport ai-je   │
 * │ envie de faire », c'est « qu'est-ce que je peux faire LÀ OÙ JE    │
 * │ SUIS, maintenant ». Un catalogue de 53 sports n'y répond pas :    │
 * │ il faut savoir lesquels sont possibles sans matériel, lesquels    │
 * │ tiennent en dix minutes, lesquels demandent une salle.            │
 * │                                                                    │
 * │ Chaque lieu porte donc ses sports RÉELLEMENT praticables, son     │
 * │ matériel disponible et sa fenêtre de temps typique. Rien          │
 * │ d'inventé : les clés renvoient au catalogue ci-dessus, et un test │
 * │ vérifie qu'aucune ne pointe dans le vide.                         │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const LOCATIONS = {
  maison: {
    label: 'Maison',
    glyph: 'maison',
    note: 'Sans matériel ou presque. C’est le lieu où la régularité se '
      + 'gagne : pas de trajet, pas d’excuse.',
    equipment: ['poids de corps', 'tapis', 'élastiques'],
    typical_minutes: [15, 45],
    sports: ['street_workout', 'gymnastique', 'yoga', 'pilates', 'etirements',
      'corde_sauter', 'home_trainer', 'rameur'],
  },
  salle: {
    label: 'Salle',
    glyph: 'halteres',
    note: 'Le seul endroit où la charge se règle au kilo près. À réserver '
      + 'à ce qui l’exige vraiment.',
    equipment: ['barres', 'haltères', 'machines', 'poulies', 'cardio'],
    typical_minutes: [45, 90],
    sports: ['musculation', 'haltero', 'crossfit', 'rameur', 'home_trainer',
      'corde_sauter', 'escalade_voie', 'bloc'],
  },
  dehors: {
    label: 'Dehors',
    glyph: 'arbre',
    note: 'Terrain varié, air frais, et la lumière du jour — qui fait plus '
      + 'pour le sommeil que n’importe quel complément.',
    equipment: ['aucun', 'chaussures', 'vélo'],
    typical_minutes: [30, 180],
    sports: ['course', 'trail', 'velo_route', 'vtt', 'marche_rapide',
      'randonnee', 'street_workout', 'parkour', 'football', 'basketball'],
  },
  travail: {
    label: 'Travail',
    glyph: 'bureau',
    note: 'Micro-pauses. Rien qui fasse transpirer, mais la position assise '
      + 'prolongée se paie sur les hanches et le haut du dos.',
    equipment: ['aucun', 'chaise', 'mur'],
    typical_minutes: [5, 15],
    sports: ['etirements', 'pilates', 'marche_rapide'],
  },
  transport: {
    label: 'Transport',
    glyph: 'rails',
    note: 'Debout dans le métro ou assis dans le train : de quoi entretenir '
      + 'la mobilité sans que personne ne s’en aperçoive.',
    equipment: ['aucun'],
    typical_minutes: [5, 25],
    sports: ['etirements', 'marche_rapide'],
  },
  eau: {
    label: 'Piscine',
    glyph: 'vague',
    note: 'Sans impact : le recours quand une articulation proteste mais '
      + 'que l’envie de bouger reste.',
    equipment: ['bassin'],
    typical_minutes: [30, 60],
    sports: ['natation'],
  },
};

export const LOCATION_ORDER = ['maison', 'dehors', 'salle', 'travail', 'transport', 'eau'];

/** Les lieux, avec leurs sports résolus depuis le catalogue. */
export function locations() {
  return LOCATION_ORDER.map((key) => {
    const l = LOCATIONS[key];
    return {
      key,
      ...l,
      sports: l.sports
        .filter((s) => SPORTS[s])
        .map((s) => ({
          key: s,
          label: SPORTS[s].label,
          category: SPORTS[s].category,
          met: SPORTS[s].met,
          default_rpe: SPORTS[s].rpe,
        })),
    };
  });
}

/** Clés valides, pour la validation des routes. */
export const SPORT_KEYS = Object.keys(SPORTS);

/** Un sport, enrichi de sa catégorie. Null si la clé est inconnue. */
export function getSport(key) {
  const sport = SPORTS[key];
  if (!sport) return null;
  return { key, ...sport, category_meta: CATEGORIES[sport.category] };
}

/** Le catalogue groupé par catégorie, dans l'ordre d'affichage. */
export function catalogue() {
  return CATEGORY_ORDER.map((key) => ({
    key,
    ...CATEGORIES[key],
    sports: Object.entries(SPORTS)
      .filter(([, s]) => s.category === key)
      .map(([k, s]) => ({
        key: k,
        label: s.label,
        met: s.met,
        metrics: s.metrics,
        default_rpe: s.rpe,
        note: s.note ?? null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
  }));
}

/**
 * Dépense énergétique d'une séance, en kcal.
 *
 *   kcal = MET × poids (kg) × durée (h)
 *
 * ┌─ CE CHIFFRE NE DOIT PAS SERVIR À MANGER PLUS ─────────────────────┐
 * │ Le multiplicateur d'activité du profil nutritionnel (× 1,375      │
 * │ « léger », × 1,55 « modéré ») INCLUT DÉJÀ l'entraînement. Ajouter │
 * │ ces calories par-dessus les compterait DEUX FOIS — c'est l'erreur │
 * │ la plus répandue des applications de suivi.                       │
 * │                                                                    │
 * │ Cette estimation sert à COMPARER des séances entre elles, et à    │
 * │ vérifier que le niveau d'activité déclaré correspond à ce qui est │
 * │ réellement pratiqué. Pas à recalculer un objectif.                │
 * └────────────────────────────────────────────────────────────────────┘
 */
export function sessionKcal({ sportKey, minutes, weightKg }) {
  const sport = SPORTS[sportKey];
  if (!sport || !(minutes > 0) || !(weightKg > 0)) return null;
  return Math.round(sport.met * weightKg * (minutes / 60));
}

/**
 * Répartition d'une charge de séance sur les muscles.
 *
 * Même pondération que partout ailleurs dans l'application : 1 pour un
 * muscle principal, 0,4 pour un secondaire. La charge est ensuite
 * NORMALISÉE pour que la somme vaille la charge de séance — sans quoi
 * un sport listant beaucoup de muscles pèserait mécaniquement plus
 * lourd qu'un sport ciblé, à effort identique.
 */
export const SECONDARY_WEIGHT = 0.4;

export function distributeLoad(sportKey, load) {
  const sport = SPORTS[sportKey];
  if (!sport?.muscles || !(load > 0)) return [];

  const weights = new Map();
  for (const m of sport.muscles.primary ?? []) weights.set(m, 1);
  for (const m of sport.muscles.secondary ?? []) {
    if (!weights.has(m)) weights.set(m, SECONDARY_WEIGHT);
  }

  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];

  return [...weights.entries()].map(([muscle, w]) => ({
    muscle,
    load: Math.round((load * w / total) * 100) / 100,
    role: w === 1 ? 'principal' : 'secondaire',
  }));
}
