/**
 * Manuel — catégorie ENDURANCE.
 *
 * ┌─ CE QUI UNIT CES DOUZE DISCIPLINES ───────────────────────────────┐
 * │ Trois déterminants, et trois seulement, expliquent l'essentiel de │
 * │ la performance d'endurance : la consommation maximale d'oxygène,  │
 * │ le seuil auquel on peut tenir, et l'ÉCONOMIE — ce que coûte une   │
 * │ allure donnée (Joyner & Coyle 2008). Toutes les disciplines ci-   │
 * │ dessous les sollicitent ; elles diffèrent surtout par la part     │
 * │ d'économie technique et par la charge d'impact.                   │
 * │                                                                    │
 * │ La répartition des intensités est le point où presque tout le     │
 * │ monde se trompe, et c'est documenté : les athlètes qui progressent│
 * │ le plus passent environ 80 % de leur temps en BASSE intensité     │
 * │ (Seiler 2010). L'erreur universelle du pratiquant est de courir   │
 * │ trop vite ses séances lentes et trop lentement ses séances rapides.│
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Ce qui revient dans presque toutes ces disciplines, écrit une fois. */
const POLARISE = {
  nom: 'Répartition polarisée',
  gloss: 'Environ 80 % du temps en basse intensité, le reste en franchement dur',
  role: 'C’est la répartition observée chez les athlètes d’endurance qui progressent le plus. Le milieu — ni facile ni dur — coûte de la fatigue sans apporter grand-chose.',
};

const ERREUR_INTENSITE = {
  faute: 'Faire ses séances faciles trop vite',
  pourquoi: 'On accumule de la fatigue sans le bénéfice d’une vraie séance dure, et la séance dure suivante est ratée.',
  correction: 'En basse intensité, on doit pouvoir tenir une conversation. Si ce n’est pas le cas, ralentir — même si l’allure paraît ridicule.',
};

const SECURITE_IMPACT = [
  'Augmenter le volume progressivement : le tendon et l’os s’adaptent plus lentement que le muscle et le cœur.',
  'Une douleur qui persiste au-delà de l’échauffement est un signal d’arrêt, pas de courage.',
];

export const MANUEL = {
  /* ═══ COURSE À PIED ═══════════════════════════════════════════════ */
  course: {
    pourquoi: 'Le geste le plus disponible qui soit : une paire de chaussures et une porte. '
      + 'C’est aussi la discipline où le rapport entre le travail fourni et le progrès '
      + 'mesuré est le plus lisible.',
    forces: [
      { titre: 'La disponibilité', texte: 'Aucun matériel, aucun lieu, aucun horaire imposé. C’est ce qui explique sa place dans presque tous les plans de préparation.' },
      { titre: 'La mesure', texte: 'Allure, distance, fréquence cardiaque : le progrès se chiffre semaine après semaine.' },
      { titre: 'Le transfert', texte: 'La base aérobie construite ici sert la récupération dans presque toutes les autres disciplines.' },
    ],
    techniques: [
      {
        famille: 'La foulée',
        items: [
          { nom: 'Cadence', gloss: 'Nombre de pas par minute', cles: ['Une cadence plus élevée raccourcit la foulée et réduit le freinage', 'Se modifie progressivement, jamais d’un coup'] },
          { nom: 'Attaque du pied', gloss: 'Où le pied touche le sol', cles: ['Le pied se pose sous le bassin, pas devant lui', 'Il n’existe pas UNE bonne attaque : la position par rapport au centre de gravité compte plus'] },
          { nom: 'Posture', gloss: 'Alignement du tronc', cles: ['Regard loin, épaules basses, bassin qui n’affaisse pas'] },
        ],
      },
      {
        famille: 'Les allures',
        items: [
          { nom: 'Endurance fondamentale', gloss: 'L’allure de conversation', cles: ['Doit rester facile, c’est le socle'] },
          { nom: 'Allure seuil', gloss: 'Tenable environ une heure', cles: ['Soutenue mais contrôlée : on parle par courtes phrases'] },
          { nom: 'VMA', gloss: 'Vitesse maximale aérobie', cles: ['Fractions courtes, récupération incomplète'] },
          { nom: 'Côtes', gloss: 'Travail en montée', cles: ['Renforce sans le traumatisme de la vitesse sur le plat'] },
        ],
      },
    ],
    methodes: [
      POLARISE,
      { nom: 'Sortie longue', gloss: 'La plus longue de la semaine, en basse intensité', role: 'Construit la base et l’économie. Elle ne se court pas vite.' },
      { nom: 'Fractionné court', gloss: 'Répétitions de 30 s à 3 min', role: 'Travaille la consommation maximale d’oxygène.' },
      { nom: 'Tempo ou seuil', gloss: 'Bloc continu de 20 à 40 min', role: 'Repousse l’allure tenable longtemps.' },
      { nom: 'Lignes droites', gloss: 'Accélérations de 15 à 20 s, relâchées', role: 'Entretient la vitesse et la qualité de foulée sans fatigue.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune doctrine : la course est une pratique, pas une école. Ce qui s’y '
        + 'transmet est une culture de la régularité — la progression vient de la '
        + 'répétition sur des mois, et aucune séance isolée ne compte beaucoup.',
    },
    lecons: [
      'La régularité bat l’intensité : trois sorties moyennes valent mieux qu’une héroïque.',
      'La patience est un paramètre d’entraînement — les tendons s’adaptent en mois, pas en semaines.',
      'Ralentir est souvent le progrès le plus rapide.',
    ],
    demarrer: {
      materiel: ['Chaussures adaptées à ta foulée, achetées en magasin spécialisé', 'Rien d’autre au début'],
      premiere_seance: 'Alterne marche et course : 1 min de course, 2 min de marche, '
        + 'vingt fois. Courir d’une traite dès le premier jour est la meilleure façon '
        + 'de se blesser en trois semaines.',
      reperes: [
        'Trois sorties par semaine suffisent pour progresser longtemps.',
        'N’augmente pas ton volume de plus de 10 % par semaine.',
      ],
    },
    sources: ['seiler-2010', 'joyner-coyle-2008'],
  },

  /* ═══ TRAIL ═══════════════════════════════════════════════════════ */
  trail: {
    pourquoi: 'Courir là où le terrain décide. Le dénivelé et l’irrégularité du sol '
      + 'ajoutent une composante de force et de pilotage que la route n’a pas.',
    forces: [
      { titre: 'La force excentrique', texte: 'La descente sollicite les quadriceps en freinage, qualité que rien d’autre ne construit aussi bien.' },
      { titre: 'Le pilotage', texte: 'Lire le terrain, choisir ses appuis : une attention permanente qui change le rapport à l’effort.' },
      { titre: 'L’impact réduit', texte: 'Le sol souple et la variété des appuis répartissent les contraintes autrement que le bitume.' },
    ],
    techniques: [
      {
        famille: 'Montée',
        items: [
          { nom: 'Marche active', gloss: 'Marcher vite plutôt que courir mal', cles: ['Au-delà d’une certaine pente, marcher est plus économique que courir', 'Mains sur les cuisses pour pousser'] },
          { nom: 'Foulée raccourcie', gloss: 'Pas courts, cadence maintenue' },
        ],
      },
      {
        famille: 'Descente',
        items: [
          { nom: 'Appuis courts', gloss: 'Poser souvent, freiner peu', cles: ['Freiner à chaque pas détruit les quadriceps', 'Regard trois à cinq mètres devant, pas sur ses pieds'] },
          { nom: 'Bassin en avant', gloss: 'Ne pas se pencher en arrière', cles: ['Reculer le bassin augmente le freinage et le risque de glisser'] },
        ],
      },
      {
        famille: 'Terrain',
        items: [
          { nom: 'Bâtons', gloss: 'Usage en montée raide et sur longue distance' },
          { nom: 'Lecture de trace', gloss: 'Choisir sa ligne d’appuis à l’avance' },
        ],
      },
    ],
    methodes: [
      POLARISE,
      { nom: 'Sortie longue en terrain', gloss: 'Plusieurs heures, allure basse', role: 'Construit l’endurance spécifique et l’aisance sur le terrain.' },
      { nom: 'Côtes répétées', gloss: 'Montées de 2 à 8 min', role: 'Force spécifique et capacité en montée.' },
      { nom: 'Descentes travaillées', gloss: 'Répétitions en descente, à intensité contrôlée', role: 'La seule façon de préparer les quadriceps à ce qu’ils vont subir.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une éthique de terrain assez constante : autonomie, '
        + 'respect du milieu, entraide entre pratiquants. Elle relève de l’usage, pas '
        + 'd’un texte fondateur.',
    },
    lecons: [
      'Le terrain impose son rythme : vouloir tenir une allure fixe en trail n’a pas de sens.',
      'La descente s’apprend et se prépare — c’est elle qui casse, pas la montée.',
      'L’autonomie est une compétence : eau, nourriture, couverture, téléphone.',
    ],
    demarrer: {
      materiel: ['Chaussures à crampons', 'Sac ou ceinture porte-bidon', 'Coupe-vent même par beau temps'],
      premiere_seance: 'Un sentier connu, une heure, en marchant les montées sans '
        + 'culpabilité. La marche fait partie de la discipline, à tous les niveaux.',
      reperes: [
        'Le dénivelé compte plus que la distance : 10 km avec 600 m de D+ n’est pas un 10 km.',
        'Préviens quelqu’un de ton itinéraire pour les sorties isolées.',
      ],
    },
    sources: ['seiler-2010', 'joyner-coyle-2008'],
  },

  /* ═══ VÉLO DE ROUTE ═══════════════════════════════════════════════ */
  velo_route: {
    pourquoi: 'De très gros volumes d’endurance sans impact. C’est la discipline qui '
      + 'permet d’accumuler le plus d’heures aérobies pour le moins de traumatisme '
      + 'articulaire.',
    forces: [
      { titre: 'Le volume sans casse', texte: 'Quatre heures de vélo abîment infiniment moins qu’une heure de course. C’est ce qui en fait le support de base de beaucoup d’athlètes.' },
      { titre: 'La mesure fine', texte: 'Le capteur de puissance mesure le travail réel, indépendamment du vent et de la pente — aucune autre discipline d’endurance n’a un instrument aussi direct.' },
      { titre: 'Le terrain', texte: 'Le déplacement est une fin en soi : on va quelque part.' },
    ],
    techniques: [
      {
        famille: 'Position',
        items: [
          { nom: 'Hauteur de selle', gloss: 'Le réglage qui décide de tout', cles: ['Genou légèrement fléchi en bas de course', 'Un bassin qui bascule à chaque tour signale une selle trop haute'] },
          { nom: 'Recul de selle', gloss: 'Position avant-arrière' },
          { nom: 'Position sur le guidon', gloss: 'Cocottes, creux, haut du cintre' },
        ],
      },
      {
        famille: 'Pédalage',
        items: [
          { nom: 'Cadence', gloss: 'Tours de pédale par minute', cles: ['Une cadence plus haute déplace la contrainte du muscle vers le cardio', 'Se travaille : rester bloqué à 70 est une habitude, pas une fatalité'] },
          { nom: 'Relance', gloss: 'Repartir après un ralentissement' },
          { nom: 'Danseuse', gloss: 'Pédaler debout', cles: ['Coûte plus cher en énergie : à réserver aux passages raides ou aux relances'] },
        ],
      },
      {
        famille: 'Groupe',
        items: [
          { nom: 'Aspiration', gloss: 'Rouler dans la roue', cles: ['Économise jusqu’à un tiers de l’effort', 'Demande une trajectoire régulière et des freinages anticipés'] },
          { nom: 'Relais', gloss: 'Prendre son tour en tête' },
        ],
      },
    ],
    methodes: [
      POLARISE,
      { nom: 'Sortie longue', gloss: 'Deux à cinq heures, allure basse', role: 'Le socle de la discipline.' },
      { nom: 'Blocs au seuil', gloss: 'Deux à quatre fois 10 à 20 min', role: 'Repousse la puissance tenable longtemps.' },
      { nom: 'Fractionné court', gloss: '30 s à 5 min près du maximum', role: 'Travaille la consommation maximale.' },
      { nom: 'Force sous-maximale', gloss: 'Grand braquet à basse cadence en montée', role: 'Renforcement spécifique, à doser — c’est exigeant pour les genoux.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine écrite, mais des usages de groupe assez stricts et '
        + 'partagés : signaler les obstacles, ne pas freiner sèchement dans une file, '
        + 'attendre celui qui crève. Ce sont des règles de sécurité devenues politesse.',
    },
    lecons: [
      'Rouler en groupe est une compétence technique, pas seulement une sortie conviviale.',
      'La position est plus déterminante que le matériel.',
      'Le vent de face est un partenaire d’entraînement fiable.',
    ],
    demarrer: {
      materiel: ['Vélo à ta taille — le réglage compte plus que la gamme', 'Casque', 'Cuissard rembourré', 'Éclairage avant et arrière'],
      premiere_seance: 'Une heure sur terrain plat, en cadence souple. Apprends à '
        + 'boire et à regarder derrière sans dévier avant de chercher la performance.',
      reperes: [
        'Une étude de posture chez un professionnel évite des mois de douleurs.',
        'Apprends à réparer une crevaison avant d’en avoir une loin de chez toi.',
      ],
    },
    sources: ['seiler-2010', 'joyner-coyle-2008'],
  },

  /* ═══ VTT ═════════════════════════════════════════════════════════ */
  vtt: {
    pourquoi: 'Le vélo plus le pilotage. L’effort devient intermittent — on relance '
      + 'en permanence — et le haut du corps travaille réellement.',
    forces: [
      { titre: 'Le pilotage', texte: 'Lire une trajectoire, gérer l’adhérence, choisir sa ligne : une compétence à part entière.' },
      { titre: 'L’effort intermittent', texte: 'Rien à voir avec la régularité de la route : c’est une succession de relances.' },
      { titre: 'Le gainage', texte: 'Le tronc travaille en permanence pour absorber le terrain.' },
    ],
    techniques: [
      {
        famille: 'Position',
        items: [
          { nom: 'Position d’attaque', gloss: 'Debout, coudes écartés, talons bas', cles: ['Le vélo bouge sous un corps qui reste stable'] },
          { nom: 'Regard', gloss: 'Loin devant, jamais sur la roue avant', cles: ['On va là où on regarde — c’est littéral en VTT'] },
        ],
      },
      {
        famille: 'Pilotage',
        items: [
          { nom: 'Freinage', gloss: 'Avant et arrière dosés', cles: ['Freiner AVANT le virage, pas dedans', 'Un doigt suffit sur un frein à disque'] },
          { nom: 'Prise de virage', gloss: 'Appui extérieur, regard sortie de courbe' },
          { nom: 'Franchissement', gloss: 'Passer un obstacle', cles: ['Alléger l’avant puis l’arrière : deux temps, pas un saut'] },
          { nom: 'Manual', gloss: 'Lever la roue avant sans pédaler' },
        ],
      },
    ],
    methodes: [
      POLARISE,
      { nom: 'Sortie longue en terrain', gloss: 'Deux à quatre heures', role: 'Endurance et aisance technique.' },
      { nom: 'Ateliers de pilotage', gloss: 'Répétition d’un geste sur un obstacle précis', role: 'Le pilotage se travaille à part, pas pendant une sortie longue.' },
      { nom: 'Relances', gloss: 'Efforts courts et répétés', role: 'Reproduit la vraie structure de l’effort en VTT.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine ; une éthique de sentier partagée — céder le passage aux '
        + 'randonneurs, ne pas déraper dans les virages, ne pas créer de nouvelles '
        + 'traces. Elle relève du respect du milieu et des autres usagers.',
    },
    lecons: [
      'On va là où on regarde : le regard est la première commande du vélo.',
      'Freiner tard est plus dangereux que rouler vite.',
      'La technique économise plus d’énergie que la condition physique n’en fournit.',
    ],
    demarrer: {
      materiel: ['VTT adapté au terrain visé', 'Casque obligatoire, gants conseillés', 'Kit de réparation et pompe'],
      premiere_seance: 'Un chemin roulant, en travaillant la position debout et le '
        + 'freinage. Le pilotage s’apprend lentement et sans témoin.',
      reperes: [
        'Baisse la pression des pneus par rapport à la route : l’adhérence en dépend.',
        'Un casque qui a pris un choc se remplace, même s’il paraît intact.',
      ],
    },
    sources: ['seiler-2010'],
  },

  /* ═══ HOME TRAINER ════════════════════════════════════════════════ */
  home_trainer: {
    pourquoi: 'Le vélo débarrassé de tout ce qui perturbe la mesure : pas de vent, pas '
      + 'de descente, pas de feu rouge. C’est l’outil le plus précis pour travailler '
      + 'une intensité donnée.',
    forces: [
      { titre: 'La précision', texte: 'Une séance de fractionné s’exécute exactement comme elle est écrite. Dehors, c’est rarement le cas.' },
      { titre: 'La densité', texte: 'Une heure de home trainer contient plus de travail effectif qu’une heure sur route.' },
      { titre: 'La disponibilité', texte: 'Ni météo ni horaire — la régularité en dépend souvent l’hiver.' },
    ],
    techniques: [
      {
        famille: 'Réglages',
        items: [
          { nom: 'Position identique au vélo', gloss: 'Mêmes cotes que dehors', cles: ['Une position différente crée des douleurs qui n’existent pas sur route'] },
          { nom: 'Ventilation', gloss: 'Un ventilateur puissant', cles: ['Sans air, la fréquence cardiaque dérive et la séance devient un test de chaleur'] },
        ],
      },
      {
        famille: 'Exécution',
        items: [
          { nom: 'Cadence tenue', gloss: 'Maintenir une cadence cible' },
          { nom: 'Puissance constante', gloss: 'Tenir une cible sans à-coups', cles: ['Partir trop fort sur une répétition la ruine et gâche les suivantes'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Séances structurées', gloss: 'Échauffement, blocs, retour au calme', role: 'La raison d’être de l’outil : exécuter précisément.' },
      { nom: 'Blocs au seuil', gloss: '2 à 4 × 10 à 20 min', role: 'Le meilleur usage du home trainer.' },
      { nom: 'Fractionné court', gloss: '30/30, 40/20, 4 × 4 min', role: 'Travail de la consommation maximale, difficile à réussir dehors.' },
      { nom: 'Endurance en regardant autre chose', gloss: 'Basse intensité prolongée', role: 'Parfaitement valable, et plus supportable avec un écran.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune culture propre : c’est un outil, pas une discipline. Sa seule '
        + 'exigence est l’honnêteté — le home trainer ne ment pas sur ce qui a été '
        + 'réellement produit.',
    },
    lecons: [
      'Une séance écrite et exécutée telle quelle vaut mieux qu’une bonne intention dehors.',
      'La chaleur est la première limite en intérieur, avant les jambes.',
      'L’ennui se gère : c’est une compétence, pas un défaut de motivation.',
    ],
    demarrer: {
      materiel: ['Home trainer à roue ou à transmission directe', 'Ventilateur', 'Tapis et serviette', 'Capteur de puissance ou home trainer connecté'],
      premiere_seance: 'Quarante-cinq minutes faciles pour régler la position, la '
        + 'ventilation et l’écran. Ne commence pas par du fractionné.',
      reperes: [
        'Sans ventilateur, toute séance devient plus dure qu’elle ne devrait.',
        'La puissance affichée dépend de l’appareil : compare-toi à toi-même.',
      ],
    },
    sources: ['seiler-2010', 'laursen-jenkins-2002'],
  },

  /* ═══ NATATION ════════════════════════════════════════════════════ */
  natation: {
    pourquoi: 'La discipline d’endurance où la TECHNIQUE décide le plus. Dans l’eau, '
      + 'la résistance augmente avec le carré de la vitesse : mieux glisser rapporte '
      + 'plus que pousser plus fort.',
    forces: [
      { titre: 'Zéro impact', texte: 'Aucune contrainte articulaire : la discipline de reprise après blessure par excellence.' },
      { titre: 'La primauté de la technique', texte: 'Un nageur économe bat un nageur puissant. C’est vérifiable dès les premières longueurs.' },
      { titre: 'La respiration', texte: 'Le contrôle respiratoire y est contraint, ce qui le travaille réellement.' },
    ],
    techniques: [
      {
        famille: 'Crawl',
        items: [
          { nom: 'Position du corps', gloss: 'Horizontalité', cles: ['Des jambes qui coulent multiplient la résistance', 'Regard vers le fond, pas vers l’avant'] },
          { nom: 'Prise d’appui', gloss: 'Le trajet du bras sous l’eau', cles: ['Coude haut : c’est l’avant-bras qui appuie, pas la main seule'] },
          { nom: 'Roulis', gloss: 'Rotation du corps autour de son axe', cles: ['Permet l’allonge et rend la respiration possible'] },
          { nom: 'Respiration', gloss: 'Tourner la tête dans le roulis', cles: ['Une joue reste dans l’eau : sortir toute la tête casse la position'] },
        ],
      },
      {
        famille: 'Autres nages',
        items: [
          { nom: 'Dos crawlé', gloss: 'Respiration libre, bon pour l’équilibre' },
          { nom: 'Brasse', gloss: 'Technique exigeante pour les genoux' },
          { nom: 'Papillon', gloss: 'La plus coûteuse, réservée aux nageurs confirmés' },
        ],
      },
      {
        famille: 'Éducatifs',
        items: [
          { nom: 'Rattrapé', gloss: 'Un bras attend l’autre', cles: ['Force l’allonge et la glisse'] },
          { nom: 'Battements avec planche', gloss: 'Isoler les jambes' },
          { nom: 'Pull-buoy', gloss: 'Isoler les bras' },
        ],
      },
    ],
    methodes: [
      { nom: 'Éducatifs', gloss: 'Exercices isolant un élément technique', role: 'La méthode centrale — en natation, la technique EST l’entraînement.' },
      { nom: 'Séries', gloss: 'Répétitions avec départ chronométré', role: 'Structurer l’intensité et la récupération.' },
      { nom: 'Travail de glisse', gloss: 'Compter les coups de bras par longueur', role: 'Mesure directe de l’économie : moins de coups à vitesse égale, c’est mieux.' },
      POLARISE,
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une étiquette de bassin précise et utile : on '
        + 'choisit sa ligne selon son allure, on double par la gauche, on ne part pas '
        + 'dans les pieds de quelqu’un. Elle rend le partage possible.',
    },
    lecons: [
      'Forcer dans l’eau ralentit : c’est contre-intuitif et vérifiable immédiatement.',
      'Compter ses coups de bras enseigne plus que regarder son chrono.',
      'La respiration se travaille, elle ne se subit pas.',
    ],
    demarrer: {
      materiel: ['Lunettes qui ne fuient pas — le premier achat', 'Bonnet', 'Maillot de sport', 'Planche et pull-buoy plus tard'],
      premiere_seance: 'Des longueurs faciles entrecoupées de pauses, en cherchant à '
        + 'flotter haut plutôt qu’à aller vite. Quelques séances avec un maître-nageur '
        + 'font gagner des années.',
      reperes: [
        'Compte tes coups de bras par longueur : c’est ton indicateur de progrès le plus honnête.',
        'La fatigue en natation vient souvent de la technique, pas du fond.',
      ],
    },
    sources: ['joyner-coyle-2008', 'seiler-2010'],
  },

  /* ═══ AVIRON ══════════════════════════════════════════════════════ */
  aviron: {
    pourquoi: 'Le sport d’endurance qui sollicite le plus de masse musculaire à la '
      + 'fois — jambes, tronc, dos, bras — sans impact. Peu de disciplines demandent '
      + 'autant au système cardiovasculaire.',
    forces: [
      { titre: 'La sollicitation globale', texte: 'Environ 70 % du travail vient des jambes, mais la chaîne entière participe.' },
      { titre: 'La coordination', texte: 'Le geste est un enchaînement précis ; mal ordonné, il perd son efficacité et abîme le dos.' },
      { titre: 'Le collectif', texte: 'En bateau à plusieurs, la synchronisation prime sur la force individuelle.' },
    ],
    techniques: [
      {
        famille: 'Le coup d’aviron',
        items: [
          { nom: 'Attaque', gloss: 'L’entrée de la pelle dans l’eau', cles: ['Tibias verticaux, bras tendus, dos gainé'] },
          { nom: 'Propulsion', gloss: 'La poussée', cles: ['JAMBES, puis tronc, puis bras — dans cet ordre, jamais mélangés'] },
          { nom: 'Dégagé', gloss: 'La sortie de la pelle' },
          { nom: 'Retour', gloss: 'Le replacement', cles: ['Bras, puis tronc, puis jambes : l’inverse exact de la propulsion', 'Deux fois plus lent que la propulsion'] },
        ],
      },
      {
        famille: 'Bateau',
        items: [
          { nom: 'Équilibre', gloss: 'Tenir le bateau à plat' },
          { nom: 'Synchronisation', gloss: 'Suivre le rythme du chef de nage' },
        ],
      },
    ],
    methodes: [
      POLARISE,
      { nom: 'Travail technique à cadence basse', gloss: '16 à 20 coups par minute', role: 'Construire le geste avant de l’accélérer.' },
      { nom: 'Séries longues', gloss: 'Blocs de 10 à 30 min', role: 'Endurance spécifique.' },
      { nom: 'Ergomètre', gloss: 'Rameur d’intérieur', role: 'Mesure et travaille l’effort sans les contraintes du bateau.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine écrite, mais une culture d’équipage forte : le bateau '
        + 'n’avance que si chacun renonce à son rythme propre. C’est une exigence '
        + 'technique qui produit une éthique.',
    },
    lecons: [
      'L’ordre du geste compte plus que la force appliquée.',
      'Le retour doit être lent — se précipiter détruit l’équilibre du bateau.',
      'Dans un équipage, être régulier vaut mieux qu’être fort.',
    ],
    demarrer: {
      materiel: ['Le club fournit le bateau', 'Vêtements près du corps', 'Savoir nager est exigé partout'],
      premiere_seance: 'Souvent sur ergomètre ou en bateau d’initiation large. '
        + 'L’équilibre est la première difficulté, pas l’effort.',
      reperes: [
        'Le dos se protège par le gainage et l’ordre du geste, pas par la prudence.',
        'La cadence basse est l’école du geste : ne cherche pas à monter trop vite.',
      ],
    },
    sources: ['seiler-2010', 'joyner-coyle-2008'],
  },

  /* ═══ RAMEUR ══════════════════════════════════════════════════════ */
  rameur: {
    pourquoi: 'L’aviron sans le bateau : tout le corps, aucun impact, une mesure '
      + 'directe. C’est l’un des meilleurs outils d’entraînement cardiovasculaire en '
      + 'intérieur — à condition que le geste soit juste.',
    forces: [
      { titre: 'Le corps entier', texte: 'Jambes, tronc, dos et bras dans un seul mouvement continu.' },
      { titre: 'La mesure', texte: 'Puissance, allure au 500 m, cadence : tout est chiffré en direct.' },
      { titre: 'L’absence d’impact', texte: 'Praticable quand la course ne l’est pas.' },
    ],
    techniques: [
      {
        famille: 'Le geste',
        items: [
          { nom: 'Ordre de propulsion', gloss: 'Jambes, tronc, bras', cles: ['C’est LE point qui décide de tout', 'Tirer avec les bras en premier est l’erreur universelle'] },
          { nom: 'Ordre de retour', gloss: 'Bras, tronc, jambes', cles: ['L’inverse exact, et plus lent'] },
          { nom: 'Rapport propulsion/retour', gloss: 'Environ 1 pour 2', cles: ['Un retour précipité ruine le rythme et la respiration'] },
        ],
      },
      {
        famille: 'Réglages',
        items: [
          { nom: 'Amortisseur', gloss: 'Le réglage de résistance', cles: ['3 à 5 convient à presque tout le monde ; 10 n’est pas « plus dur », c’est un autre geste'] },
          { nom: 'Cale-pieds', gloss: 'Hauteur des sangles' },
        ],
      },
    ],
    methodes: [
      { nom: 'Technique à cadence basse', gloss: '18 à 22 coups par minute', role: 'Installer l’ordre du geste.' },
      { nom: 'Intervalles', gloss: '500 m, 1000 m, ou par temps', role: 'Travail d’intensité, très efficace sur rameur.' },
      { nom: 'Longue distance', gloss: '30 à 60 min continus', role: 'Endurance, à cadence modérée.' },
      POLARISE,
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune culture propre — c’est une machine. Elle hérite de l’exigence '
        + 'technique de l’aviron : mal utilisée, elle abîme le bas du dos plus vite '
        + 'qu’elle ne construit quoi que ce soit.',
    },
    lecons: [
      'Le rameur récompense la technique et punit la précipitation.',
      'Un amortisseur au maximum ne rend pas la séance meilleure.',
      'L’allure au 500 m est un langage commun : elle permet de se situer honnêtement.',
    ],
    demarrer: {
      materiel: ['Un rameur à air ou à eau', 'Chaussures fermées'],
      premiere_seance: 'Vingt minutes faciles, amortisseur à 4, en répétant l’ordre '
        + 'du geste à voix haute si besoin. La puissance viendra ensuite.',
      reperes: [
        'Si le bas du dos tire, c’est le geste, pas le manque de gainage.',
        'Cadence basse et forte poussée valent mieux que cadence haute et geste mou.',
      ],
    },
    sources: ['seiler-2010'],
  },

  /* ═══ MARCHE RAPIDE ═══════════════════════════════════════════════ */
  marche_rapide: {
    pourquoi: 'L’activité d’endurance la plus accessible et la plus sous-estimée. '
      + 'Elle produit l’essentiel des bénéfices de santé recommandés sans aucune des '
      + 'contraintes de la course.',
    forces: [
      { titre: 'L’accessibilité totale', texte: 'Aucun prérequis, aucun matériel, praticable à tout âge et à tout niveau.' },
      { titre: 'Le volume soutenable', texte: 'On peut en faire tous les jours, longtemps, sans récupération particulière.' },
      { titre: 'La santé', texte: 'C’est l’activité qui sous-tend les recommandations d’activité physique de l’OMS.' },
    ],
    techniques: [
      {
        famille: 'Marcher vite',
        items: [
          { nom: 'Cadence', gloss: 'Nombre de pas par minute', cles: ['Augmenter la cadence est plus efficace qu’allonger le pas'] },
          { nom: 'Bras', gloss: 'Coudes fléchis, bras actifs', cles: ['Les bras donnent le rythme et augmentent la vitesse sans effort supplémentaire perçu'] },
          { nom: 'Posture', gloss: 'Buste droit, regard loin' },
        ],
      },
      {
        famille: 'Terrain',
        items: [
          { nom: 'Côtes', gloss: 'Marcher en montée', cles: ['Augmente l’intensité sans augmenter l’impact'] },
          { nom: 'Marche avec charge', gloss: 'Sac lesté', cles: ['Progression simple et efficace, à condition d’augmenter très progressivement'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Marche continue', gloss: '30 à 90 min', role: 'Le cœur de la pratique.' },
      { nom: 'Marche fractionnée', gloss: 'Alternance rapide/souple', role: 'Augmente l’intensité sans courir.' },
      { nom: 'Marche en côte', gloss: 'Terrain vallonné', role: 'La façon la plus simple de progresser.' },
      { nom: 'Marche quotidienne', gloss: 'Intégrée aux déplacements', role: 'La régularité vaut mieux que la performance.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune doctrine. C’est peut-être ce qui la rend précieuse : il n’y a rien '
        + 'à prouver, personne devant qui se situer, et le bénéfice est acquis dès la '
        + 'première sortie.',
    },
    lecons: [
      'L’activité la plus efficace est celle qu’on fait vraiment.',
      'Marcher vite tous les jours bat courir une fois par mois.',
      'La régularité produit des effets qu’aucune intensité ne rattrape.',
    ],
    demarrer: {
      materiel: ['Des chaussures confortables', 'Rien d’autre'],
      premiere_seance: 'Trente minutes à une allure où parler devient légèrement '
        + 'difficile. C’est déjà une séance complète.',
      reperes: [
        'Les recommandations de santé parlent de 150 à 300 min par semaine d’activité modérée.',
        'Un sac lesté transforme une marche en séance de renforcement — augmente de 1 kg à la fois.',
      ],
    },
    sources: ['oms-2020'],
  },

  /* ═══ RANDONNÉE ═══════════════════════════════════════════════════ */
  randonnee: {
    pourquoi: 'De très longues durées d’effort modéré, en autonomie, dans un milieu '
      + 'qui impose ses conditions. C’est l’endurance la plus praticable sans '
      + 'préparation, et celle qui demande le plus de jugement.',
    forces: [
      { titre: 'La durée', texte: 'Des heures d’effort continu, accessible sans condition physique particulière.' },
      { titre: 'L’autonomie', texte: 'Lire une carte, gérer l’eau, anticiper la météo : des compétences transférables.' },
      { titre: 'Le dénivelé', texte: 'La montée est un excellent travail d’endurance de force, sans traumatisme.' },
    ],
    techniques: [
      {
        famille: 'Progression',
        items: [
          { nom: 'Allure régulière', gloss: 'Tenir une cadence soutenable', cles: ['Partir lentement : les premières minutes décident de la fin de journée'] },
          { nom: 'Pas de montagne', gloss: 'Pas courts, pose complète du pied' },
          { nom: 'Bâtons', gloss: 'Soulagent les genoux en descente', cles: ['Réglés plus courts en montée, plus longs en descente'] },
        ],
      },
      {
        famille: 'Autonomie',
        items: [
          { nom: 'Lecture de carte', gloss: 'Se situer sans téléphone', cles: ['La batterie se vide toujours au mauvais moment'] },
          { nom: 'Gestion de l’eau', gloss: 'Anticiper les points de ravitaillement' },
          { nom: 'Lecture de la météo', gloss: 'Renoncer est une décision technique' },
        ],
      },
    ],
    methodes: [
      { nom: 'Sorties progressives', gloss: 'Augmenter durée puis dénivelé', role: 'La préparation la plus efficace à la randonnée est la randonnée.' },
      { nom: 'Marche avec sac', gloss: 'Charge progressive', role: 'Habituer les épaules et le dos avant la sortie longue.' },
      { nom: 'Travail de descente', gloss: 'Dénivelé négatif répété', role: 'C’est la descente qui provoque les courbatures et les entorses.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une éthique de montagne largement partagée : ne '
        + 'rien laisser, ne rien prélever, saluer, aider, et savoir renoncer. Le '
        + 'renoncement y est considéré comme une compétence, pas comme un échec.',
    },
    lecons: [
      'Renoncer à temps est la décision la plus difficile et la plus valorisée.',
      'Le poids du sac est une décision qu’on paie pendant huit heures.',
      'Le terrain et la météo ne négocient pas.',
    ],
    demarrer: {
      materiel: ['Chaussures tenant la cheville', 'Sac de 20 à 30 L', 'Eau, nourriture, coupe-vent, couverture de survie', 'Carte et frontale'],
      premiere_seance: 'Une boucle de deux à trois heures avec 300 m de dénivelé, '
        + 'sur un itinéraire balisé. Note ce qui t’a manqué : c’est la vraie leçon.',
      reperes: [
        'Compte environ 300 m de dénivelé positif par heure pour un marcheur moyen.',
        'Préviens quelqu’un de ton itinéraire et de ton heure de retour.',
      ],
    },
    sources: ['oms-2020'],
  },

  /* ═══ CORDE À SAUTER ══════════════════════════════════════════════ */
  corde_sauter: {
    pourquoi: 'Beaucoup d’intensité dans très peu de place, et un travail d’appuis '
      + 'qu’aucune autre activité ne donne aussi directement. C’est un outil de '
      + 'coordination autant qu’un exercice cardio.',
    forces: [
      { titre: 'Les appuis', texte: 'Raideur de cheville, rythme, coordination : c’est pour cela que les boxeurs en font, pas pour le cardio.' },
      { titre: 'L’encombrement', texte: 'Deux mètres carrés suffisent.' },
      { titre: 'La densité', texte: 'Dix minutes de corde valent une séance courte et complète.' },
    ],
    techniques: [
      {
        famille: 'Bases',
        items: [
          { nom: 'Saut simple', gloss: 'Un tour de corde par saut', cles: ['Sauter bas : deux centimètres suffisent', 'La corde tourne par les poignets, pas par les bras'] },
          { nom: 'Pas de course', gloss: 'Alterner les pieds', cles: ['Moins fatigant que le saut pieds joints, bon pour durer'] },
        ],
      },
      {
        famille: 'Variantes',
        items: [
          { nom: 'Double under', gloss: 'Deux tours par saut', cles: ['Vient de la vitesse de poignet, pas de la hauteur du saut'] },
          { nom: 'Croisé', gloss: 'Bras croisés' },
          { nom: 'Pied à pied latéral', gloss: 'Déplacements pendant le saut' },
        ],
      },
    ],
    methodes: [
      { nom: 'Reprises', gloss: 'Blocs de 1 à 3 min', role: 'Reproduit le format des sports de combat.' },
      { nom: 'Travail continu', gloss: '10 à 20 min sans arrêt', role: 'Endurance et économie de mouvement.' },
      { nom: 'Apprentissage par répétitions courtes', gloss: 'Séries de 20 à 30 sauts', role: 'Pour les variantes : la fatigue empêche d’apprendre un geste nouveau.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine ; une place traditionnelle dans l’échauffement des '
        + 'salles de boxe, où elle sert d’abord à construire les appuis et le rythme.',
    },
    lecons: [
      'Sauter bas est plus difficile et plus utile que sauter haut.',
      'Le rythme précède la vitesse.',
      'Se prendre les pieds dans la corde fait partie de l’apprentissage — on recommence.',
    ],
    demarrer: {
      materiel: ['Une corde à la bonne longueur : poignées aux aisselles quand on marche dessus', 'Chaussures avec un peu d’amorti', 'Un sol dur mais pas du béton nu'],
      premiere_seance: 'Des blocs de 30 s entrecoupés de 30 s de repos, dix fois. '
        + 'Les mollets vont protester le lendemain : c’est attendu.',
      reperes: [
        'Les mollets et les tibias encaissent : monte le volume très progressivement.',
        'Une corde trop longue rend tout plus difficile — c’est le premier réglage.',
      ],
    },
    sources: ['seiler-2010'],
  },

  /* ═══ SKI DE FOND ═════════════════════════════════════════════════ */
  ski_fond: {
    pourquoi: 'La discipline qui sollicite le plus complètement le système '
      + 'cardiovasculaire : membres inférieurs et supérieurs simultanément, sans '
      + 'impact. Les skieurs de fond affichent parmi les consommations maximales '
      + 'd’oxygène les plus élevées jamais mesurées.',
    forces: [
      { titre: 'La sollicitation maximale', texte: 'Peu d’activités atteignent une demande cardiovasculaire aussi élevée.' },
      { titre: 'Le corps entier sans impact', texte: 'Jambes, tronc et bras travaillent, sans aucun choc articulaire.' },
      { titre: 'La glisse', texte: 'L’efficacité vient du transfert de poids et du timing, pas de la force.' },
    ],
    techniques: [
      {
        famille: 'Classique',
        items: [
          { nom: 'Pas alternatif', gloss: 'Le pas de base, bras et jambes opposés', cles: ['Le poids passe entièrement d’un ski à l’autre', 'Rester sur un ski est ce qui fait la glisse'] },
          { nom: 'Double poussée', gloss: 'Poussée simultanée des bras', cles: ['Le tronc fait le travail, pas les triceps'] },
        ],
      },
      {
        famille: 'Skating',
        items: [
          { nom: 'Un temps', gloss: 'Une poussée de bras par appui' },
          { nom: 'Deux temps', gloss: 'Une poussée pour deux appuis', cles: ['Le pas de montée le plus utilisé'] },
          { nom: 'Patinage libre', gloss: 'Sans les bras, en descente rapide' },
        ],
      },
    ],
    methodes: [
      POLARISE,
      { nom: 'Sorties longues', gloss: 'Une à trois heures en basse intensité', role: 'Le socle, comme dans toute discipline d’endurance.' },
      { nom: 'Travail technique', gloss: 'Éducatifs sur un seul ski, sans bâtons', role: 'La glisse s’apprend en isolant le transfert de poids.' },
      { nom: 'Ski-roue', gloss: 'Entraînement hors saison', role: 'Conserve le geste quand il n’y a pas de neige.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine, mais une culture nordique d’endurance et de sobriété, '
        + 'et une étiquette de piste précise : on laisse passer le plus rapide, on ne '
        + 'marche pas dans les traces.',
    },
    lecons: [
      'La glisse récompense le relâchement, jamais la crispation.',
      'Rester en équilibre sur un seul ski est toute la discipline.',
      'Le froid se gère par les couches, pas par l’effort.',
    ],
    demarrer: {
      materiel: ['Location en station pour commencer', 'Couches techniques, gants, bonnet', 'Lunettes'],
      premiere_seance: 'Une leçon collective en classique, sur piste damée et plate. '
        + 'Tomber fait partie de la première journée.',
      reperes: [
        'Classique et skating sont deux techniques distinctes, avec du matériel différent.',
        'Habille-toi pour avoir légèrement froid au départ : tu auras chaud en cinq minutes.',
      ],
    },
    sources: ['seiler-2010', 'joyner-coyle-2008'],
  },
};

export const DETAIL = {
  course: {
    format: {
      instance: 'World Athletics (route et piste)',
      duree: 'Du 5 km au marathon sur route ; du 800 m au 10 000 m sur piste.',
      victoire: ['Franchir la ligne en tête', 'Réaliser un temps de référence', 'En pratique amateur : son propre objectif'],
      notation: 'Le chronomètre. Les courses sur route sont classées par temps net ou temps officiel selon les épreuves.',
      cibles: 'Sans objet — l’adversaire est la distance.',
      categories: 'Par âge et par sexe ; catégories « vétérans » par tranches de cinq ans.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 15, contenu: 'Vingt minutes très faciles, puis gammes et lignes droites.' },
      { phase: 'Corps de séance', minutes: 30, contenu: 'Fractionné, seuil, ou allure spécifique selon le jour.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Dix minutes très faciles. Ce n’est pas optionnel.' },
      { phase: 'Étirements et mobilité', minutes: 10, contenu: 'Hanches, mollets, chaîne postérieure.' },
    ],
    progression: [
      { palier: 'Débuter', reperes: ['Alterner marche et course', 'Tenir 30 min en continu', 'Trois sorties par semaine'], duree: '2 à 3 mois' },
      { palier: 'Consolider', reperes: ['40 à 50 km par semaine', 'Une séance de qualité par semaine', 'Premier 10 km'], duree: '6 à 12 mois' },
      { palier: 'Structurer', reperes: ['Plan périodisé', 'Deux séances de qualité', 'Semi ou marathon'], duree: 'au-delà d’un an' },
    ],
    erreurs: [
      ERREUR_INTENSITE,
      { faute: 'Augmenter le volume trop vite', pourquoi: 'Le système cardiovasculaire progresse plus vite que les tendons et les os, qui lâchent les premiers.', correction: 'Pas plus de 10 % de volume en plus par semaine, et une semaine allégée toutes les trois à quatre.' },
      { faute: 'Négliger le retour au calme', pourquoi: 'On coupe net un effort intense, ce qui rallonge la récupération.', correction: 'Dix minutes très faciles à la fin de chaque séance dure.' },
      { faute: 'Courir toujours le même parcours à la même allure', pourquoi: 'Le corps s’adapte et cesse de progresser.', correction: 'Varier le terrain, l’allure et la durée.' },
      { faute: 'Ignorer une douleur naissante', pourquoi: 'La plupart des blessures de course s’installent sur des semaines et étaient audibles dès le début.', correction: 'Une douleur qui ne disparaît pas à l’échauffement impose du repos ou un avis.' },
    ],
    securite: {
      frequentes: ['Périostite tibiale', 'Tendinopathie d’Achille', 'Syndrome de l’essuie-glace (bandelette ilio-tibiale)', 'Fracture de fatigue'],
      prevention: SECURITE_IMPACT.concat([
        'Un renforcement des hanches et des mollets prévient la majorité des blessures courantes.',
        'Change de chaussures avant qu’elles ne soient mortes — autour de 600 à 800 km.',
      ]),
      note: 'Presque toutes les blessures de course sont des blessures de SURCHARGE : elles viennent du volume ajouté trop vite, pas d’un geste défectueux.',
    },
    glossaire: [
      { terme: 'Endurance fondamentale', definition: 'L’allure facile, où l’on peut parler.' },
      { terme: 'Seuil', definition: 'L’allure tenable environ une heure.' },
      { terme: 'VMA', definition: 'Vitesse maximale aérobie.' },
      { terme: 'Fartlek', definition: 'Jeu d’allures libre, sans chronomètre.' },
      { terme: 'D+', definition: 'Dénivelé positif cumulé.' },
    ],
  },

  trail: {
    format: {
      instance: 'ITRA et fédérations nationales',
      duree: 'Du format court (moins de 25 km) à l’ultra (au-delà de 80 km).',
      victoire: ['Franchir la ligne en tête', 'Terminer dans les barrières horaires — ce qui est déjà l’objectif de la plupart'],
      notation: 'Chronomètre, avec barrières horaires à des points de passage.',
      cibles: 'Sans objet.',
      categories: 'Par distance, dénivelé et cotation ITRA ; par âge et sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Marche puis course facile sur terrain roulant.' },
      { phase: 'Corps de séance', minutes: 50, contenu: 'Côtes répétées, ou sortie longue en terrain varié.' },
      { phase: 'Descente technique', minutes: 15, contenu: 'Répétitions courtes, en cherchant la fluidité plutôt que la vitesse.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Marche, puis étirements des quadriceps et des mollets.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Sorties de 1 à 2 h', 'Marcher les montées sans culpabilité', 'Aisance sur sentier roulant'], duree: '3 à 6 mois' },
      { palier: 'Format court', reperes: ['Courses de 15 à 25 km', '600 à 1000 m de D+', 'Descente maîtrisée'], duree: '1 an' },
      { palier: 'Longue distance', reperes: ['Sorties de 4 h et plus', 'Gestion de l’alimentation en course', 'Autonomie complète'], duree: 'plusieurs années' },
    ],
    erreurs: [
      ERREUR_INTENSITE,
      { faute: 'Courir toutes les montées', pourquoi: 'Au-delà d’une certaine pente, marcher vite coûte moins cher pour la même vitesse.', correction: 'Marcher activement, mains sur les cuisses.' },
      { faute: 'Se pencher en arrière en descente', pourquoi: 'On augmente le freinage, on glisse davantage et les quadriceps brûlent.', correction: 'Bassin vers l’avant, appuis courts et fréquents.' },
      { faute: 'Négliger l’entraînement en descente', pourquoi: 'C’est elle qui détruit les cuisses en course, pas la montée.', correction: 'Programmer des descentes spécifiques, progressivement.' },
      { faute: 'Partir sans autonomie', pourquoi: 'La météo et la fatigue changent tout en montagne.', correction: 'Eau, nourriture, coupe-vent, téléphone chargé, itinéraire communiqué.' },
    ],
    securite: {
      frequentes: ['Entorses de cheville', 'Douleurs de quadriceps liées au freinage', 'Hypothermie en cas d’arrêt', 'Perte d’itinéraire'],
      prevention: SECURITE_IMPACT.concat([
        'Un coupe-vent et une couverture de survie pèsent peu et changent tout.',
        'Le renforcement excentrique des quadriceps prépare réellement à la descente.',
      ]),
      note: 'Le risque principal du trail n’est pas la blessure d’effort mais l’exposition : froid, nuit, égarement.',
    },
    glossaire: [
      { terme: 'D+ / D−', definition: 'Dénivelé positif et négatif cumulés.' },
      { terme: 'Barrière horaire', definition: 'Temps limite à un point de passage.' },
      { terme: 'Cotation ITRA', definition: 'Indice de difficulté d’une course.' },
      { terme: 'Ravito', definition: 'Point de ravitaillement.' },
      { terme: 'Single', definition: 'Sentier étroit, sur une seule file.' },
    ],
  },

  velo_route: {
    format: {
      instance: 'Union Cycliste Internationale (UCI) et fédérations nationales',
      duree: 'De la course d’un jour aux épreuves par étapes ; cyclosportives de 50 à 250 km.',
      victoire: ['Franchir la ligne en tête', 'Meilleur temps en contre-la-montre', 'Classement général cumulé par étapes'],
      notation: 'Temps, avec bonifications selon les épreuves.',
      cibles: 'Sans objet.',
      categories: 'Par niveau, âge et sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Progressif, cadence souple, quelques accélérations courtes.' },
      { phase: 'Corps de séance', minutes: 60, contenu: 'Blocs au seuil, fractionné, ou endurance selon le jour.' },
      { phase: 'Retour au calme', minutes: 15, contenu: 'Petit braquet, cadence élevée.' },
    ],
    progression: [
      { palier: 'Débuter', reperes: ['Sorties de 1 à 2 h', 'Aisance en groupe', 'Savoir réparer une crevaison'], duree: '3 à 6 mois' },
      { palier: 'Consolider', reperes: ['Sorties de 3 à 4 h', 'Première cyclosportive', 'Travail structuré au seuil'], duree: '1 an' },
      { palier: 'Structurer', reperes: ['Plan périodisé', 'Suivi par la puissance', 'Objectifs chiffrés'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_INTENSITE,
      { faute: 'Rouler avec une selle mal réglée', pourquoi: 'C’est la cause la plus fréquente de douleurs de genou et de dos chez le cycliste.', correction: 'Faire régler sa position par un professionnel — cela coûte moins qu’un mois d’arrêt.' },
      { faute: 'Pédaler à trop basse cadence', pourquoi: 'On sollicite le muscle au lieu du système cardiovasculaire, et les genoux encaissent.', correction: 'Viser 85 à 95 tours par minute en endurance.' },
      { faute: 'Freiner dans le virage', pourquoi: 'On perd l’adhérence au pire moment.', correction: 'Freiner avant, relâcher dans la courbe.' },
      { faute: 'Négliger l’alimentation sur les sorties longues', pourquoi: 'La fringale arrive sans prévenir et met fin à la sortie.', correction: 'Manger avant d’avoir faim, dès la première heure.' },
    ],
    securite: {
      frequentes: ['Chutes en groupe', 'Douleurs de genou liées au réglage', 'Douleurs cervicales et lombaires', 'Accidents avec véhicules'],
      prevention: [
        'Casque systématique, éclairage même de jour.',
        'Signaler les obstacles et les changements de direction en groupe.',
        'Une étude de posture règle la majorité des douleurs chroniques.',
      ],
      note: 'Le risque principal est le trafic, pas l’effort.',
    },
    glossaire: [
      { terme: 'FTP', definition: 'Puissance tenable environ une heure.' },
      { terme: 'Braquet', definition: 'Rapport de transmission utilisé.' },
      { terme: 'Danseuse', definition: 'Pédaler en danseuse, debout.' },
      { terme: 'Bordure', definition: 'Échelonnement du peloton par vent latéral.' },
      { terme: 'Fringale', definition: 'Épuisement des réserves de glucides.' },
    ],
  },

  vtt: {
    format: {
      instance: 'UCI — cross-country, descente, enduro',
      duree: 'Cross-country olympique : environ 1 h 30. Enduro : plusieurs spéciales chronométrées.',
      victoire: ['Meilleur temps total', 'Franchir la ligne en tête en cross-country'],
      notation: 'Chronomètre ; en enduro, seules les descentes sont chronométrées.',
      cibles: 'Sans objet.',
      categories: 'Par discipline, âge et sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Roulage facile sur chemin roulant.' },
      { phase: 'Atelier technique', minutes: 25, contenu: 'Un geste précis répété sur un obstacle : freinage, virage, franchissement.' },
      { phase: 'Corps de séance', minutes: 40, contenu: 'Relances, ou boucle en terrain varié.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Roulage souple.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Position d’attaque naturelle', 'Freinage maîtrisé', 'Chemins roulants'], duree: '3 à 6 mois' },
      { palier: 'Consolider', reperes: ['Virages en appui', 'Petits franchissements', 'Sorties de 2 h'], duree: '1 an' },
      { palier: 'Progresser', reperes: ['Lecture de trajectoire', 'Terrain technique', 'Première compétition si envie'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Regarder sa roue avant', pourquoi: 'On va là où on regarde : regarder à un mètre, c’est piloter à un mètre.', correction: 'Regard porté cinq à dix mètres devant.' },
      { faute: 'Rester assis dans le technique', pourquoi: 'Le vélo ne peut plus bouger sous le corps et chaque obstacle se transmet au bassin.', correction: 'Position d’attaque : debout, coudes écartés.' },
      { faute: 'Freiner dans le virage', pourquoi: 'On bloque la roue et on part en glissade.', correction: 'Freiner avant, relâcher dans la courbe.' },
      { faute: 'Gonfler comme sur route', pourquoi: 'Trop de pression supprime l’adhérence et la filtration.', correction: 'Adapter la pression au terrain et au poids — nettement plus bas qu’en route.' },
    ],
    securite: {
      frequentes: ['Chutes', 'Clavicules et poignets', 'Coupures'],
      prevention: [
        'Casque obligatoire, gants et protections selon le terrain.',
        'Un casque qui a pris un choc se remplace.',
        'Reconnaître un passage à pied avant de le tenter est une pratique normale.',
      ],
      note: 'La progression technique protège plus que les protections.',
    },
    glossaire: [
      { terme: 'Position d’attaque', definition: 'Debout, coudes écartés, prêt à absorber.' },
      { terme: 'Manual', definition: 'Rouler sur la roue arrière sans pédaler.' },
      { terme: 'Single', definition: 'Sentier étroit.' },
      { terme: 'Spéciale', definition: 'Section chronométrée en enduro.' },
      { terme: 'Bunny hop', definition: 'Sauter les deux roues sans obstacle.' },
    ],
  },

  home_trainer: {
    format: {
      instance: 'Pas de compétition officielle propre ; épreuves virtuelles organisées par des plateformes et, depuis 2020, championnats UCI de cyclisme e-sport.',
      duree: 'Séances de 30 min à 2 h ; épreuves virtuelles de 20 à 60 min.',
      victoire: ['Sans objet en entraînement', 'En épreuve virtuelle : franchir la ligne en tête'],
      notation: 'Puissance en watts, rapportée au poids pour comparer.',
      cibles: 'Sans objet.',
      categories: 'Par rapport puissance/poids sur les plateformes.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 15, contenu: 'Progressif, avec deux ou trois accélérations courtes.' },
      { phase: 'Corps de séance', minutes: 40, contenu: 'Blocs au seuil ou fractionné court, exécutés précisément.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Cadence élevée, résistance minimale.' },
    ],
    progression: [
      { palier: 'S’installer', reperes: ['Position confortable', 'Ventilation correcte', 'Tenir 45 min'], duree: 'quelques semaines' },
      { palier: 'Structurer', reperes: ['Séances au seuil', 'Connaître sa FTP', 'Suivi hebdomadaire'], duree: 'quelques mois' },
      { palier: 'Périodiser', reperes: ['Blocs de charge et de récupération', 'Test régulier', 'Objectif extérieur'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'S’entraîner sans ventilateur', pourquoi: 'La chaleur fait dériver la fréquence cardiaque : la séance devient un test de tolérance thermique.', correction: 'Un ventilateur puissant, dirigé sur le torse.' },
      { faute: 'Partir trop fort sur la première répétition', pourquoi: 'On ruine les suivantes et la séance perd son objet.', correction: 'La première doit être la plus facile, pas la plus rapide.' },
      { faute: 'Mettre l’amortisseur ou la résistance au maximum', pourquoi: 'Ce n’est pas « plus dur », c’est un autre geste, plus traumatisant.', correction: 'Régler pour retrouver la cadence de route.' },
      { faute: 'Copier la position d’un autre vélo', pourquoi: 'Des cotes différentes créent des douleurs absentes sur route.', correction: 'Reproduire exactement les cotes de son vélo habituel.' },
    ],
    securite: {
      frequentes: ['Points de compression liés à la position fixe', 'Déshydratation', 'Surchauffe'],
      prevention: [
        'Boire davantage qu’en extérieur : la transpiration ne s’évapore pas.',
        'Se lever de la selle régulièrement — dehors, le terrain l’impose naturellement.',
      ],
      note: 'L’absence de variation de position est la contrainte propre à l’intérieur.',
    },
    glossaire: [
      { terme: 'FTP', definition: 'Puissance tenable environ une heure.' },
      { terme: 'ERG', definition: 'Mode où l’appareil impose la puissance quelle que soit la cadence.' },
      { terme: 'Zone', definition: 'Plage d’intensité définie en pourcentage de la FTP.' },
      { terme: 'Dérive cardiaque', definition: 'Montée de la fréquence à puissance constante, souvent thermique.' },
    ],
  },

  natation: {
    format: {
      instance: 'World Aquatics (ex-FINA)',
      duree: 'Du 50 m au 1500 m en bassin ; eau libre de 5 à 25 km.',
      victoire: ['Toucher le mur en premier', 'Réaliser un temps de qualification'],
      notation: 'Chronomètre, au centième. Les virages et coulées comptent dans le temps.',
      cibles: 'Sans objet.',
      categories: 'Par nage, distance, âge et sexe. Bassin de 25 m ou 50 m.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 15, contenu: '400 à 800 m souples, nages variées.' },
      { phase: 'Éducatifs', minutes: 15, contenu: 'Exercices techniques avec matériel : planche, pull-buoy, rattrapé.' },
      { phase: 'Corps de séance', minutes: 25, contenu: 'Séries avec départs chronométrés.' },
      { phase: 'Retour au calme', minutes: 10, contenu: '200 à 400 m souples, en dos ou en crawl relâché.' },
    ],
    progression: [
      { palier: 'S’installer', reperes: ['Respiration bilatérale', 'Tenir 400 m sans arrêt', 'Flotter horizontalement'], duree: '3 à 6 mois' },
      { palier: 'Construire', reperes: ['1500 m en continu', 'Virages culbutés', 'Réduire ses coups de bras par longueur'], duree: '1 an' },
      { palier: 'Structurer', reperes: ['Séries à allure cible', 'Quatre nages', 'Eau libre si envie'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Lever la tête pour respirer', pourquoi: 'Les jambes coulent aussitôt et la résistance explose.', correction: 'Tourner la tête dans le roulis, une joue restant dans l’eau.' },
      { faute: 'Tirer avec la main à plat, coude bas', pourquoi: 'On appuie sur presque rien.', correction: 'Coude haut : c’est l’avant-bras qui fait la surface d’appui.' },
      { faute: 'Battre des jambes trop fort', pourquoi: 'Les jambes consomment énormément pour très peu de propulsion en nage longue.', correction: 'Battements légers et continus, la propulsion vient des bras.' },
      { faute: 'Nager toujours à la même allure', pourquoi: 'On entretient sans progresser, et la technique ne se teste jamais.', correction: 'Alterner éducatifs, séries et nage continue.' },
    ],
    securite: {
      frequentes: ['Épaules (« épaule du nageur »)', 'Genoux en brasse', 'Irritations cutanées'],
      prevention: [
        'Le volume d’épaule augmente progressivement : c’est la blessure typique du nageur pressé.',
        'Ne jamais nager seul en eau libre.',
        'Un échauffement d’épaules hors de l’eau avant les séries intenses.',
      ],
      note: 'La plupart des douleurs d’épaule viennent d’un geste défectueux répété, pas du volume seul.',
    },
    glossaire: [
      { terme: 'Éducatif', definition: 'Exercice isolant un élément technique.' },
      { terme: 'Pull-buoy', definition: 'Flotteur entre les cuisses, pour isoler les bras.' },
      { terme: 'Coulée', definition: 'La glisse après le départ ou le virage.' },
      { terme: 'Culbute', definition: 'Virage retourné.' },
      { terme: 'Départ chronométré', definition: 'Série partant toutes les N secondes.' },
    ],
  },

  aviron: {
    format: {
      instance: 'World Rowing (ex-FISA)',
      duree: 'Distance olympique : 2000 m. Épreuves longues : 5000 m et plus.',
      victoire: ['Franchir la ligne en tête'],
      notation: 'Chronomètre, par couloir.',
      cibles: 'Sans objet.',
      categories: 'Par type de bateau (skiff, deux, quatre, huit), couple ou pointe, avec ou sans barreur, poids légers ou toutes catégories.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 15, contenu: 'Ergomètre ou palier souple, mobilité des hanches et des épaules.' },
      { phase: 'Technique à cadence basse', minutes: 20, contenu: '16 à 20 coups par minute, en cherchant l’ordre du geste.' },
      { phase: 'Corps de séance', minutes: 40, contenu: 'Blocs longs ou séries selon le jour.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Cadence basse, relâché.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Équilibre du bateau', 'Ordre du geste sur ergomètre', 'Bateau d’initiation'], duree: '3 à 6 mois' },
      { palier: 'Consolider', reperes: ['Sortie en skiff ou en équipage', 'Cadences variées', '2000 m sur ergomètre'], duree: '1 an' },
      { palier: 'Structurer', reperes: ['Régates', 'Travail de cadence élevée', 'Équipage stable'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Tirer avec les bras en premier', pourquoi: 'On court-circuite les jambes, qui fournissent l’essentiel de la puissance.', correction: 'Jambes, puis tronc, puis bras — et jamais deux en même temps.' },
      { faute: 'Précipiter le retour', pourquoi: 'Le bateau est freiné, l’équilibre se perd, la respiration se dérègle.', correction: 'Le retour dure environ deux fois la propulsion.' },
      { faute: 'Arrondir le dos à l’attaque', pourquoi: 'C’est la façon la plus directe de se blesser au bas du dos.', correction: 'Bascule du bassin, dos gainé, tibias verticaux.' },
      { faute: 'Chercher la cadence avant le geste', pourquoi: 'Un geste faux répété plus vite devient une blessure plus tôt.', correction: 'Cadence basse jusqu’à ce que l’ordre soit automatique.' },
    ],
    securite: {
      frequentes: ['Lombalgies', 'Côtes (fractures de fatigue)', 'Ampoules'],
      prevention: [
        'L’ordre du geste protège le dos mieux que n’importe quel renforcement.',
        'Savoir nager est exigé, et les consignes de sécurité sur l’eau ne sont pas facultatives.',
      ],
      note: 'La lombalgie de l’aviron est presque toujours technique avant d’être musculaire.',
    },
    glossaire: [
      { terme: 'Coup d’aviron', definition: 'Le cycle complet du mouvement.' },
      { terme: 'Attaque', definition: 'L’entrée de la pelle dans l’eau.' },
      { terme: 'Dégagé', definition: 'La sortie de la pelle.' },
      { terme: 'Couple', definition: 'Deux avirons par rameur.' },
      { terme: 'Pointe', definition: 'Un aviron par rameur.' },
      { terme: 'Chef de nage', definition: 'Le rameur qui donne la cadence.' },
    ],
  },

  rameur: {
    format: {
      instance: 'Épreuves d’ergomètre organisées par les fédérations d’aviron',
      duree: 'Distance de référence : 2000 m. Autres formats : 500 m, 5000 m, 30 min, 60 min.',
      victoire: ['Meilleur temps sur la distance', 'Plus grande distance sur le temps imparti'],
      notation: 'Temps, allure au 500 m, et puissance moyenne.',
      cibles: 'Sans objet.',
      categories: 'Par âge, sexe et catégorie de poids.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 10, contenu: 'Cadence 18 à 20, souple, en répétant l’ordre du geste.' },
      { phase: 'Technique', minutes: 10, contenu: 'Exercices par séquences : bras seuls, bras et tronc, puis complet.' },
      { phase: 'Corps de séance', minutes: 25, contenu: 'Intervalles ou distance continue.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Cadence basse, résistance faible.' },
    ],
    progression: [
      { palier: 'Apprendre', reperes: ['Ordre du geste automatique', 'Tenir 20 min', 'Amortisseur réglé correctement'], duree: '1 à 2 mois' },
      { palier: 'Construire', reperes: ['Premier 2000 m chronométré', 'Intervalles structurés', 'Allure au 500 m stable'], duree: '6 mois' },
      { palier: 'Progresser', reperes: ['Plan par zones', 'Tests réguliers', 'Cadences variées maîtrisées'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Tirer avec les bras avant les jambes', pourquoi: 'On se prive de la source principale de puissance et le dos compense.', correction: 'Jambes, tronc, bras — dans cet ordre, séparément au début.' },
      { faute: 'Mettre l’amortisseur à 10', pourquoi: 'Ce n’est pas une résistance plus grande, c’est un geste plus lourd et plus traumatisant.', correction: 'Régler entre 3 et 5 pour la plupart des pratiquants.' },
      { faute: 'Monter la cadence pour aller plus vite', pourquoi: 'La vitesse vient de la poussée, pas de la fréquence.', correction: 'Chercher une poussée plus forte à cadence égale.' },
      { faute: 'Arrondir le dos en fin de course', pourquoi: 'Position de compression lombaire répétée des centaines de fois.', correction: 'Buste incliné en arrière mais gainé, jamais enroulé.' },
    ],
    securite: {
      frequentes: ['Lombalgies', 'Ampoules', 'Irritations aux mains'],
      prevention: [
        'Le geste correct est la prévention : aucun renforcement ne compense un mauvais ordre.',
        'Arrêter dès qu’une douleur lombaire apparaît, pas à la fin de la série.',
      ],
      note: 'Le rameur est très sûr quand il est bien exécuté, et l’une des machines les plus traumatisantes quand il ne l’est pas.',
    },
    glossaire: [
      { terme: 'Allure 500 m', definition: 'Le temps qu’il faudrait pour parcourir 500 m à l’effort courant.' },
      { terme: 'Amortisseur', definition: 'Réglage de l’entrée d’air, souvent confondu avec la résistance.' },
      { terme: 'SPM', definition: 'Coups par minute.' },
      { terme: 'Split', definition: 'Synonyme d’allure au 500 m.' },
    ],
  },

  marche_rapide: {
    format: {
      instance: 'World Athletics pour la marche athlétique (20 km et 35 km) ; la marche rapide de loisir n’a pas de format compétitif',
      duree: 'Marche athlétique : 20 km et 35 km. En loisir : 30 à 90 min par séance.',
      victoire: ['En compétition de marche athlétique : franchir la ligne en tête sans perdre le contact au sol'],
      notation: 'Chronomètre. En marche athlétique, des juges sanctionnent la perte de contact et la flexion du genou.',
      cibles: 'Sans objet.',
      categories: 'Par âge et sexe.',
    },
    seance_type: [
      { phase: 'Mise en route', minutes: 10, contenu: 'Marche souple, mobilité des chevilles et des hanches.' },
      { phase: 'Corps de séance', minutes: 40, contenu: 'Marche soutenue, plate ou vallonnée selon l’objectif.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Marche lente, étirements des mollets.' },
    ],
    progression: [
      { palier: 'Installer l’habitude', reperes: ['30 min, trois fois par semaine', 'Allure où parler devient difficile'], duree: '1 à 2 mois' },
      { palier: 'Augmenter', reperes: ['60 min sans difficulté', 'Terrain vallonné', 'Cinq sorties par semaine'], duree: '3 à 6 mois' },
      { palier: 'Charger', reperes: ['Sac lesté', 'Marche longue de 2 h et plus'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Allonger le pas pour aller plus vite', pourquoi: 'On freine à chaque appui et on sollicite les ischio-jambiers inutilement.', correction: 'Augmenter la cadence, pas la longueur du pas.' },
      { faute: 'Laisser les bras pendre', pourquoi: 'On se prive d’un moteur de rythme gratuit.', correction: 'Coudes fléchis, bras actifs le long du corps.' },
      { faute: 'Ajouter du poids trop vite', pourquoi: 'Les épaules et le bas du dos encaissent avant les jambes.', correction: 'Un kilo de plus à la fois, toutes les deux semaines.' },
      { faute: 'Considérer que ça ne compte pas', pourquoi: 'On néglige la seule activité qu’on pratiquerait vraiment tous les jours.', correction: 'La compter comme une séance : elle en est une.' },
    ],
    securite: {
      frequentes: ['Aponévrosite plantaire', 'Ampoules', 'Douleurs de tibia si le volume monte vite'],
      prevention: SECURITE_IMPACT.concat([
        'Des chaussures usées provoquent plus de problèmes en marche qu’on ne le croit.',
      ]),
      note: 'C’est l’activité la plus sûre de toutes, ce qui n’exclut pas une progression raisonnable.',
    },
    glossaire: [
      { terme: 'Cadence', definition: 'Pas par minute.' },
      { terme: 'Marche athlétique', definition: 'Discipline olympique avec contrainte de contact au sol.' },
      { terme: 'Rucking', definition: 'Marche avec sac lesté.' },
    ],
  },

  randonnee: {
    format: {
      instance: 'Fédérations de randonnée pédestre ; pas de compétition',
      duree: 'De la demi-journée au trek de plusieurs jours.',
      victoire: ['Sans objet — il n’y a rien à gagner, et c’est le propos'],
      notation: 'Aucune. Les itinéraires sont cotés en difficulté et en dénivelé.',
      cibles: 'Sans objet.',
      categories: 'Cotation par difficulté technique et engagement.',
    },
    seance_type: [
      { phase: 'Départ progressif', minutes: 30, contenu: 'Première demi-heure volontairement lente, le temps que le corps se mette en route.' },
      { phase: 'Montée', minutes: 90, contenu: 'Allure régulière, pauses courtes et espacées plutôt que longues et fréquentes.' },
      { phase: 'Descente', minutes: 60, contenu: 'La partie qui use : pas courts, bâtons si disponibles.' },
      { phase: 'Retour', minutes: 20, contenu: 'Étirements des quadriceps et des mollets, réhydratation.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Boucles de 2 à 3 h', '300 à 500 m de D+', 'Itinéraires balisés'], duree: 'quelques sorties' },
      { palier: 'Consolider', reperes: ['Journées de 5 à 6 h', '800 à 1200 m de D+', 'Lecture de carte'], duree: '1 an' },
      { palier: 'Engagement', reperes: ['Treks de plusieurs jours', 'Autonomie complète', 'Terrain non balisé'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Partir trop vite', pourquoi: 'On paie la première demi-heure pendant tout le reste de la journée.', correction: 'Démarrer volontairement lentement.' },
      { faute: 'Multiplier les pauses courtes', pourquoi: 'Le corps ne se met jamais en régime et se refroidit.', correction: 'Peu de pauses, plus longues et choisies.' },
      { faute: 'Sous-estimer la descente', pourquoi: 'C’est là que se produisent la plupart des entorses et des courbatures.', correction: 'Garder de l’énergie et de la vigilance pour la seconde moitié.' },
      { faute: 'Surcharger le sac', pourquoi: 'Chaque kilo se paie pendant des heures.', correction: 'Vider le sac après chaque sortie et se demander ce qui n’a pas servi.' },
    ],
    securite: {
      frequentes: ['Entorses de cheville', 'Déshydratation', 'Hypothermie', 'Égarement'],
      prevention: [
        'Prévenir quelqu’un de l’itinéraire et de l’heure de retour.',
        'Coupe-vent, eau et frontale même pour une sortie courte.',
        'Renoncer devant une météo qui tourne est la bonne décision, toujours.',
      ],
      note: 'Le danger en randonnée vient rarement de l’effort et presque toujours des conditions ou du jugement.',
    },
    glossaire: [
      { terme: 'D+', definition: 'Dénivelé positif cumulé.' },
      { terme: 'Balisage', definition: 'Marquage de l’itinéraire (GR, PR…).' },
      { terme: 'Refuge', definition: 'Hébergement de montagne.' },
      { terme: 'Portage', definition: 'Le poids transporté.' },
    ],
  },

  corde_sauter: {
    format: {
      instance: 'International Jump Rope Union pour la corde sportive ; usage d’entraînement partout ailleurs',
      duree: 'En compétition : épreuves de vitesse (30 s, 3 min) et de figures libres.',
      victoire: ['Nombre de sauts sur le temps imparti', 'Notation des figures en freestyle'],
      notation: 'Comptage automatique ou par juges selon l’épreuve.',
      cibles: 'Sans objet.',
      categories: 'Vitesse, endurance, freestyle, double dutch.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 5, contenu: 'Chevilles, mollets, poignets.' },
      { phase: 'Technique', minutes: 10, contenu: 'Séries courtes sur une variante en cours d’apprentissage.' },
      { phase: 'Corps de séance', minutes: 20, contenu: 'Reprises de 1 à 3 min, ou travail continu.' },
      { phase: 'Étirements', minutes: 10, contenu: 'Mollets et pieds, systématiquement.' },
    ],
    progression: [
      { palier: 'Débuter', reperes: ['30 s sans s’arrêter', 'Saut bas et régulier', 'Corde à la bonne longueur'], duree: 'quelques semaines' },
      { palier: 'Construire', reperes: ['3 min en continu', 'Pas de course maîtrisé', 'Premiers croisés'], duree: '2 à 3 mois' },
      { palier: 'Varier', reperes: ['Double unders', 'Enchaînements', 'Reprises longues'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Sauter trop haut', pourquoi: 'On se fatigue dix fois plus vite et les mollets encaissent inutilement.', correction: 'Deux centimètres suffisent à laisser passer la corde.' },
      { faute: 'Faire tourner la corde avec les bras', pourquoi: 'Les épaules brûlent et le rythme devient impossible à tenir.', correction: 'Les poignets font le travail, coudes près du corps.' },
      { faute: 'Utiliser une corde mal réglée', pourquoi: 'Trop longue, elle traîne ; trop courte, elle accroche.', correction: 'Pied sur le milieu de la corde, les poignées arrivent aux aisselles.' },
      { faute: 'Monter le volume trop vite', pourquoi: 'Les tibias et les mollets ne suivent pas le rythme du cardio.', correction: 'Progresser par blocs courts et augmenter sur plusieurs semaines.' },
    ],
    securite: {
      frequentes: ['Périostite tibiale', 'Tendinopathie d’Achille', 'Douleurs de mollets'],
      prevention: SECURITE_IMPACT.concat([
        'Éviter le béton nu : un sol dur mais légèrement souple protège beaucoup.',
      ]),
      note: 'La corde est traître : très peu fatigante cardio-vasculairement au début, très exigeante pour les structures du bas de jambe.',
    },
    glossaire: [
      { terme: 'Double under', definition: 'Deux tours de corde pour un saut.' },
      { terme: 'Pas de course', definition: 'Saut en alternant les pieds.' },
      { terme: 'Croisé', definition: 'Saut bras croisés.' },
      { terme: 'Double dutch', definition: 'Deux cordes tournées en sens inverse.' },
    ],
  },

  ski_fond: {
    format: {
      instance: 'Fédération Internationale de Ski (FIS)',
      duree: 'Du sprint (environ 3 min) aux épreuves de 50 km.',
      victoire: ['Franchir la ligne en tête', 'Meilleur temps en départ individuel'],
      notation: 'Chronomètre. Départs en ligne, individuels ou poursuites selon les épreuves.',
      cibles: 'Sans objet.',
      categories: 'Classique et skating, par distance, âge et sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Glisse très facile, en classique.' },
      { phase: 'Technique', minutes: 20, contenu: 'Éducatifs : sur un seul ski, sans bâtons, transfert de poids.' },
      { phase: 'Corps de séance', minutes: 50, contenu: 'Sortie longue en basse intensité, ou blocs en montée.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Glisse souple, puis étirements au chaud.' },
    ],
    progression: [
      { palier: 'Découverte', reperes: ['Tenir sur les skis', 'Pas alternatif sur piste plate', 'Descentes en chasse-neige'], duree: 'quelques journées' },
      { palier: 'Construire', reperes: ['Sorties d’1 à 2 h', 'Double poussée', 'Premiers pas de skating'], duree: '1 à 2 saisons' },
      { palier: 'Structurer', reperes: ['Deux techniques maîtrisées', 'Sorties longues', 'Première course populaire'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Rester en appui sur les deux skis', pourquoi: 'Sans transfert complet du poids, il n’y a pas de glisse — on marche avec des skis.', correction: 'Passer entièrement sur un ski, et y rester le temps de la glisse.' },
      { faute: 'Tirer sur les bras en double poussée', pourquoi: 'Les triceps s’épuisent et la poussée reste faible.', correction: 'Engager le tronc : on tombe sur les bâtons, on ne tire pas dessus.' },
      { faute: 'Se couvrir trop au départ', pourquoi: 'On transpire, puis on gèle à la première pause.', correction: 'Partir en ayant légèrement froid.' },
      { faute: 'Négliger le fartage', pourquoi: 'Un ski qui n’accroche pas rend la technique classique impossible à apprendre.', correction: 'Demander conseil en magasin ou opter pour des skis à écailles au début.' },
    ],
    securite: {
      frequentes: ['Chutes en descente', 'Refroidissement', 'Ampoules'],
      prevention: [
        'Système de couches, et une couche sèche de rechange dans le sac.',
        'Ne pas partir seul sur des itinéraires isolés par grand froid.',
      ],
      note: 'Le risque principal est thermique, pas traumatique.',
    },
    glossaire: [
      { terme: 'Classique', definition: 'Technique dans les traces, pas alternatif.' },
      { terme: 'Skating', definition: 'Technique de patinage, hors traces.' },
      { terme: 'Double poussée', definition: 'Poussée simultanée des deux bâtons.' },
      { terme: 'Fart', definition: 'Produit appliqué sous le ski, pour la glisse ou l’accroche.' },
      { terme: 'Damé', definition: 'Piste préparée par une machine.' },
    ],
  },
};
