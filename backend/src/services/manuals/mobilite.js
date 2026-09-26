/**
 * Manuel — catégorie MOBILITÉ ET SOUPLESSE.
 *
 * ┌─ UNE DISTINCTION QUI CHANGE TOUT ─────────────────────────────────┐
 * │ MOBILITÉ = amplitude que l'on CONTRÔLE activement.                │
 * │ SOUPLESSE = amplitude passive, atteinte sans contrôle.            │
 * │                                                                    │
 * │ On peut être très souple et peu mobile : c'est même fréquent, et  │
 * │ c'est précisément cet écart qui expose. Une articulation qui va   │
 * │ plus loin que ce que le muscle sait tenir n'est pas protégée.     │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CE QUE LA LITTÉRATURE DIT, ET CE QU'ELLE NE DIT PAS ─────────────┐
 * │ Les étirements statiques prolongés AVANT un effort réduisent      │
 * │ temporairement la force et la puissance (Behm et al. 2016). Cela  │
 * │ ne les condamne pas : cela indique QUAND les placer.              │
 * │                                                                    │
 * │ En revanche, l'idée répandue qu'ils préviennent les blessures ou  │
 * │ les courbatures n'est pas soutenue par les données. On les        │
 * │ pratique pour gagner en amplitude, ce qu'ils font réellement.     │
 * └────────────────────────────────────────────────────────────────────┘
 */

const ERREUR_FORCER = {
  faute: 'Chercher la douleur',
  pourquoi: 'La douleur déclenche une contraction réflexe : le muscle se défend, et l’amplitude diminue au lieu d’augmenter.',
  correction: 'Rester à une tension nette mais supportable, et respirer lentement.',
};

export const MANUEL = {
  /* ═══ YOGA ════════════════════════════════════════════════════════ */
  yoga: {
    pourquoi: 'Travailler l’amplitude, l’équilibre et l’attention dans le même geste. '
      + 'Ce qui distingue le yoga des étirements, c’est que la posture est TENUE et '
      + 'CONTRÔLÉE — donc active — et qu’elle est liée à la respiration.',
    forces: [
      { titre: 'L’amplitude active', texte: 'On tient les positions, on ne s’y laisse pas tomber. C’est de la mobilité, pas seulement de la souplesse.' },
      { titre: 'L’attention', texte: 'Le lien posture-respiration produit une concentration soutenue, ce qui est l’un des effets les mieux documentés de la pratique.' },
      { titre: 'L’équilibre', texte: 'De nombreuses postures sollicitent des appuis instables, qualité peu travaillée ailleurs.' },
    ],
    techniques: [
      {
        famille: 'Postures debout',
        items: [
          { nom: 'Tadasana', gloss: 'La montagne — posture de référence', cles: ['Poids réparti sur les trois appuis du pied', 'Côtes basses, nuque longue'] },
          { nom: 'Virabhadrasana', gloss: 'Le guerrier, en plusieurs variantes', cles: ['Le genou avant suit la direction du pied'] },
          { nom: 'Trikonasana', gloss: 'Le triangle', cles: ['L’allongement précède la rotation'] },
        ],
      },
      {
        famille: 'Postures au sol',
        items: [
          { nom: 'Adho mukha svanasana', gloss: 'Le chien tête en bas', cles: ['Plier les genoux plutôt que d’arrondir le dos'] },
          { nom: 'Paschimottanasana', gloss: 'Flexion avant assise', cles: ['Le mouvement part de la hanche, pas du dos'] },
          { nom: 'Bhujangasana', gloss: 'Le cobra', cles: ['Extension répartie, pas concentrée sur les lombaires'] },
        ],
      },
      {
        famille: 'Respiration',
        items: [
          { nom: 'Ujjayi', gloss: 'Respiration sonore, gorge légèrement contractée', cles: ['Sert de métronome : si elle se casse, la posture est trop dure'] },
          { nom: 'Respiration diaphragmatique', gloss: 'Le ventre se gonfle à l’inspiration' },
        ],
      },
    ],
    methodes: [
      { nom: 'Enchaînements', gloss: 'Suites de postures liées à la respiration', role: 'Construit l’endurance posturale et le rythme.' },
      { nom: 'Postures tenues', gloss: 'Maintien de 30 s à plusieurs minutes', role: 'Travail d’amplitude et de contrôle.' },
      { nom: 'Travail en appui instable', gloss: 'Postures d’équilibre', role: 'Sollicite la proprioception.' },
      { nom: 'Relaxation finale', gloss: 'Savasana', role: 'Fait partie de la séance, pas de la sortie.' },
    ],
    esprit: {
      codifie: true,
      texte: 'Le yoga postural moderne s’enracine dans une tradition textuelle ancienne, '
        + 'dont les Yoga-Sutra de Patañjali sont la référence la plus citée. Ils '
        + 'décrivent huit membres (ashtanga), dont la posture — asana — n’est qu’un '
        + 'seul. Les cours occidentaux se concentrent presque exclusivement sur cette '
        + 'partie, ce qu’il est honnête de dire plutôt que de laisser croire à une '
        + 'pratique complète.',
      principes: [
        { nom: 'Sthira sukham asanam', texte: 'La posture doit être stable ET confortable. Le texte de Patañjali pose les deux ensemble : forcer contredit la définition même.' },
        { nom: 'Ahimsa', texte: 'Non-violence, y compris envers soi. Premier des yamas, et une consigne technique autant qu’éthique.' },
      ],
    },
    lecons: [
      'Une posture forcée n’est plus une posture.',
      'La respiration est l’indicateur : si elle se casse, on est allé trop loin.',
      'Comparer son amplitude à celle du voisin n’a aucun sens — les articulations ne sont pas identiques.',
    ],
    demarrer: {
      materiel: ['Un tapis', 'Une brique et une sangle, très utiles au début'],
      premiere_seance: 'Un cours débutant, encadré. Les postures se corrigent par un '
        + 'œil extérieur, surtout au début où l’on ne sent pas encore ce qu’on fait.',
      reperes: [
        'Il existe des styles très différents : dynamique, doux, postural, chaud. Essaie plusieurs avant de juger.',
        'Utiliser des briques n’est pas un aveu : c’est ce qui permet de tenir la bonne position.',
      ],
    },
    sources: ['cramer-2013', 'behm-2016'],
  },

  /* ═══ PILATES ═════════════════════════════════════════════════════ */
  pilates: {
    pourquoi: 'Renforcer le centre et retrouver du contrôle sur des mouvements '
      + 'précis, à faible charge. C’est une méthode de contrôle moteur plus qu’un '
      + 'travail de souplesse.',
    forces: [
      { titre: 'Le contrôle du centre', texte: 'Tout part du bassin et du tronc. C’est ce qui rend la méthode utile en reprise après une douleur lombaire.' },
      { titre: 'La précision', texte: 'Peu de répétitions, exécutées exactement. L’inverse d’un travail de volume.' },
      { titre: 'La progressivité', texte: 'Chaque exercice a des variantes plus faciles et plus dures, ce qui le rend accessible à presque tous les états.' },
    ],
    techniques: [
      {
        famille: 'Principes',
        items: [
          { nom: 'Centrage', gloss: 'Engager le centre avant de bouger', cles: ['Ce n’est pas rentrer le ventre : c’est une activation profonde et respirable'] },
          { nom: 'Contrôle', gloss: 'Aucun mouvement involontaire' },
          { nom: 'Respiration', gloss: 'Latérale et thoracique', cles: ['On respire PENDANT l’effort, on ne bloque pas'] },
          { nom: 'Précision', gloss: 'Amplitude exacte, pas maximale' },
        ],
      },
      {
        famille: 'Exercices au sol',
        items: [
          { nom: 'The Hundred', gloss: 'Pompage des bras, jambes en l’air', cles: ['Le bas du dos reste en contact ou en position neutre selon la variante'] },
          { nom: 'Roll Up', gloss: 'Déroulement vertèbre par vertèbre' },
          { nom: 'Single Leg Stretch', gloss: 'Alternance des jambes' },
          { nom: 'Swimming', gloss: 'Sur le ventre, bras et jambes opposés' },
        ],
      },
      {
        famille: 'Appareils',
        items: [
          { nom: 'Reformer', gloss: 'Chariot à ressorts', cles: ['Les ressorts peuvent assister ou résister : c’est ce qui permet la progressivité'] },
          { nom: 'Cadillac', gloss: 'Cadre avec ressorts et sangles' },
        ],
      },
    ],
    methodes: [
      { nom: 'Travail au sol', gloss: 'Séries courtes, très contrôlées', role: 'Le cœur de la méthode, accessible partout.' },
      { nom: 'Travail sur appareil', gloss: 'Reformer et autres', role: 'Permet d’assister ou de charger précisément.' },
      { nom: 'Progression par variantes', gloss: 'Même exercice, difficulté ajustée', role: 'Rend la méthode utilisable en rééducation comme en entretien.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine philosophique, mais une méthode explicitement codifiée '
        + 'par son fondateur Joseph Pilates autour de principes d’exécution — '
        + 'centrage, contrôle, respiration, précision, fluidité, concentration. Ce '
        + 'sont des consignes techniques, pas une vision du monde.',
    },
    lecons: [
      'Six répétitions parfaites valent mieux que vingt approximatives.',
      'Le contrôle précède l’amplitude.',
      'Respirer pendant l’effort est une compétence qui se perd facilement.',
    ],
    demarrer: {
      materiel: ['Un tapis épais', 'Éventuellement un ballon ou un cercle'],
      premiere_seance: 'Un cours encadré, idéalement en petit groupe. Le contrôle '
        + 'moteur ne s’apprend pas devant une vidéo, parce qu’on ne voit pas ses '
        + 'propres compensations.',
      reperes: [
        'La méthode est souvent proposée en accompagnement de douleurs lombaires — dis-le à l’enseignant.',
        'Le reformer n’est pas indispensable pour commencer.',
      ],
    },
    sources: ['wells-2012'],
  },

  /* ═══ ÉTIREMENTS ══════════════════════════════════════════════════ */
  etirements: {
    pourquoi: 'Gagner de l’amplitude, et seulement cela. C’est la pratique la plus '
      + 'simple et la plus mal comprise : elle fonctionne pour ce qu’elle fait '
      + 'réellement, et pas pour ce qu’on lui prête.',
    forces: [
      { titre: 'L’efficacité sur l’amplitude', texte: 'Pratiqués régulièrement, les étirements augmentent bel et bien l’amplitude articulaire. C’est établi.' },
      { titre: 'La simplicité', texte: 'Aucun matériel, quelques minutes, n’importe où.' },
      { titre: 'Le moment de calme', texte: 'La respiration lente et l’attention au corps ont leur valeur propre, indépendamment de l’amplitude.' },
    ],
    techniques: [
      {
        famille: 'Étirement statique',
        items: [
          { nom: 'Tenue passive', gloss: 'Position maintenue 20 à 60 s', cles: ['À placer APRÈS l’effort, ou dans une séance dédiée'] },
          { nom: 'Chaîne postérieure', gloss: 'Ischio-jambiers, mollets, dos' },
          { nom: 'Fléchisseurs de hanche', gloss: 'Psoas, quadriceps', cles: ['Souvent raccourcis par la position assise prolongée'] },
        ],
      },
      {
        famille: 'Mobilité dynamique',
        items: [
          { nom: 'Balancements', gloss: 'Mouvements amples et contrôlés', cles: ['La forme à privilégier AVANT un effort'] },
          { nom: 'Cercles articulaires', gloss: 'Épaules, hanches, chevilles' },
          { nom: 'Amplitude active', gloss: 'Atteindre la position sans aide extérieure', cles: ['Plus exigeant que le passif, et plus protecteur'] },
        ],
      },
      {
        famille: 'Contracté-relâché',
        items: [
          { nom: 'PNF', gloss: 'Contraction isométrique puis relâchement dans l’amplitude', cles: ['L’une des méthodes les plus efficaces pour gagner en amplitude'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Séance dédiée', gloss: '15 à 30 min, à distance d’un effort', role: 'La façon la plus efficace de gagner réellement en amplitude.' },
      { nom: 'Après l’effort', gloss: 'Quelques minutes en fin de séance', role: 'Entretient, et marque la fin de la séance.' },
      { nom: 'Mobilité avant l’effort', gloss: 'Dynamique, pas statique', role: 'Prépare sans réduire la production de force.' },
      { nom: 'Régularité', gloss: 'Souvent et peu, plutôt que rarement et longtemps', role: 'L’amplitude se gagne par la fréquence.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune doctrine — c’est une pratique, pas une école. Ce qui mérite d’être '
        + 'dit relève plutôt du démenti : ni la prévention des blessures, ni la '
        + 'réduction des courbatures ne sont soutenues par les données. Les étirements '
        + 'augmentent l’amplitude, ce qui est déjà une bonne raison.',
    },
    lecons: [
      'Une pratique peut être utile sans faire tout ce qu’on lui prête.',
      'La régularité compte plus que la durée de la séance.',
      'Gagner en souplesse sans gagner en contrôle laisse l’articulation moins protégée.',
    ],
    demarrer: {
      materiel: ['Un tapis', 'Une sangle ou une serviette'],
      premiere_seance: 'Cinq ou six positions, tenues 30 s, à distance de tout effort. '
        + 'Aucune douleur, une tension nette.',
      reperes: [
        'Évite les étirements statiques longs juste avant un effort de force ou de vitesse.',
        'Les progrès d’amplitude se voient sur des semaines, pas sur une séance.',
      ],
    },
    sources: ['behm-2016'],
  },
};

export const DETAIL = {
  yoga: {
    format: {
      instance: 'Aucune fédération unique ; nombreuses écoles et lignées',
      duree: 'Cours de 60 à 90 min.',
      victoire: ['Sans objet — il n’y a pas de compétition, et c’est constitutif de la pratique'],
      notation: 'Aucune.',
      cibles: 'Sans objet.',
      categories: 'Par style : hatha, vinyasa, ashtanga, yin, iyengar, bikram…',
    },
    seance_type: [
      { phase: 'Installation et respiration', minutes: 10, contenu: 'Assise, mise en place de la respiration.' },
      { phase: 'Échauffement', minutes: 15, contenu: 'Mobilisations articulaires, salutations.' },
      { phase: 'Postures debout', minutes: 25, contenu: 'Le cœur de la séance : équilibre, force, amplitude.' },
      { phase: 'Postures au sol', minutes: 20, contenu: 'Flexions, extensions, torsions, tenues plus longues.' },
      { phase: 'Relaxation', minutes: 10, contenu: 'Savasana. Fait partie de la séance.' },
    ],
    progression: [
      { palier: 'Découvrir', reperes: ['Postures de base avec supports', 'Respiration installée', 'Vocabulaire minimal'], duree: '3 à 6 mois' },
      { palier: 'Installer', reperes: ['Enchaînements fluides', 'Tenues plus longues', 'Pratique régulière à la maison'], duree: '1 à 2 ans' },
      { palier: 'Approfondir', reperes: ['Postures avancées si le corps le permet', 'Travail respiratoire dédié', 'Choix d’un style'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_FORCER,
      { faute: 'Refuser les supports', pourquoi: 'Sans brique ni sangle, on compense par le dos et on travaille une position fausse.', correction: 'Les supports permettent d’atteindre la bonne position, pas d’en faire moins.' },
      { faute: 'Comparer son amplitude à celle du voisin', pourquoi: 'Les différences d’amplitude sont en grande partie osseuses, donc non modifiables.', correction: 'Se comparer à soi-même, sur des mois.' },
      { faute: 'Bloquer la respiration dans l’effort', pourquoi: 'C’est le signe que la posture est trop dure, et cela augmente la tension.', correction: 'Sortir un peu de la posture jusqu’à ce que la respiration redevienne fluide.' },
      { faute: 'Sauter la relaxation finale', pourquoi: 'Elle fait partie de la séance, pas des à-côtés.', correction: 'Rester jusqu’au bout, même cinq minutes.' },
    ],
    securite: {
      frequentes: ['Poignets (appuis répétés)', 'Bas du dos en extension', 'Genoux en position assise croisée', 'Cervicales dans les inversions'],
      prevention: [
        'Les inversions sur la tête demandent un encadrement : elles chargent les cervicales.',
        'Prévenir l’enseignant de toute blessure ou limitation avant le cours.',
        'Une amplitude gagnée sans contrôle expose l’articulation : le travail de force reste nécessaire à côté.',
      ],
      note: 'Le yoga est sûr dans l’immense majorité des cas ; les blessures rapportées concernent surtout les poignets et les postures avancées abordées trop tôt.',
    },
    glossaire: [
      { terme: 'Asana', definition: 'La posture.' },
      { terme: 'Vinyasa', definition: 'Enchaînement lié à la respiration.' },
      { terme: 'Savasana', definition: 'La posture de relaxation finale.' },
      { terme: 'Ujjayi', definition: 'Respiration sonore.' },
      { terme: 'Ashtanga', definition: 'Les huit membres du yoga selon Patañjali ; aussi le nom d’un style.' },
    ],
  },

  pilates: {
    format: {
      instance: 'Pas de fédération unique ; plusieurs écoles de formation',
      duree: 'Cours de 45 à 60 min.',
      victoire: ['Sans objet — pas de compétition'],
      notation: 'Aucune.',
      cibles: 'Sans objet.',
      categories: 'Au sol (mat) ou sur appareil (reformer, cadillac, chaise).',
    },
    seance_type: [
      { phase: 'Mise en place respiratoire', minutes: 8, contenu: 'Respiration latérale, position neutre du bassin.' },
      { phase: 'Échauffement', minutes: 10, contenu: 'Mobilisations douces de la colonne.' },
      { phase: 'Série principale', minutes: 30, contenu: 'Exercices enchaînés, peu de répétitions, exécution précise.' },
      { phase: 'Travail latéral et postérieur', minutes: 12, contenu: 'Position latérale, puis sur le ventre.' },
      { phase: 'Retour au calme', minutes: 5, contenu: 'Étirements doux.' },
    ],
    progression: [
      { palier: 'Découvrir', reperes: ['Respiration et centrage acquis', 'Exercices de base au sol', 'Position neutre du bassin'], duree: '2 à 3 mois' },
      { palier: 'Consolider', reperes: ['Série complète au sol', 'Variantes intermédiaires', 'Reformer si disponible'], duree: '6 à 12 mois' },
      { palier: 'Approfondir', reperes: ['Variantes avancées', 'Pratique autonome'], duree: 'au-delà' },
    ],
    erreurs: [
      { faute: 'Rentrer le ventre au lieu d’engager le centre', pourquoi: 'On bloque la respiration et on active les muscles superficiels au lieu des profonds.', correction: 'Une activation légère, compatible avec une respiration normale.' },
      { faute: 'Chercher l’amplitude maximale', pourquoi: 'La méthode travaille le contrôle : l’amplitude excessive fait perdre la position du bassin.', correction: 'Amplitude exacte, pas maximale.' },
      { faute: 'Enchaîner trop de répétitions', pourquoi: 'La qualité se dégrade et l’exercice perd son objet.', correction: 'Six à dix répétitions, arrêter dès que la forme change.' },
      { faute: 'Bloquer la respiration', pourquoi: 'C’est le réflexe naturel sous effort, et il va contre la méthode.', correction: 'Respirer sur le temps d’effort, en continu.' },
    ],
    securite: {
      frequentes: ['Cervicales (exercices tête relevée)', 'Bas du dos si le bassin bascule', 'Poignets sur les appuis'],
      prevention: [
        'Soutenir la tête avec la main dès que les cervicales fatiguent.',
        'Signaler toute douleur lombaire : la plupart des exercices ont une variante.',
        'Le contrôle avant le nombre : réduire les répétitions plutôt que dégrader la forme.',
      ],
      note: 'La méthode est très utilisée en accompagnement de lombalgies, ce qui suppose un enseignant informé de ton état.',
    },
    glossaire: [
      { terme: 'Centre', definition: 'La zone abdominale et lombo-pelvienne profonde.' },
      { terme: 'Position neutre', definition: 'Courbure naturelle du bas du dos préservée.' },
      { terme: 'Reformer', definition: 'Appareil à chariot et ressorts.' },
      { terme: 'Mat', definition: 'Travail au sol, sans appareil.' },
      { terme: 'Imprint', definition: 'Bas du dos légèrement plaqué, variante de sécurité.' },
    ],
  },

  etirements: {
    format: {
      instance: 'Aucune — pratique d’entretien, pas discipline compétitive',
      duree: 'De 5 min en fin de séance à 30 min en séance dédiée.',
      victoire: ['Sans objet'],
      notation: 'Aucune. L’amplitude se mesure éventuellement par des tests simples, répétés dans le temps.',
      cibles: 'Sans objet.',
      categories: 'Statique, dynamique, contracté-relâché (PNF).',
    },
    seance_type: [
      { phase: 'Mise en température', minutes: 8, contenu: 'Marche, mobilisations douces. On ne s’étire jamais à froid complet.' },
      { phase: 'Mobilité dynamique', minutes: 7, contenu: 'Balancements, cercles articulaires.' },
      { phase: 'Étirements tenus', minutes: 20, contenu: 'Six à dix positions, 30 à 60 s chacune.' },
      { phase: 'Respiration', minutes: 5, contenu: 'Assis ou allongé, respiration lente.' },
    ],
    progression: [
      { palier: 'Installer l’habitude', reperes: ['Trois séances par semaine', 'Positions de base', 'Aucune douleur'], duree: '1 à 2 mois' },
      { palier: 'Gagner', reperes: ['Amplitude mesurablement supérieure', 'Tenues plus longues', 'Introduction du PNF'], duree: '3 à 6 mois' },
      { palier: 'Entretenir', reperes: ['Amplitude stable', 'Travail actif dans les nouvelles amplitudes'], duree: 'au-delà' },
    ],
    erreurs: [
      ERREUR_FORCER,
      { faute: 'S’étirer longuement AVANT un effort de force ou de vitesse', pourquoi: 'Les étirements statiques prolongés réduisent temporairement la production de force (Behm et al. 2016).', correction: 'Mobilité dynamique avant, étirements tenus après ou en séance dédiée.' },
      { faute: 'Attendre des étirements qu’ils préviennent les blessures', pourquoi: 'Les données ne soutiennent pas cet effet, ni sur les blessures ni sur les courbatures.', correction: 'Les pratiquer pour l’amplitude, qui est un bénéfice réel et documenté.' },
      { faute: 'Gagner en souplesse sans gagner en contrôle', pourquoi: 'Une articulation qui va plus loin que ce que le muscle sait tenir est moins protégée, pas plus.', correction: 'Travailler l’amplitude ACTIVE en parallèle.' },
      { faute: 'Faire une longue séance de temps en temps', pourquoi: 'L’amplitude répond à la fréquence bien plus qu’à la durée.', correction: 'Dix minutes souvent plutôt qu’une heure par mois.' },
    ],
    securite: {
      frequentes: ['Élongations en cas d’étirement brusque', 'Aggravation d’une lésion existante'],
      prevention: [
        'Jamais à froid complet, jamais par à-coups.',
        'Ne pas étirer un muscle douloureux ou récemment lésé sans avis.',
      ],
      note: 'La pratique est très sûre ; le principal risque est de s’étirer sur une lésion en croyant la soigner.',
    },
    glossaire: [
      { terme: 'Statique', definition: 'Position tenue sans mouvement.' },
      { terme: 'Dynamique', definition: 'Mouvement contrôlé dans l’amplitude.' },
      { terme: 'PNF', definition: 'Contracté-relâché : contraction isométrique puis relâchement.' },
      { terme: 'Amplitude active', definition: 'Ce qu’on atteint sans aide extérieure.' },
      { terme: 'Amplitude passive', definition: 'Ce qu’on atteint avec une aide ou la gravité.' },
    ],
  },
};
