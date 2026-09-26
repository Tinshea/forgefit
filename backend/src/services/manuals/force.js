/**
 * Manuel — catégorie FORCE ET HALTÉROPHILIE.
 *
 * ┌─ CE QUI UNIT CES QUATRE DISCIPLINES ──────────────────────────────┐
 * │ Toutes déplacent une charge contre la gravité, mais elles ne      │
 * │ cherchent pas la même chose. La musculation vise la MASSE et la   │
 * │ force, l'haltérophilie la PUISSANCE dans deux mouvements très     │
 * │ techniques, le CrossFit la polyvalence sous fatigue, le street    │
 * │ workout la maîtrise de son propre corps.                          │
 * │                                                                    │
 * │ Un dénominateur commun, solidement établi : c'est le VOLUME       │
 * │ hebdomadaire par groupe musculaire qui pilote l'hypertrophie, et  │
 * │ la relation est dose-dépendante (Schoenfeld et al. 2017). La      │
 * │ force maximale, elle, répond surtout à l'intensité relative.      │
 * └────────────────────────────────────────────────────────────────────┘
 */

const PROGRESSION_SURCHARGE = {
  nom: 'Surcharge progressive',
  gloss: 'Augmenter au fil des semaines la charge, les répétitions ou les séries',
  role: 'Le principe qui gouverne tout le reste. Sans progression mesurée, on entretient.',
};

const ERREUR_EGO = {
  faute: 'Charger plus que ce qu’on maîtrise',
  pourquoi: 'L’amplitude se réduit, la technique se dégrade, et le stimulus réel diminue pendant que le risque augmente.',
  correction: 'Choisir une charge qui laisse deux répétitions en réserve sur la plupart des séries.',
};

export const MANUEL = {
  /* ═══ MUSCULATION ═════════════════════════════════════════════════ */
  musculation: {
    pourquoi: 'Construire du muscle et de la force, avec le contrôle le plus fin qui '
      + 'soit sur la dose. Aucune autre pratique ne permet d’ajuster aussi '
      + 'précisément ce qu’on demande à une région du corps.',
    forces: [
      { titre: 'Le dosage', texte: 'Séries, répétitions, charge : trois molettes indépendantes. On sait exactement ce qu’on a fait et ce qu’on ajoutera.' },
      { titre: 'La progression mesurable', texte: 'Le carnet dit si la semaine a été meilleure que la précédente. Peu de pratiques offrent une boucle de retour aussi nette.' },
      { titre: 'La santé structurelle', texte: 'Densité osseuse, masse maigre, tolérance articulaire : les effets dépassent largement l’esthétique.' },
    ],
    techniques: [
      {
        famille: 'Poussée',
        items: [
          { nom: 'Développé couché', gloss: 'Barre ou haltères, à plat', cles: ['Omoplates serrées et basses pendant toute la série', 'Les pieds poussent le sol : c’est un mouvement du corps entier'] },
          { nom: 'Développé militaire', gloss: 'Au-dessus de la tête', cles: ['Les côtes restent basses : cambrer déplace la charge sur les lombaires'] },
          { nom: 'Dips', gloss: 'Aux barres parallèles', cles: ['Descendre jusqu’à ce que l’épaule soit à hauteur du coude, pas plus bas'] },
        ],
      },
      {
        famille: 'Tirage',
        items: [
          { nom: 'Traction', gloss: 'À la barre fixe', cles: ['Partir bras tendus, épaules engagées', 'Le menton n’est pas l’objectif : les coudes le sont'] },
          { nom: 'Rowing', gloss: 'Tirage horizontal', cles: ['Le dos reste gainé, il ne se déroule pas à chaque répétition'] },
          { nom: 'Soulevé de terre', gloss: 'Depuis le sol', cles: ['La barre reste contre les jambes', 'Le dos garde sa courbure naturelle du début à la fin'] },
        ],
      },
      {
        famille: 'Jambes',
        items: [
          { nom: 'Squat', gloss: 'Barre sur le dos ou devant', cles: ['Les genoux suivent la direction des pieds', 'Descendre autant que la mobilité le permet sans que le bassin bascule'] },
          { nom: 'Fente', gloss: 'Unilatéral', cles: ['Révèle les asymétries que le squat masque'] },
          { nom: 'Soulevé de terre jambes tendues', gloss: 'Chaîne postérieure', cles: ['Mouvement de HANCHE, pas de dos'] },
        ],
      },
    ],
    methodes: [
      PROGRESSION_SURCHARGE,
      { nom: 'Séries et répétitions', gloss: '3 à 5 séries de 6 à 12 répétitions pour l’hypertrophie', role: 'C’est le volume hebdomadaire par muscle qui compte, pas la séance isolée.' },
      { nom: 'Proximité de l’échec', gloss: 'Répétitions en réserve', role: 'Deux répétitions en réserve suffisent pour l’essentiel du stimulus, avec beaucoup moins de fatigue.' },
      { nom: 'Fréquence', gloss: 'Chaque muscle deux fois par semaine', role: 'Mieux réparti, le même volume est mieux toléré.' },
      { nom: 'Décharge', gloss: 'Semaine allégée toutes les 4 à 8 semaines', role: 'Laisse la fatigue redescendre pour que l’adaptation se révèle.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune doctrine, mais une étiquette de salle assez partagée : on range '
        + 'ses charges, on ne monopolise pas un poste, on propose de parer. Ce sont des '
        + 'règles de partage, pas une philosophie.',
    },
    lecons: [
      'La régularité sur des mois bat n’importe quel programme parfait suivi trois semaines.',
      'Le carnet ne ment pas : c’est le seul juge de la progression.',
      'Laisser deux répétitions en réserve coûte peu et protège beaucoup.',
    ],
    demarrer: {
      materiel: ['Une salle, ou une barre et des disques', 'Chaussures plates pour les mouvements au sol'],
      premiere_seance: 'Trois mouvements de base, séries légères, en cherchant '
        + 'uniquement la technique. La charge viendra d’elle-même en quelques semaines.',
      reperes: [
        'Dix à vingt séries hebdomadaires par groupe musculaire couvrent l’essentiel du bénéfice.',
        'Quelques séances encadrées au départ font gagner des mois.',
      ],
    },
    sources: ['schoenfeld-2017', 'suchomel-2018'],
  },

  /* ═══ CROSSFIT ════════════════════════════════════════════════════ */
  crossfit: {
    pourquoi: 'Chercher la polyvalence plutôt que la spécialisation : haltérophilie, '
      + 'gymnastique et endurance mélangées, souvent sous chronomètre. Ce qui s’y '
      + 'travaille vraiment est la capacité à bien faire en étant fatigué.',
    forces: [
      { titre: 'La polyvalence', texte: 'Force, puissance, endurance et gymnastique dans la même semaine. Peu de pratiques couvrent autant de qualités.' },
      { titre: 'L’intensité', texte: 'Le format court et mesuré pousse à un engagement rare en salle classique.' },
      { titre: 'Le collectif', texte: 'La séance se fait en groupe et à heure fixe, ce qui règle le problème de l’assiduité mieux qu’aucune motivation.' },
    ],
    techniques: [
      {
        famille: 'Haltérophilie',
        items: [
          { nom: 'Arraché', gloss: 'Snatch — du sol au-dessus de la tête en un temps', cles: ['Le mouvement le plus technique de la salle : il s’apprend à vide pendant des semaines'] },
          { nom: 'Épaulé-jeté', gloss: 'Clean and jerk — en deux temps' },
          { nom: 'Thruster', gloss: 'Squat avant enchaîné à un développé' },
        ],
      },
      {
        famille: 'Gymnastique',
        items: [
          { nom: 'Traction kipping', gloss: 'Traction avec élan', cles: ['À ne travailler qu’après plusieurs tractions strictes : l’élan charge énormément l’épaule'] },
          { nom: 'Muscle-up', gloss: 'Passer de la suspension à l’appui' },
          { nom: 'Handstand push-up', gloss: 'Développé en appui tendu renversé' },
          { nom: 'Double under', gloss: 'Corde, deux tours par saut' },
        ],
      },
      {
        famille: 'Formats',
        items: [
          { nom: 'AMRAP', gloss: 'Le plus de tours possible en un temps donné' },
          { nom: 'For time', gloss: 'Un travail fixé, le plus vite possible' },
          { nom: 'EMOM', gloss: 'Un bloc à chaque minute' },
        ],
      },
    ],
    methodes: [
      { nom: 'WOD', gloss: 'Le travail du jour, chronométré', role: 'Le cœur de la séance, mais pas l’essentiel de la progression.' },
      { nom: 'Travail de force dédié', gloss: 'Avant le WOD, sans chronomètre', role: 'La force se construit à part : mélangée à la vitesse, elle stagne.' },
      { nom: 'Technique à vide', gloss: 'Barre seule ou PVC', role: 'Indispensable pour les mouvements d’haltérophilie.' },
      { nom: 'Scaling', gloss: 'Adapter charges et mouvements à son niveau', role: 'La règle centrale : le WOD s’adapte à la personne, jamais l’inverse.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine écrite, mais une culture de salle très marquée : on '
        + 'encourage le dernier à finir, on note son résultat, on adapte sans honte. '
        + 'Le revers en est connu — la pression du chronomètre et du tableau pousse à '
        + 'dégrader la technique, et c’est là que se produisent les blessures.',
    },
    lecons: [
      'Le chronomètre est un outil, pas un juge : dégrader la technique pour gagner dix secondes est un mauvais échange.',
      'Adapter la séance à son niveau est la norme, pas un aveu.',
      'La force se construit hors du WOD.',
    ],
    demarrer: {
      materiel: ['Chaussures plates ou spécifiques', 'Corde à sauter', 'Le reste est fourni par la salle'],
      premiere_seance: 'La plupart des salles imposent un cycle de découverte : c’est '
        + 'un bon signe. Fuis celles qui mettent un débutant dans un WOD chronométré le '
        + 'premier jour.',
      reperes: [
        'L’arraché et l’épaulé s’apprennent à vide, longtemps, avant toute charge.',
        'Le kipping se travaille après les tractions strictes, jamais avant.',
      ],
    },
    sources: ['schoenfeld-2017', 'storey-smith-2012'],
  },

  /* ═══ HALTÉROPHILIE ═══════════════════════════════════════════════ */
  haltero: {
    pourquoi: 'Deux mouvements, et une vie pour les faire bien. L’haltérophilie '
      + 'développe la puissance — la capacité à produire de la force VITE — mieux '
      + 'qu’aucune autre pratique de salle.',
    forces: [
      { titre: 'La puissance', texte: 'L’arraché est l’un des gestes les plus puissants du sport mesuré en watts par kilo.' },
      { titre: 'La technique', texte: 'Deux mouvements seulement, décomposables à l’infini. La précision y est l’objet même de la pratique.' },
      { titre: 'La mobilité contrainte', texte: 'Les positions exigent des amplitudes de cheville, de hanche et d’épaule que la pratique construit d’office.' },
    ],
    techniques: [
      {
        famille: 'Arraché',
        items: [
          { nom: 'Position de départ', gloss: 'Barre contre les tibias', cles: ['Épaules légèrement en avant de la barre', 'Dos gainé, bras relâchés'] },
          { nom: 'Premier tirage', gloss: 'Du sol aux genoux', cles: ['Lent et contrôlé : la vitesse vient après'] },
          { nom: 'Deuxième tirage', gloss: 'L’extension explosive', cles: ['Hanches, genoux, chevilles — l’extension est simultanée et totale'] },
          { nom: 'Réception', gloss: 'Chute sous la barre', cles: ['On ne lève pas la barre plus haut, on descend plus vite dessous'] },
        ],
      },
      {
        famille: 'Épaulé-jeté',
        items: [
          { nom: 'Épaulé', gloss: 'Du sol aux épaules' },
          { nom: 'Jeté', gloss: 'Des épaules au-dessus de la tête', cles: ['Le fendu stabilise : les pieds se déplacent, ils ne poussent pas seulement'] },
        ],
      },
      {
        famille: 'Mouvements d’assistance',
        items: [
          { nom: 'Squat avant', gloss: 'Barre devant', cles: ['Construit la position de réception de l’épaulé'] },
          { nom: 'Tirage', gloss: 'La phase de traction isolée' },
          { nom: 'Overhead squat', gloss: 'Squat barre au-dessus de la tête', cles: ['Révèle impitoyablement les limites de mobilité'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Technique à vide', gloss: 'Barre PVC ou barre nue', role: 'La base de tout : des centaines de répétitions avant la moindre charge.' },
      { nom: 'Décomposition', gloss: 'Travailler une phase isolée', role: 'Tirage depuis les genoux, réception seule, position de départ.' },
      { nom: 'Montée en charge', gloss: 'Séries de 1 à 3 répétitions', role: 'La puissance se travaille frais : les séries longues n’ont pas leur place ici.' },
      PROGRESSION_SURCHARGE,
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine philosophique, mais une culture de précision et de '
        + 'patience presque monastique : on répète le même geste pendant des années. '
        + 'Le respect du plateau et du matériel y est strict.',
    },
    lecons: [
      'On ne lève pas la barre plus haut, on descend plus vite dessous.',
      'La patience est technique : un geste bâclé répété devient une habitude coûteuse.',
      'La mobilité n’est pas un supplément, c’est une condition d’exécution.',
    ],
    demarrer: {
      materiel: ['Chaussures d’haltérophilie à talon rigide', 'Une barre et un plateau — pas du parquet', 'Un club ou un entraîneur'],
      premiere_seance: 'Barre à vide, position de départ, décomposition. Tu ne '
        + 'chargeras probablement rien le premier jour, et c’est exactement la bonne façon.',
      reperes: [
        'Ces deux mouvements s’apprennent très difficilement seul : un encadrement change tout.',
        'La mobilité de cheville et d’épaule conditionne l’accès aux positions.',
      ],
    },
    sources: ['storey-smith-2012', 'suchomel-2018'],
  },

  /* ═══ STREET WORKOUT ══════════════════════════════════════════════ */
  street_workout: {
    pourquoi: 'Maîtriser son propre corps dans l’espace, avec une barre et rien '
      + 'd’autre. La progression ne se fait pas en ajoutant du poids mais en '
      + 'rendant le mouvement plus difficile.',
    forces: [
      { titre: 'La progression par levier', texte: 'On n’ajoute pas de charge : on allonge le bras de levier. C’est une autre façon de penser la surcharge.' },
      { titre: 'L’accessibilité', texte: 'Un parc, une barre. Aucun abonnement, aucun horaire.' },
      { titre: 'Le gainage réel', texte: 'Les figures statiques demandent une transmission par le tronc que peu d’exercices sollicitent autant.' },
    ],
    techniques: [
      {
        famille: 'Bases',
        items: [
          { nom: 'Traction stricte', gloss: 'Sans élan', cles: ['La fondation de tout le reste'] },
          { nom: 'Dips', gloss: 'Aux barres parallèles' },
          { nom: 'Pompes', gloss: 'Et leurs variantes', cles: ['Corps aligné : le bassin ne s’affaisse pas'] },
          { nom: 'Australian pull-up', gloss: 'Traction horizontale', cles: ['La progression pour construire la première traction'] },
        ],
      },
      {
        famille: 'Statiques',
        items: [
          { nom: 'L-sit', gloss: 'Jambes tendues à l’équerre', cles: ['Demande autant de mobilité d’ischio-jambiers que de force'] },
          { nom: 'Front lever', gloss: 'Corps horizontal sous la barre', cles: ['Se construit par étapes : groupé, une jambe, puis tendu'] },
          { nom: 'Planche', gloss: 'Corps horizontal en appui' },
          { nom: 'Handstand', gloss: 'Appui tendu renversé', cles: ['S’apprend contre un mur, sur des mois'] },
        ],
      },
      {
        famille: 'Dynamiques',
        items: [
          { nom: 'Muscle-up', gloss: 'Passer de la suspension à l’appui', cles: ['Exige des tractions hautes et des dips solides avant d’être tenté'] },
          { nom: 'Traction explosive', gloss: 'Lâcher et rattraper' },
        ],
      },
    ],
    methodes: [
      { nom: 'Progressions', gloss: 'Versions plus faciles d’une figure cible', role: 'La méthode centrale : on ne saute pas une étape, on raccourcit le levier.' },
      { nom: 'Travail statique', gloss: 'Tenues chronométrées', role: 'Les figures se construisent en secondes tenues, pas en répétitions.' },
      { nom: 'Volume en séries courtes', gloss: 'Beaucoup de séries, loin de l’échec', role: 'Permet d’accumuler du travail sans s’épuiser.' },
      PROGRESSION_SURCHARGE,
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une culture de parc très partagée : on partage la '
        + 'barre, on explique volontiers, et la démonstration remplace le diplôme. '
        + 'Elle a un revers, la tentation de sauter les étapes pour la figure '
        + 'impressionnante.',
    },
    lecons: [
      'La progression par levier enseigne la patience mieux que la charge additionnelle.',
      'Une figure tenue proprement vaut mieux que la même bâclée.',
      'Les poignets et les coudes se préparent avant, pas après la douleur.',
    ],
    demarrer: {
      materiel: ['Une barre de traction', 'Éventuellement des élastiques pour les progressions'],
      premiere_seance: 'Australian pull-ups, pompes, gainage. Si tu ne fais pas '
        + 'encore de traction stricte, c’est l’objectif des trois premiers mois.',
      reperes: [
        'Les figures statiques demandent des mois, parfois des années. C’est normal.',
        'Prépare tes poignets : ils encaissent beaucoup dans les appuis.',
      ],
    },
    sources: ['schoenfeld-2017'],
  },
};

export const DETAIL = {
  musculation: {
    format: {
      instance: 'Pas de compétition propre ; la force athlétique (IPF) et le culturisme (IFBB) en sont les débouchés compétitifs',
      duree: 'Séance de 45 à 90 min ; en force athlétique, trois essais par mouvement.',
      victoire: ['Sans objet en pratique courante', 'En force athlétique : total le plus élevé sur squat, développé couché et soulevé de terre'],
      notation: 'En force athlétique, le total des trois meilleurs essais, rapporté au poids de corps selon les formules.',
      cibles: 'Sans objet.',
      categories: 'Par poids de corps et par âge en compétition.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 12, contenu: 'Mobilité ciblée, puis montée en charge progressive sur le premier mouvement.' },
      { phase: 'Mouvement principal', minutes: 25, contenu: 'Un exercice lourd, 3 à 5 séries, récupération complète.' },
      { phase: 'Accessoires', minutes: 25, contenu: 'Deux à trois mouvements complémentaires, séries plus longues.' },
      { phase: 'Finition', minutes: 10, contenu: 'Gainage, ou travail isolé d’un point faible.' },
      { phase: 'Retour au calme', minutes: 8, contenu: 'Respiration, mobilité légère.' },
    ],
    progression: [
      { palier: 'Technique', reperes: ['Amplitude complète sur les mouvements de base', 'Charges légères', 'Trois séances par semaine'], duree: '2 à 3 mois' },
      { palier: 'Progression linéaire', reperes: ['Ajouter de la charge chaque semaine', 'Volume de 10 à 20 séries par muscle', 'Premier carnet sérieux'], duree: '6 à 18 mois' },
      { palier: 'Programmation', reperes: ['Blocs de charge et de décharge', 'Variation des plages de répétitions', 'Objectifs chiffrés'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_EGO,
      { faute: 'Changer de programme toutes les trois semaines', pourquoi: 'Aucune progression n’a le temps de se manifester, et rien n’est jamais mesuré.', correction: 'Tenir un programme 8 à 12 semaines avant de juger.' },
      { faute: 'Réduire l’amplitude pour charger plus', pourquoi: 'Le stimulus diminue précisément là où il compte le plus, en position allongée.', correction: 'Amplitude complète d’abord, charge ensuite.' },
      { faute: 'Négliger les jambes et le dos', pourquoi: 'Déséquilibre postural et progression bloquée sur le reste.', correction: 'Répartir le volume entre poussée, tirage et jambes.' },
      { faute: 'Chercher l’échec à chaque série', pourquoi: 'La fatigue accumulée dépasse le gain, et les séances suivantes en pâtissent.', correction: 'Deux répétitions en réserve sur la plupart des séries.' },
    ],
    securite: {
      frequentes: ['Épaules (développés)', 'Bas du dos (soulevé, squat)', 'Coudes et poignets'],
      prevention: [
        'Échauffement progressif sur le mouvement lui-même, pas seulement du cardio.',
        'Un parieur ou des barres de sécurité pour toute série lourde au développé et au squat.',
        'Une douleur articulaire aiguë impose l’arrêt de l’exercice, pas sa poursuite en serrant les dents.',
      ],
      note: 'La musculation bien conduite est très sûre ; l’écrasante majorité des blessures vient de la charge ajoutée trop vite.',
    },
    glossaire: [
      { terme: 'RM', definition: 'Répétition maximale : la charge déplaçable N fois.' },
      { terme: 'RIR', definition: 'Répétitions en réserve avant l’échec.' },
      { terme: 'Série de travail', definition: 'Série effective, hors échauffement.' },
      { terme: 'Décharge', definition: 'Semaine volontairement allégée.' },
      { terme: 'Volume', definition: 'Nombre de séries effectives par muscle et par semaine.' },
    ],
  },

  crossfit: {
    format: {
      instance: 'CrossFit Inc. — Open, quarts de finale, Games',
      duree: 'Épreuves de 3 à 30 min, plusieurs par jour en compétition.',
      victoire: ['Meilleur temps sur un travail fixé', 'Plus de répétitions dans un temps donné', 'Classement cumulé sur plusieurs épreuves'],
      notation: 'Temps ou répétitions, avec des standards de mouvement contrôlés par un juge.',
      cibles: 'Sans objet.',
      categories: 'Par âge et sexe ; catégories Rx (prescrit) et scaled (adapté).',
    },
    seance_type: [
      { phase: 'Échauffement général', minutes: 10, contenu: 'Mobilité et montée en température.' },
      { phase: 'Travail de force ou technique', minutes: 20, contenu: 'Sans chronomètre : c’est là que la force se construit.' },
      { phase: 'Échauffement spécifique du WOD', minutes: 10, contenu: 'Répétition des mouvements du jour à charge réduite.' },
      { phase: 'WOD', minutes: 15, contenu: 'Le travail du jour, chronométré.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Récupération, mobilité.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Mouvements de base à vide', 'Scaling systématique', 'Comprendre les formats'], duree: '2 à 3 mois' },
      { palier: 'Consolider', reperes: ['Arraché et épaulé chargés légers', 'Tractions strictes', 'WOD en Rx partiels'], duree: '1 an' },
      { palier: 'Progresser', reperes: ['Mouvements gymniques avancés', 'WOD en Rx', 'Compétition locale si envie'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_EGO,
      { faute: 'Faire le WOD en Rx trop tôt', pourquoi: 'On exécute mal sous fatigue, ce qui est précisément la situation la plus risquée.', correction: 'Le scaling est la règle, pas l’exception.' },
      { faute: 'Apprendre le kipping avant les tractions strictes', pourquoi: 'L’élan charge l’épaule bien au-delà de ce qu’elle sait encaisser.', correction: 'Dix tractions strictes avant d’envisager l’élan.' },
      { faute: 'Chercher le chrono au détriment du mouvement', pourquoi: 'Le tableau récompense la vitesse ; le corps facture la technique.', correction: 'Ralentir dès que la forme se dégrade — c’est toujours le bon choix.' },
      { faute: 'Enchaîner les jours intenses', pourquoi: 'Le format sollicite tout, tous les jours : la récupération devient le facteur limitant.', correction: 'Au moins un jour vraiment léger par semaine.' },
    ],
    securite: {
      frequentes: ['Épaules', 'Bas du dos', 'Mains (déchirures aux barres)', 'Genoux'],
      prevention: [
        'Le scaling est un outil de sécurité avant d’être un outil de progression.',
        'Un encadrement qui corrige pendant le WOD, pas seulement avant.',
        'Refuser une charge ou un mouvement est toujours acceptable.',
      ],
      note: 'La combinaison charge + vitesse + fatigue est ce qui rend la technique décisive dans cette discipline.',
    },
    glossaire: [
      { terme: 'WOD', definition: 'Workout of the day, le travail du jour.' },
      { terme: 'AMRAP', definition: 'As many rounds as possible.' },
      { terme: 'EMOM', definition: 'Every minute on the minute.' },
      { terme: 'Rx', definition: 'Le WOD exécuté tel que prescrit.' },
      { terme: 'Scaling', definition: 'Adaptation du WOD à son niveau.' },
      { terme: 'Box', definition: 'La salle.' },
    ],
  },

  haltero: {
    format: {
      instance: 'International Weightlifting Federation (IWF)',
      duree: 'Trois essais à l’arraché, puis trois à l’épaulé-jeté.',
      victoire: ['Total le plus élevé — meilleur arraché plus meilleur épaulé-jeté'],
      notation: 'Une levée est valide ou non, jugée par trois arbitres. Un athlète sans levée valide à l’arraché est éliminé.',
      cibles: 'Sans objet.',
      categories: 'Par poids de corps et par sexe.',
    },
    seance_type: [
      { phase: 'Échauffement et mobilité', minutes: 20, contenu: 'Chevilles, hanches, épaules — indispensables pour accéder aux positions.' },
      { phase: 'Technique à vide', minutes: 15, contenu: 'Barre PVC ou barre nue, décomposition.' },
      { phase: 'Mouvement principal', minutes: 30, contenu: 'Arraché ou épaulé-jeté, séries de 1 à 3, récupération longue.' },
      { phase: 'Assistance', minutes: 20, contenu: 'Squat avant, tirages, travail de position.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Mobilité, respiration.' },
    ],
    progression: [
      { palier: 'Apprendre', reperes: ['Positions de départ et de réception', 'Overhead squat à vide', 'Mobilité suffisante'], duree: '3 à 6 mois' },
      { palier: 'Charger', reperes: ['Arraché et épaulé techniques à charge modérée', 'Squat avant solide'], duree: '1 à 2 ans' },
      { palier: 'Performer', reperes: ['Maximum fiables', 'Première compétition', 'Programmation par cycles'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Tirer trop vite du sol', pourquoi: 'On perd la position et l’extension explosive arrive trop tôt.', correction: 'Premier tirage lent et contrôlé ; la vitesse au second.' },
      { faute: 'Tirer la barre avec les bras', pourquoi: 'Les bras sont des câbles : ils transmettent, ils ne soulèvent pas.', correction: 'Bras relâchés jusqu’à l’extension complète.' },
      { faute: 'Vouloir lever la barre plus haut', pourquoi: 'C’est physiquement impossible au-delà d’un certain point.', correction: 'Descendre plus vite sous la barre.' },
      { faute: 'Charger avant d’avoir la mobilité', pourquoi: 'Les positions se compensent par le dos, qui encaisse.', correction: 'Travailler cheville, hanche et épaule en parallèle, dès le début.' },
    ],
    securite: {
      frequentes: ['Poignets', 'Bas du dos', 'Épaules', 'Genoux'],
      prevention: [
        'Apprendre à lâcher la barre — savoir rater est une compétence enseignée en premier.',
        'Plateau et disques adaptés : lâcher sur un sol dur abîme tout, matériel compris.',
        'Encadrement fortement conseillé : ces deux mouvements se corrigent mal seul.',
      ],
      note: 'Bien encadrée, l’haltérophilie affiche un taux de blessure comparable à d’autres sports de salle ; mal apprise, elle est impitoyable.',
    },
    glossaire: [
      { terme: 'Arraché', definition: 'Snatch — du sol au-dessus de la tête en un temps.' },
      { terme: 'Épaulé-jeté', definition: 'Clean and jerk — en deux temps.' },
      { terme: 'Fendu', definition: 'La position de réception du jeté, pieds décalés.' },
      { terme: 'Total', definition: 'Somme des meilleurs essais aux deux mouvements.' },
      { terme: 'Squat avant', definition: 'Squat barre sur les épaules, devant.' },
    ],
  },

  street_workout: {
    format: {
      instance: 'World Street Workout Federation et circuits indépendants',
      duree: 'Épreuves de figures libres, souvent 60 à 90 s par passage.',
      victoire: ['Notation par juges sur la difficulté, l’exécution et l’originalité', 'Épreuves de répétitions maximales dans certaines compétitions'],
      notation: 'Panel de juges ; barèmes variables selon les circuits.',
      cibles: 'Sans objet.',
      categories: 'Freestyle, statiques, répétitions.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 15, contenu: 'Épaules, poignets, coudes — les articulations exposées.' },
      { phase: 'Statiques', minutes: 20, contenu: 'Tenues chronométrées sur la progression en cours, à froid relatif.' },
      { phase: 'Force', minutes: 25, contenu: 'Tractions, dips, pompes lestées ou en progression.' },
      { phase: 'Volume', minutes: 15, contenu: 'Séries plus longues, loin de l’échec.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Étirements des épaules et des poignets.' },
    ],
    progression: [
      { palier: 'Bases', reperes: ['Première traction stricte', 'Dips propres', 'Gainage solide'], duree: '3 à 6 mois' },
      { palier: 'Construire', reperes: ['10 tractions strictes', 'L-sit tenu 15 s', 'Handstand au mur'], duree: '1 an' },
      { palier: 'Figures', reperes: ['Front lever groupé puis tendu', 'Muscle-up', 'Handstand libre'], duree: 'plusieurs années' },
    ],
    erreurs: [
      { faute: 'Tenter une figure sans sa progression', pourquoi: 'Les tendons du coude et de l’épaule cèdent avant le muscle.', correction: 'Passer par les variantes à levier court, sur des mois.' },
      { faute: 'Négliger le tirage horizontal', pourquoi: 'Déséquilibre entre l’avant et l’arrière de l’épaule, source de douleurs.', correction: 'Ajouter des tractions horizontales au programme.' },
      { faute: 'S’entraîner uniquement en statique', pourquoi: 'On développe des positions sans l’amplitude qui les rend sûres.', correction: 'Alterner tenues et mouvements complets.' },
      { faute: 'Ignorer les poignets', pourquoi: 'Les appuis les chargent en extension, position peu habituelle.', correction: 'Préparation spécifique des poignets à chaque séance.' },
    ],
    securite: {
      frequentes: ['Épicondylite (coude)', 'Épaules', 'Poignets', 'Chutes depuis la barre'],
      prevention: [
        'Progressions respectées : c’est la prévention principale et elle est non négociable.',
        'Barres et sol vérifiés avant de commencer.',
        'Ne pas travailler les figures nouvelles en fin de séance, quand la force a baissé.',
      ],
      note: 'Les blessures de street workout sont presque toujours des blessures de tendon, donc lentes à venir et lentes à partir.',
    },
    glossaire: [
      { terme: 'Front lever', definition: 'Corps horizontal sous la barre.' },
      { terme: 'Planche', definition: 'Corps horizontal en appui.' },
      { terme: 'Muscle-up', definition: 'Passage de la suspension à l’appui.' },
      { terme: 'Progression', definition: 'Version allégée d’une figure cible.' },
      { terme: 'Levier', definition: 'La distance qui rend une figure plus ou moins difficile.' },
    ],
  },
};
