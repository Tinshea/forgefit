/**
 * Manuel — catégorie ESCALADE ET GRIMPE.
 *
 * ┌─ CE QUI UNIT CES TROIS PRATIQUES ─────────────────────────────────┐
 * │ La force de doigts est le déterminant qui distingue le mieux les  │
 * │ niveaux — davantage que la force générale, la puissance ou la     │
 * │ composition corporelle (Watts 2004 ; Saul et al. 2019). C'est un  │
 * │ résultat contre-intuitif et solide : grimper ne se résume pas à   │
 * │ être fort, mais la préhension, elle, décide.                      │
 * │                                                                    │
 * │ Corollaire de sécurité : les doigts sont aussi la structure la    │
 * │ plus fragile et la plus lente à s'adapter. Les poulies se         │
 * │ blessent en un instant et se réparent en mois.                    │
 * └────────────────────────────────────────────────────────────────────┘
 */

const ERREUR_ARRAQUE = {
  faute: 'Tirer sur les bras au lieu de pousser sur les jambes',
  pourquoi: 'Les bras s’épuisent en quelques mouvements, les jambes sont bien plus endurantes et bien plus fortes.',
  correction: 'Regarder ses pieds, les placer précisément, puis pousser. Les bras servent à tenir l’équilibre.',
};

const SECURITE_DOIGTS = [
  'Les doigts s’adaptent beaucoup plus lentement que les muscles : ne pas augmenter le volume de suspension avant au moins un an de pratique.',
  'Éviter l’arqué serré tant que les poulies ne sont pas habituées — la position tendue est plus sûre au début.',
  'Un claquement audible dans un doigt impose l’arrêt immédiat et un avis médical.',
];

export const MANUEL = {
  /* ═══ ESCALADE EN VOIE ════════════════════════════════════════════ */
  escalade_voie: {
    pourquoi: 'Monter longtemps, en gérant l’effort, la peur et la corde. C’est la '
      + 'forme d’escalade où l’endurance et la tête comptent autant que la force.',
    forces: [
      { titre: 'La gestion de l’effort', texte: 'Une voie se lit, se planifie, et se grimpe avec un budget d’énergie. C’est un problème de dosage autant que de force.' },
      { titre: 'La confiance', texte: 'Grimper au-dessus de son point d’assurage demande un travail sur la peur qui se transfère bien au-delà du mur.' },
      { titre: 'La cordée', texte: 'L’assurage est une responsabilité directe sur la sécurité de quelqu’un. Peu de pratiques sportives ont cette dimension.' },
    ],
    techniques: [
      {
        famille: 'Préhensions',
        items: [
          { nom: 'Tendu', gloss: 'Doigts allongés sur la prise', cles: ['Moins de contrainte sur les poulies : la position à privilégier au début'] },
          { nom: 'Arqué', gloss: 'Première phalange repliée', cles: ['Plus efficace sur les petites prises, beaucoup plus exigeant pour les poulies'] },
          { nom: 'Pince', gloss: 'Prise serrée entre pouce et doigts' },
          { nom: 'Inversée', gloss: 'Prise tenue par le dessous' },
        ],
      },
      {
        famille: 'Pieds',
        items: [
          { nom: 'Pose sur la pointe', gloss: 'Sur le bord interne ou externe du chausson', cles: ['Regarder son pied jusqu’à ce qu’il soit posé'] },
          { nom: 'Talon', gloss: 'Crochet de talon' },
          { nom: 'Adhérence', gloss: 'Sur dalle, sans prise franche', cles: ['Le poids passe sur le chausson : reculer le bassin fait glisser'] },
        ],
      },
      {
        famille: 'Déplacements',
        items: [
          { nom: 'Bassin près du mur', gloss: 'Le principe fondamental', cles: ['Plus le bassin est loin du mur, plus les bras travaillent'] },
          { nom: 'Croisé', gloss: 'Passer une main par-dessus l’autre' },
          { nom: 'Lolotte', gloss: 'Rotation du bassin, genou rentré', cles: ['Rapproche le buste du mur et économise les bras'] },
          { nom: 'Repos', gloss: 'Position permettant de relâcher un bras', cles: ['Trouver les repos est une compétence à part entière en voie'] },
        ],
      },
      {
        famille: 'Corde',
        items: [
          { nom: 'Nœud d’encordement', gloss: 'Huit tressé', cles: ['Vérification croisée systématique entre grimpeur et assureur'] },
          { nom: 'Assurage', gloss: 'Gérer la corde du grimpeur', cles: ['Ne jamais lâcher le brin de freinage — la seule règle absolue'] },
          { nom: 'Mousquetonner', gloss: 'Passer la corde dans le dégaine', cles: ['Corde dans le bon sens, sinon elle peut se décrocher en cas de chute'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Volume en voies faciles', gloss: 'Beaucoup de longueurs sous son niveau', role: 'Construit la technique et l’endurance sans détruire les doigts.' },
      { nom: 'Travail de voie', gloss: 'Répéter une voie difficile par sections', role: 'La méthode pour progresser en difficulté.' },
      { nom: 'Continuité', gloss: 'Longues séries de mouvements faciles', role: 'Endurance de préhension, sans intensité maximale.' },
      { nom: 'Lecture', gloss: 'Analyser la voie depuis le sol', role: 'Grimper avec un plan coûte beaucoup moins d’énergie.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une éthique de sécurité très stricte et non '
        + 'négociable : vérification croisée avant chaque départ, on ne lâche jamais '
        + 'le brin de freinage, on annonce ce qu’on fait. Cette rigueur est ce qui '
        + 'rend la pratique possible.',
      principes: [
        { nom: 'Vérification croisée', texte: 'Grimpeur et assureur vérifient mutuellement nœud, baudrier et système avant chaque départ. Sans exception, y compris entre habitués.' },
        { nom: 'Le brin de freinage', texte: 'La main ne le quitte jamais. C’est la seule règle qui n’admet aucune circonstance atténuante.' },
      ],
    },
    lecons: [
      'Les jambes grimpent, les bras tiennent l’équilibre.',
      'La peur se travaille comme une technique, par exposition progressive.',
      'Assurer quelqu’un est un engagement, pas une pause entre deux voies.',
    ],
    demarrer: {
      materiel: ['Chaussons de location au début', 'Baudrier', 'Le reste est fourni en salle'],
      premiere_seance: 'Une formation à l’assurage est obligatoire dans toutes les '
        + 'salles sérieuses. Tu grimperas en moulinette sur des voies faciles, et tu '
        + 'apprendras surtout à tenir une corde.',
      reperes: [
        'Ne force pas sur les doigts la première année : c’est la blessure classique du grimpeur pressé.',
        'La cotation française va du 3 au 9 ; débuter autour du 4 ou 5a est normal.',
      ],
    },
    sources: ['watts-2004', 'saul-2019'],
  },

  /* ═══ BLOC ════════════════════════════════════════════════════════ */
  bloc: {
    pourquoi: 'L’escalade réduite à sa difficulté pure : quelques mouvements, à faible '
      + 'hauteur, sans corde. C’est la forme la plus intense et la plus immédiate — '
      + 'et la plus sociale, puisqu’on cherche à plusieurs.',
    forces: [
      { titre: 'L’intensité', texte: 'Des mouvements maximaux, courts et répétables. C’est là que la force de doigts progresse le plus vite.' },
      { titre: 'La résolution de problème', texte: 'Un bloc est une énigme corporelle. On cherche, on rate, on recommence — souvent à plusieurs.' },
      { titre: 'L’accessibilité', texte: 'Ni corde, ni partenaire, ni formation d’assurage. On arrive et on grimpe.' },
    ],
    techniques: [
      {
        famille: 'Préhensions',
        items: [
          { nom: 'Tendu', gloss: 'Doigts allongés', cles: ['Position à privilégier tant que les poulies ne sont pas habituées'] },
          { nom: 'Arqué', gloss: 'Première phalange repliée', cles: ['Très efficace, très exigeant : à introduire progressivement'] },
          { nom: 'Bac', gloss: 'Grosse prise franche' },
          { nom: 'Réglette', gloss: 'Prise fine' },
        ],
      },
      {
        famille: 'Mouvements',
        items: [
          { nom: 'Jeté', gloss: 'Mouvement dynamique vers une prise éloignée', cles: ['L’élan vient des jambes et du bassin'] },
          { nom: 'Compression', gloss: 'Serrer le volume entre les deux mains' },
          { nom: 'Talon', gloss: 'Crochet de talon pour décharger les bras' },
          { nom: 'Drapeau', gloss: 'Une jambe en contrepoids', cles: ['Évite de basculer sans utiliser de prise supplémentaire'] },
        ],
      },
      {
        famille: 'Chute',
        items: [
          { nom: 'Réception', gloss: 'Tomber sur le tapis', cles: ['Fléchir les jambes, rouler en arrière, ne PAS tendre les bras derrière soi'] },
          { nom: 'Désescalade', gloss: 'Redescendre plutôt que sauter', cles: ['La majorité des blessures de bloc viennent de réceptions évitables'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Essais-erreurs', gloss: 'Chercher la méthode par tentatives', role: 'Le mode d’apprentissage de la discipline.' },
      { nom: 'Volume à basse intensité', gloss: 'Beaucoup de blocs faciles', role: 'Construit la technique et prépare les doigts.' },
      { nom: 'Projet', gloss: 'Travailler un bloc dur sur plusieurs séances', role: 'La progression en difficulté se fait ainsi.' },
      { nom: 'Suspension', gloss: 'Travail spécifique de doigts sur poutre', role: 'À réserver après un à deux ans de pratique : les poulies s’adaptent lentement.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une culture de salle nettement collaborative : on '
        + 'donne les méthodes, on encourage, on partage le tapis. Une seule règle '
        + 'stricte : ne jamais grimper sous ou au-dessus de quelqu’un.',
    },
    lecons: [
      'Rater fait partie de la méthode : un bloc se cherche.',
      'La technique remplace la force plus souvent qu’on ne le croit.',
      'Savoir redescendre vaut mieux que savoir tomber.',
    ],
    demarrer: {
      materiel: ['Chaussons — location au début', 'Sac à magnésie', 'Rien d’autre'],
      premiere_seance: 'Des blocs faciles, en travaillant la pose de pieds et la '
        + 'réception. Les avant-bras vont brûler très vite : c’est normal et ça passe.',
      reperes: [
        'Ne saute pas depuis le haut : désescalade dès que possible.',
        'Résiste à l’envie de faire de la poutre les premiers mois.',
      ],
    },
    sources: ['watts-2004', 'saul-2019'],
  },

  /* ═══ PAN ET POUTRE ═══════════════════════════════════════════════ */
  pan_gouttes: {
    pourquoi: 'L’entraînement spécifique du grimpeur : un pan incliné ou une poutre à '
      + 'doigts, pour travailler exactement la qualité qui décide en escalade. '
      + 'C’est un outil, pas une discipline — et le plus facile à mal utiliser.',
    forces: [
      { titre: 'La spécificité', texte: 'On travaille directement le facteur limitant, sans le reste.' },
      { titre: 'La mesure', texte: 'Taille de réglette, durée de suspension, charge ajoutée : le progrès se chiffre exactement.' },
      { titre: 'L’encombrement', texte: 'Une poutre tient au-dessus d’une porte.' },
    ],
    techniques: [
      {
        famille: 'Suspension',
        items: [
          { nom: 'Tendu', gloss: 'Doigts allongés', cles: ['La position de référence pour commencer'] },
          { nom: 'Arqué', gloss: 'Première phalange repliée', cles: ['À introduire seulement quand le tendu est solide'] },
          { nom: 'Trois doigts', gloss: 'Majeur, annulaire, auriculaire', cles: ['Moins contraignant pour l’index que le quatre doigts'] },
          { nom: 'Suspension lestée', gloss: 'Avec charge additionnelle', cles: ['Préférable à une prise plus petite : la charge se dose finement'] },
        ],
      },
      {
        famille: 'Pan',
        items: [
          { nom: 'Mouvements en dévers', gloss: 'Enchaînements sur mur incliné', cles: ['Le gainage est autant sollicité que les doigts'] },
          { nom: 'Circuits', gloss: 'Séquences répétées', cles: ['Travail d’endurance de préhension'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Suspensions max', gloss: 'Tenues de 7 à 10 s, récupération longue', role: 'Travaille la force maximale de doigts.' },
      { nom: 'Répétiteurs', gloss: 'Séries de tenues courtes', role: 'Travaille l’endurance de force.' },
      { nom: 'Progression très lente', gloss: 'Quelques kilos ou millimètres par cycle', role: 'La règle de l’outil : les poulies ne pardonnent pas la précipitation.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune culture propre : c’est du matériel d’entraînement. La seule chose '
        + 'que la communauté transmet à son sujet est une mise en garde — c’est l’outil '
        + 'qui blesse le plus de grimpeurs, et presque toujours par impatience.',
    },
    lecons: [
      'Un outil spécifique ne compense jamais un manque de technique.',
      'Les doigts s’adaptent en années, pas en semaines.',
      'Lester est plus sûr que rétrécir la prise.',
    ],
    demarrer: {
      materiel: ['Poutre fixée solidement', 'Élastique ou poulie pour alléger au début', 'Chronomètre'],
      premiere_seance: 'Si tu grimpes depuis moins d’un an : ne commence pas. Le '
        + 'volume de grimpe fait progresser plus vite et sans risque à ce stade.',
      reperes: [
        'Échauffement long et progressif : au moins vingt minutes avant la première suspension réelle.',
        'Jamais deux séances de poutre d’affilée.',
      ],
    },
    sources: ['watts-2004', 'saul-2019'],
  },
};

export const DETAIL = {
  escalade_voie: {
    format: {
      instance: 'International Federation of Sport Climbing (IFSC)',
      duree: 'Difficulté : 6 min par voie. Vitesse : quelques secondes sur voie normalisée de 15 m.',
      victoire: ['Atteindre le point le plus haut de la voie', 'En vitesse : le meilleur temps'],
      notation: 'En difficulté, le classement se fait au point atteint. Les cotations françaises vont du 3 au 9c.',
      cibles: 'Sans objet.',
      categories: 'Difficulté, bloc et vitesse ; par âge et sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Mobilité épaules et hanches, puis deux ou trois voies très faciles.' },
      { phase: 'Volume technique', minutes: 30, contenu: 'Voies sous son niveau, en soignant les pieds et le placement de bassin.' },
      { phase: 'Travail de difficulté', minutes: 35, contenu: 'Une ou deux voies proches du maximum, par sections.' },
      { phase: 'Continuité', minutes: 15, contenu: 'Longues séries faciles, pour l’endurance.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Étirements des avant-bras et des épaules.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Assurage validé', 'Voies en 4 et 5a', 'Pose de pieds consciente'], duree: '3 à 6 mois' },
      { palier: 'Consolider', reperes: ['5c à 6a', 'Grimper en tête', 'Lecture de voie'], duree: '1 à 2 ans' },
      { palier: 'Progresser', reperes: ['6b et au-delà', 'Travail de projet', 'Entraînement spécifique des doigts'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_ARRAQUE,
      { faute: 'Éloigner le bassin du mur', pourquoi: 'Tout le poids passe dans les bras, qui s’épuisent en quelques mouvements.', correction: 'Rapprocher le bassin, quitte à tourner le corps (lolotte).' },
      { faute: 'Ne pas regarder ses pieds', pourquoi: 'Un pied mal posé glisse au pire moment.', correction: 'Regarder le pied jusqu’à ce qu’il soit posé, à chaque fois.' },
      { faute: 'Forcer sur les doigts trop tôt', pourquoi: 'Les poulies s’adaptent bien plus lentement que les muscles.', correction: 'Volume de grimpe la première année, entraînement spécifique ensuite.' },
      { faute: 'Assurer en regardant ailleurs', pourquoi: 'Une chute arrive sans prévenir, et la réaction doit être immédiate.', correction: 'L’assureur regarde le grimpeur. Toujours.' },
    ],
    securite: {
      frequentes: ['Poulies des doigts', 'Épaules', 'Coudes', 'Chevilles à la réception'],
      prevention: SECURITE_DOIGTS.concat([
        'Vérification croisée systématique du nœud et du système d’assurage.',
      ]),
      note: 'L’escalade en salle est statistiquement sûre ; les accidents graves viennent presque exclusivement d’erreurs d’assurage, pas de chutes.',
    },
    glossaire: [
      { terme: 'Moulinette', definition: 'Corde déjà passée en haut de la voie.' },
      { terme: 'En tête', definition: 'Le grimpeur mousquetonne au fur et à mesure.' },
      { terme: 'Dégaine', definition: 'Deux mousquetons reliés par une sangle.' },
      { terme: 'Cotation', definition: 'Difficulté de la voie, du 3 au 9c en France.' },
      { terme: 'Lolotte', definition: 'Rotation du bassin, genou rentré vers le mur.' },
      { terme: 'Poulie', definition: 'Ligament qui maintient les tendons fléchisseurs contre l’os du doigt.' },
    ],
  },

  bloc: {
    format: {
      instance: 'IFSC et fédérations nationales',
      duree: 'Format compétition : plusieurs blocs, temps limité par bloc.',
      victoire: ['Le plus de blocs réussis', 'Départage au nombre d’essais et aux zones atteintes'],
      notation: 'Top, zone et nombre d’essais. Les cotations françaises de bloc vont du 3 au 9a.',
      cibles: 'Sans objet.',
      categories: 'Par âge et sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Mobilité, puis blocs très faciles en montant progressivement.' },
      { phase: 'Volume technique', minutes: 25, contenu: 'Blocs sous son niveau, en travaillant la précision des pieds.' },
      { phase: 'Projets', minutes: 35, contenu: 'Deux ou trois blocs difficiles, essais espacés.' },
      { phase: 'Volume de fin', minutes: 15, contenu: 'Blocs faciles, pour le volume sans intensité.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Étirements avant-bras, doigts, épaules.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Blocs en 3 et 4', 'Réception maîtrisée', 'Pose de pieds'], duree: '3 à 6 mois' },
      { palier: 'Consolider', reperes: ['5 à 6a', 'Mouvements dynamiques', 'Lecture de bloc'], duree: '1 à 2 ans' },
      { palier: 'Progresser', reperes: ['6b et au-delà', 'Projets sur plusieurs séances', 'Entraînement spécifique'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_ARRAQUE,
      { faute: 'Sauter depuis le haut du bloc', pourquoi: 'C’est l’origine de la majorité des entorses et fractures de cheville en salle.', correction: 'Désescalader dès que c’est possible.' },
      { faute: 'Enchaîner les essais sans repos', pourquoi: 'On grimpe de plus en plus mal et on apprend un mauvais mouvement.', correction: 'Deux à trois minutes entre les essais sur un bloc dur.' },
      { faute: 'Utiliser l’arqué systématiquement', pourquoi: 'C’est la position qui charge le plus les poulies.', correction: 'Privilégier le tendu tant que les doigts ne sont pas habitués.' },
      { faute: 'Grimper sous ou au-dessus de quelqu’un', pourquoi: 'Une chute devient une collision.', correction: 'Regarder le mur avant de démarrer, systématiquement.' },
    ],
    securite: {
      frequentes: ['Chevilles à la réception', 'Poulies des doigts', 'Épaules sur les mouvements dynamiques'],
      prevention: SECURITE_DOIGTS.concat([
        'Désescalader plutôt que sauter, et vérifier la zone de réception avant de partir.',
      ]),
      note: 'Le bloc concentre l’intensité : c’est la forme d’escalade où les doigts progressent le plus vite, et se blessent le plus souvent.',
    },
    glossaire: [
      { terme: 'Top', definition: 'Tenir la prise finale à deux mains.' },
      { terme: 'Zone', definition: 'Prise intermédiaire qui départage.' },
      { terme: 'Flash', definition: 'Réussir au premier essai avec des informations.' },
      { terme: 'Projet', definition: 'Bloc travaillé sur plusieurs séances.' },
      { terme: 'Méthode', definition: 'La séquence de mouvements choisie.' },
      { terme: 'Dévers', definition: 'Mur incliné vers l’avant.' },
    ],
  },

  pan_gouttes: {
    format: {
      instance: 'Aucune — c’est un outil d’entraînement, pas une discipline de compétition',
      duree: 'Séances courtes : 20 à 40 min, échauffement compris.',
      victoire: ['Sans objet'],
      notation: 'Taille de réglette tenue, durée de suspension, charge ajoutée ou retirée.',
      cibles: 'Sans objet.',
      categories: 'Sans objet.',
    },
    seance_type: [
      { phase: 'Échauffement général', minutes: 10, contenu: 'Cardio léger, mobilité épaules et poignets.' },
      { phase: 'Échauffement des doigts', minutes: 15, contenu: 'Suspensions très allégées, en montant progressivement. Cette phase n’est jamais raccourcie.' },
      { phase: 'Travail', minutes: 20, contenu: 'Suspensions maximales ou répétiteurs, récupération longue entre les séries.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Étirements doux des avant-bras, jamais forcés.' },
    ],
    progression: [
      { palier: 'Prérequis', reperes: ['Au moins un an de grimpe régulière', 'Aucune douleur de doigt en cours'], duree: 'avant toute poutre' },
      { palier: 'Installer', reperes: ['Suspensions allégées', 'Position tendue', 'Deux séances par semaine au maximum'], duree: '3 à 6 mois' },
      { palier: 'Charger', reperes: ['Suspensions lestées', 'Réglettes plus fines', 'Suivi écrit des charges'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Commencer avant un an de pratique', pourquoi: 'Les poulies n’ont pas eu le temps de s’adapter, et le volume de grimpe fait progresser plus vite à ce stade.', correction: 'Grimper davantage, tout simplement.' },
      { faute: 'Écourter l’échauffement', pourquoi: 'C’est l’erreur qui casse des poulies, et elle est presque toujours celle-là.', correction: 'Vingt minutes de montée progressive avant la première suspension réelle.' },
      { faute: 'Rétrécir la prise au lieu d’ajouter du poids', pourquoi: 'Le saut de difficulté est brutal et impossible à doser.', correction: 'Garder la même réglette et ajouter quelques kilos.' },
      { faute: 'Enchaîner les séances', pourquoi: 'Le tissu conjonctif récupère lentement.', correction: 'Au moins 48 h entre deux séances, jamais deux jours de suite.' },
      { faute: 'Continuer malgré une gêne', pourquoi: 'Une poulie prévient rarement deux fois.', correction: 'Arrêter la séance, sans négocier.' },
    ],
    securite: {
      frequentes: ['Rupture de poulie A2', 'Tendinopathies des fléchisseurs', 'Épicondylite'],
      prevention: SECURITE_DOIGTS.concat([
        'Échauffement long, systématique, sans exception même quand le temps manque.',
        'Tenir un carnet : c’est le seul moyen de repérer une progression trop rapide.',
      ]),
      note: 'C’est l’outil qui blesse le plus de grimpeurs, et presque toujours par impatience plutôt que par excès de charge ponctuel.',
    },
    glossaire: [
      { terme: 'Poutre', definition: 'Planche à préhensions pour suspensions.' },
      { terme: 'Réglette', definition: 'Prise fine, mesurée en millimètres de profondeur.' },
      { terme: 'Répétiteur', definition: 'Série de suspensions courtes entrecoupées de repos brefs.' },
      { terme: 'Poulie A2', definition: 'Le ligament le plus souvent blessé en escalade.' },
      { terme: 'Pan Güllich', definition: 'Mur incliné équipé de réglettes, pour l’entraînement.' },
    ],
  },
};
