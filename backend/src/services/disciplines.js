/**
 * Les disciplines, et ce qu'elles exigent physiquement.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ──────────────────────────────────────┐
 * │ `sports.js` sait ce qu'une séance COÛTE : un MET, une intensité,  │
 * │ des muscles à qui imputer la charge. C'est de la comptabilité.    │
 * │                                                                    │
 * │ Ici, on décrit ce qu'une discipline DEMANDE. C'est ce qui permet  │
 * │ de répondre à « je veux faire du karaté » autrement qu'en         │
 * │ enregistrant des séances après coup : la préparation physique se  │
 * │ réoriente vers les qualités qui comptent réellement pour elle.    │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Les pondérations ne sont pas des opinions : chacune renvoie à une
 * source, listée dans `SOURCES`. Elles disent l'importance RELATIVE
 * d'une qualité pour la discipline, sur 0–10.
 */

/** Les qualités physiques, et ce que chacune implique à l'entraînement. */
export const QUALITES = {
  force_max: {
    label: 'Force maximale',
    travail: 'Charges lourdes, 3–5 répétitions, récupération longue.',
  },
  puissance: {
    label: 'Puissance et vitesse de montée en force',
    travail: 'Mouvements explosifs, charges modérées, intention maximale.',
  },
  anaerobie: {
    label: 'Capacité anaérobie',
    travail: 'Efforts de 20 à 60 s, proches du maximum, répétés.',
  },
  aerobie: {
    label: 'Base aérobie',
    travail: 'Endurance continue à faible intensité, qui sert à RÉCUPÉRER entre les efforts.',
  },
  mobilite: {
    label: 'Mobilité',
    travail: 'Amplitude active, notamment hanche et épaule.',
  },
  gainage: {
    label: 'Transmission par le tronc',
    travail: 'Anti-rotation, anti-extension, sous charge et en vitesse.',
  },
  prehension: {
    label: 'Préhension',
    travail: 'Suspensions, tenues, pinces.',
  },
  reactivite: {
    label: 'Réactivité et changement de direction',
    travail: 'Départs sur signal, fentes, arrêts-relances. Le temps de réaction se travaille, il ne se décrète pas.',
  },
  economie: {
    label: 'Économie de mouvement',
    travail: 'Technique à allure spécifique, cadence, relâchement. Dépenser moins pour la même vitesse.',
  },
  seuil: {
    label: 'Seuil',
    travail: 'Efforts longs à intensité soutenable mais exigeante — l’allure qu’on peut tenir environ une heure.',
  },
};

export const DISCIPLINES = [
  {
    key: 'karate',
    label: 'Karaté',
    sport: 'karate',
    famille: 'combat',

    /**
     * Profil d'exigence.
     *
     * Le karaté de compétition est un effort INTERMITTENT de haute
     * intensité : des séquences très courtes et très vives, séparées
     * d'arrêts. La lactatémie relevée après un kumité se situe autour
     * de 6–12 mmol/L, ce qui situe la filière anaérobie au premier
     * plan — et la base aérobie non pas comme moyen de performance
     * directe, mais comme ce qui permet de récupérer entre les
     * séquences (Chaabene et al. 2012).
     *
     * La force maximale compte moins que la VITESSE à laquelle elle
     * s'établit : une frappe dure quelques centièmes de seconde, bien
     * moins que le temps nécessaire pour atteindre sa force maximale
     * (Zehr & Sale 1994).
     */
    exigences: {
      puissance: 9,
      anaerobie: 9,
      mobilite: 8,
      gainage: 8,
      aerobie: 6,
      force_max: 5,
      prehension: 2,
    },

    /**
     * Répartition hebdomadaire conseillée, en parts.
     *
     * La technique domine : c'est une discipline où le geste est la
     * performance. La préparation physique la SERT, elle ne la
     * remplace pas — l'inverse produit quelqu'un de fort qui frappe
     * mal.
     */
    repartition: { technique: 3, physique: 2, souplesse: 1 },

    /** Ce sur quoi la séance physique porte en priorité. */
    priorites: ['puissance', 'anaerobie', 'mobilite'],

    sources: ['chaabene-2012', 'zehr-sale-1994', 'ravier-2009'],
    syllabus: 'karate',
  },

  {
    key: 'boxe',
    label: 'Boxe anglaise',
    sport: 'boxe',
    famille: 'combat',
    /**
     * Trois minutes d'effort, une minute de repos, douze fois. C'est ce
     * format qui explique le profil : la filière anaérobie fournit les
     * échanges, mais c'est l'aérobie qui décide de ce qu'il reste au
     * dixième round (Slimani et al. 2017). Une boxe sans fond s'écroule
     * à mi-combat même avec une bonne frappe.
     */
    exigences: {
      anaerobie: 9, aerobie: 8, puissance: 8, gainage: 8,
      reactivite: 8, force_max: 5, mobilite: 5, prehension: 4,
    },
    repartition: { technique: 3, physique: 2, souplesse: 1 },
    priorites: ['anaerobie', 'aerobie', 'puissance'],
    sources: ['slimani-2017', 'davis-2015', 'zehr-sale-1994'],
    syllabus: null,
  },

  {
    key: 'boxe_thai',
    label: 'Boxe thaï',
    sport: 'boxe_thai',
    famille: 'combat',
    /**
     * Quatre armes au lieu de deux, plus le corps à corps. L'amplitude
     * de hanche cesse d'être un confort : sans elle, ni coup de pied
     * haut ni genou en clinch. Le tronc travaille en permanence, parce
     * que c'est lui qui transmet et qui encaisse (Turner 2009).
     */
    exigences: {
      puissance: 9, anaerobie: 9, gainage: 9, mobilite: 8,
      aerobie: 7, force_max: 6, reactivite: 7, prehension: 5,
    },
    repartition: { technique: 3, physique: 2, souplesse: 1 },
    priorites: ['puissance', 'anaerobie', 'gainage'],
    sources: ['turner-2009', 'crisafulli-2009'],
    syllabus: null,
  },

  {
    key: 'mma',
    label: 'MMA',
    sport: 'mma',
    famille: 'combat',
    /**
     * La seule discipline où l'on passe debout, au sol et en corps à
     * corps dans le même round. Elle n'exige pas une qualité
     * exceptionnelle mais l'absence de trou : le point faible est
     * systématiquement celui qu'on subit (James et al. 2016).
     */
    exigences: {
      gainage: 9, anaerobie: 9, force_max: 8, aerobie: 8,
      puissance: 8, prehension: 7, mobilite: 7, reactivite: 7,
    },
    repartition: { technique: 4, physique: 2, souplesse: 1 },
    priorites: ['gainage', 'anaerobie', 'force_max'],
    sources: ['james-2016', 'delvecchio-2011'],
    syllabus: null,
  },

  {
    key: 'judo',
    label: 'Judo',
    sport: 'judo',
    famille: 'combat',
    /**
     * La préhension y est une qualité de premier plan, et pas un
     * détail : le kumi-kata décide de qui peut lancer sa technique.
     * L'endurance de force isométrique des avant-bras distingue les
     * niveaux (Franchini et al. 2011).
     */
    exigences: {
      prehension: 9, anaerobie: 9, force_max: 8, puissance: 8,
      gainage: 8, aerobie: 7, mobilite: 6, reactivite: 7,
    },
    repartition: { technique: 4, physique: 2, souplesse: 1 },
    priorites: ['prehension', 'anaerobie', 'force_max'],
    sources: ['franchini-2011', 'franchini-2013'],
    syllabus: null,
  },

  {
    key: 'bjj',
    label: 'Jiu-jitsu brésilien',
    sport: 'bjj',
    famille: 'combat',
    /**
     * Beaucoup d'isométrie, peu de balistique : on tient, on résiste,
     * on repositionne. C'est la discipline de combat où la puissance
     * explosive pèse le moins et où la préhension et le tronc pèsent le
     * plus (Andreato et al. 2017).
     */
    exigences: {
      prehension: 9, gainage: 9, anaerobie: 8, mobilite: 8,
      force_max: 7, aerobie: 7, puissance: 5, reactivite: 5,
    },
    // Le temps sur le tapis fait la progression plus que la salle : le
    // rapport penche nettement vers la technique.
    repartition: { technique: 5, physique: 1, souplesse: 1 },
    priorites: ['prehension', 'gainage', 'anaerobie'],
    sources: ['andreato-2017'],
    syllabus: null,
  },

  {
    key: 'lutte',
    label: 'Lutte',
    sport: 'lutte',
    famille: 'combat',
    /**
     * Le corps à corps continu, sans distance de repli. La force
     * maximale y compte plus que dans toute autre discipline de combat,
     * parce qu'il faut déplacer un adversaire qui pèse le même poids et
     * qui résiste (Chaabene et al. 2017).
     */
    exigences: {
      force_max: 9, anaerobie: 9, gainage: 9, prehension: 8,
      puissance: 8, aerobie: 7, mobilite: 6, reactivite: 7,
    },
    repartition: { technique: 3, physique: 3, souplesse: 1 },
    priorites: ['force_max', 'anaerobie', 'gainage'],
    sources: ['chaabene-2017', 'horswill-1992'],
    syllabus: null,
  },

  {
    key: 'escrime',
    label: 'Escrime',
    sport: 'escrime',
    famille: 'combat',
    /**
     * Des actions de moins d'une seconde, séparées de longues pauses.
     * Ce qui décide n'est ni la force ni le fond mais le TEMPS DE
     * RÉACTION et la qualité de la fente (Roi & Bianchedi 2008 ;
     * Turner et al. 2014). C'est la discipline de combat au profil le
     * plus atypique.
     */
    exigences: {
      reactivite: 9, puissance: 8, mobilite: 7, gainage: 7,
      anaerobie: 7, aerobie: 6, force_max: 5, prehension: 4,
    },
    repartition: { technique: 4, physique: 2, souplesse: 1 },
    priorites: ['reactivite', 'puissance', 'mobilite'],
    sources: ['roi-2008', 'turner-2014'],
    syllabus: null,
  },

  /* ─── ENDURANCE ────────────────────────────────────────────────── */

  {
    key: 'course', label: 'Course à pied', sport: 'course', famille: 'endurance',
    /**
     * Trois déterminants expliquent l'essentiel de la performance
     * d'endurance : consommation maximale d'oxygène, seuil, et
     * ÉCONOMIE — ce que coûte une allure donnée (Joyner & Coyle 2008).
     * En course, l'économie pèse particulièrement lourd parce que le
     * geste se répète des dizaines de milliers de fois.
     */
    exigences: { aerobie: 10, seuil: 9, economie: 9, gainage: 6, anaerobie: 5, puissance: 4, mobilite: 5, force_max: 3, prehension: 1, reactivite: 3 },
    repartition: { technique: 1, physique: 4, souplesse: 1 },
    priorites: ['aerobie', 'seuil', 'economie'],
    sources: ['seiler-2010', 'joyner-coyle-2008'], syllabus: null,
  },
  {
    key: 'trail', label: 'Trail', sport: 'trail', famille: 'endurance',
    // Le dénivelé ajoute une composante de force excentrique que la
    // route ne demande pas : la descente freine à chaque appui.
    exigences: { aerobie: 9, seuil: 8, economie: 8, force_max: 6, gainage: 7, mobilite: 6, anaerobie: 6, puissance: 5, reactivite: 6, prehension: 2 },
    repartition: { technique: 1, physique: 4, souplesse: 1 },
    priorites: ['aerobie', 'seuil', 'economie'],
    sources: ['seiler-2010', 'joyner-coyle-2008'], syllabus: null,
  },
  {
    key: 'velo_route', label: 'Vélo de route', sport: 'velo_route', famille: 'endurance',
    exigences: { aerobie: 10, seuil: 9, economie: 7, anaerobie: 6, puissance: 6, gainage: 6, force_max: 4, mobilite: 4, reactivite: 3, prehension: 2 },
    repartition: { technique: 1, physique: 4, souplesse: 1 },
    priorites: ['aerobie', 'seuil'],
    sources: ['seiler-2010', 'joyner-coyle-2008'], syllabus: null,
  },
  {
    key: 'vtt', label: 'VTT', sport: 'vtt', famille: 'endurance',
    // Effort intermittent et pilotage : le profil s'écarte nettement de
    // la route malgré le même engin.
    exigences: { aerobie: 8, anaerobie: 8, gainage: 8, reactivite: 7, seuil: 7, puissance: 7, economie: 6, force_max: 5, mobilite: 5, prehension: 5 },
    repartition: { technique: 2, physique: 3, souplesse: 1 },
    priorites: ['aerobie', 'anaerobie', 'gainage'],
    sources: ['seiler-2010'], syllabus: null,
  },
  {
    key: 'home_trainer', label: 'Home trainer', sport: 'home_trainer', famille: 'endurance',
    exigences: { seuil: 9, aerobie: 9, anaerobie: 7, economie: 6, puissance: 5, gainage: 5, force_max: 3, mobilite: 3, reactivite: 2, prehension: 1 },
    repartition: { technique: 1, physique: 5, souplesse: 1 },
    priorites: ['seuil', 'aerobie'],
    sources: ['seiler-2010', 'laursen-jenkins-2002'], syllabus: null,
  },
  {
    key: 'natation', label: 'Natation', sport: 'natation', famille: 'endurance',
    /**
     * La résistance de l'eau augmente avec le CARRÉ de la vitesse :
     * l'économie y pèse plus lourd que dans toute autre discipline
     * d'endurance. Un nageur économe bat un nageur puissant.
     */
    exigences: { economie: 10, aerobie: 9, seuil: 8, mobilite: 7, gainage: 7, anaerobie: 6, puissance: 5, force_max: 4, prehension: 2, reactivite: 2 },
    repartition: { technique: 3, physique: 2, souplesse: 1 },
    priorites: ['economie', 'aerobie', 'seuil'],
    sources: ['joyner-coyle-2008', 'seiler-2010'], syllabus: null,
  },
  {
    key: 'aviron', label: 'Aviron', sport: 'aviron', famille: 'endurance',
    exigences: { aerobie: 9, seuil: 9, force_max: 7, gainage: 8, economie: 8, anaerobie: 7, puissance: 6, mobilite: 6, prehension: 5, reactivite: 3 },
    repartition: { technique: 3, physique: 2, souplesse: 1 },
    priorites: ['aerobie', 'seuil', 'economie'],
    sources: ['seiler-2010', 'joyner-coyle-2008'], syllabus: null,
  },
  {
    key: 'rameur', label: 'Rameur', sport: 'rameur', famille: 'endurance',
    exigences: { aerobie: 9, seuil: 9, economie: 8, gainage: 7, force_max: 6, anaerobie: 7, puissance: 5, mobilite: 5, prehension: 4, reactivite: 2 },
    repartition: { technique: 2, physique: 3, souplesse: 1 },
    priorites: ['aerobie', 'seuil', 'economie'],
    sources: ['seiler-2010'], syllabus: null,
  },
  {
    key: 'marche_rapide', label: 'Marche rapide', sport: 'marche_rapide', famille: 'endurance',
    // Profil délibérément modeste : c'est une activité de SANTÉ avant
    // d'être une activité de performance, et c'est sa force.
    exigences: { aerobie: 7, economie: 5, seuil: 4, gainage: 4, mobilite: 4, force_max: 2, anaerobie: 2, puissance: 2, prehension: 1, reactivite: 1 },
    repartition: { technique: 1, physique: 4, souplesse: 1 },
    priorites: ['aerobie'],
    sources: ['oms-2020'], syllabus: null,
  },
  {
    key: 'randonnee', label: 'Randonnée', sport: 'randonnee', famille: 'endurance',
    exigences: { aerobie: 8, economie: 6, force_max: 5, gainage: 5, mobilite: 5, seuil: 4, reactivite: 4, anaerobie: 3, puissance: 3, prehension: 2 },
    repartition: { technique: 1, physique: 4, souplesse: 1 },
    priorites: ['aerobie'],
    sources: ['oms-2020'], syllabus: null,
  },
  {
    key: 'corde_sauter', label: 'Corde à sauter', sport: 'corde_sauter', famille: 'endurance',
    // Coordination et raideur de cheville avant tout : c'est pour cela
    // que les salles de boxe en font, pas pour le cardio.
    exigences: { economie: 8, anaerobie: 8, reactivite: 8, aerobie: 7, puissance: 6, gainage: 5, seuil: 5, mobilite: 4, force_max: 3, prehension: 3 },
    repartition: { technique: 2, physique: 3, souplesse: 1 },
    priorites: ['economie', 'anaerobie', 'reactivite'],
    sources: ['seiler-2010'], syllabus: null,
  },
  {
    key: 'ski_fond', label: 'Ski de fond', sport: 'ski_fond', famille: 'endurance',
    /**
     * Membres inférieurs ET supérieurs simultanément : les skieurs de
     * fond figurent parmi les consommations maximales d'oxygène les
     * plus élevées jamais mesurées.
     */
    exigences: { aerobie: 10, seuil: 9, economie: 9, gainage: 7, anaerobie: 7, force_max: 5, puissance: 6, mobilite: 6, reactivite: 4, prehension: 4 },
    repartition: { technique: 3, physique: 2, souplesse: 1 },
    priorites: ['aerobie', 'seuil', 'economie'],
    sources: ['seiler-2010', 'joyner-coyle-2008'], syllabus: null,
  },

  /* ─── FORCE ET HALTÉROPHILIE ───────────────────────────────────── */

  {
    key: 'musculation', label: 'Musculation', sport: 'musculation', famille: 'force',
    // C'est le VOLUME hebdomadaire par groupe musculaire qui pilote
    // l'hypertrophie, de façon dose-dépendante (Schoenfeld 2017) ; la
    // force maximale, elle, répond surtout à l'intensité relative.
    exigences: { force_max: 9, gainage: 7, puissance: 5, mobilite: 5, prehension: 5, anaerobie: 4, economie: 3, aerobie: 2, seuil: 2, reactivite: 2 },
    repartition: { technique: 2, physique: 4, souplesse: 1 },
    priorites: ['force_max', 'gainage'],
    sources: ['schoenfeld-2017', 'suchomel-2018'], syllabus: null,
  },
  {
    key: 'crossfit', label: 'CrossFit', sport: 'crossfit', famille: 'force',
    // La polyvalence est l'objet même : aucun pic, aucun creux.
    exigences: { anaerobie: 9, gainage: 8, force_max: 7, puissance: 7, aerobie: 7, seuil: 7, mobilite: 6, prehension: 6, economie: 6, reactivite: 5 },
    repartition: { technique: 2, physique: 4, souplesse: 1 },
    priorites: ['anaerobie', 'gainage', 'force_max'],
    sources: ['schoenfeld-2017', 'storey-smith-2012'], syllabus: null,
  },
  {
    key: 'haltero', label: 'Haltérophilie', sport: 'haltero', famille: 'force',
    // La puissance, c'est-à-dire la force produite VITE, prime sur la
    // force maximale brute — et la mobilité conditionne l'accès aux
    // positions (Storey & Smith 2012).
    exigences: { puissance: 10, force_max: 9, mobilite: 8, gainage: 7, economie: 6, reactivite: 5, prehension: 5, anaerobie: 4, aerobie: 2, seuil: 2 },
    repartition: { technique: 4, physique: 2, souplesse: 1 },
    priorites: ['puissance', 'force_max', 'mobilite'],
    sources: ['storey-smith-2012', 'suchomel-2018'], syllabus: null,
  },
  {
    key: 'street_workout', label: 'Street workout', sport: 'street_workout', famille: 'force',
    exigences: { force_max: 8, gainage: 9, prehension: 7, mobilite: 6, puissance: 6, economie: 5, anaerobie: 5, reactivite: 4, aerobie: 3, seuil: 2 },
    repartition: { technique: 3, physique: 3, souplesse: 1 },
    priorites: ['gainage', 'force_max', 'prehension'],
    sources: ['schoenfeld-2017'], syllabus: null,
  },

  /* ─── ESCALADE ET GRIMPE ───────────────────────────────────────── */

  {
    key: 'escalade_voie', label: 'Escalade en voie', sport: 'escalade_voie', famille: 'grimpe',
    /**
     * La force de doigts distingue les niveaux mieux que la force
     * générale, la puissance ou la composition corporelle (Watts 2004 ;
     * Saul et al. 2019). Résultat contre-intuitif et solide.
     */
    exigences: { prehension: 10, economie: 8, gainage: 8, mobilite: 7, seuil: 7, force_max: 6, anaerobie: 6, aerobie: 5, puissance: 5, reactivite: 4 },
    repartition: { technique: 4, physique: 2, souplesse: 1 },
    priorites: ['prehension', 'economie', 'gainage'],
    sources: ['watts-2004', 'saul-2019'], syllabus: null,
  },
  {
    key: 'bloc', label: 'Bloc', sport: 'bloc', famille: 'grimpe',
    // Même déterminant, mais en intensité maximale et courte : la
    // puissance y pèse davantage qu'en voie, l'endurance beaucoup moins.
    exigences: { prehension: 10, puissance: 8, gainage: 9, economie: 7, mobilite: 7, force_max: 7, anaerobie: 6, reactivite: 5, seuil: 4, aerobie: 3 },
    repartition: { technique: 4, physique: 2, souplesse: 1 },
    priorites: ['prehension', 'gainage', 'puissance'],
    sources: ['watts-2004', 'saul-2019'], syllabus: null,
  },
  {
    key: 'pan_gouttes', label: 'Pan et poutre', sport: 'pan_gouttes', famille: 'grimpe',
    // Un OUTIL, pas une discipline : il ne travaille presque qu'une
    // seule qualité, et c'est précisément ce qui le rend dangereux.
    exigences: { prehension: 10, gainage: 6, force_max: 5, economie: 3, puissance: 4, mobilite: 3, anaerobie: 4, seuil: 3, aerobie: 2, reactivite: 2 },
    repartition: { technique: 1, physique: 5, souplesse: 1 },
    priorites: ['prehension'],
    sources: ['watts-2004', 'saul-2019'], syllabus: null,
  },

  /* ─── MOBILITÉ ET SOUPLESSE ────────────────────────────────────── */

  {
    key: 'yoga', label: 'Yoga', sport: 'yoga', famille: 'mobilite',
    // L'amplitude y est TENUE, donc active : c'est ce qui la distingue
    // des étirements passifs.
    exigences: { mobilite: 9, gainage: 7, economie: 5, force_max: 4, prehension: 3, reactivite: 3, aerobie: 3, anaerobie: 2, puissance: 2, seuil: 2 },
    repartition: { technique: 3, physique: 1, souplesse: 3 },
    priorites: ['mobilite', 'gainage'],
    sources: ['cramer-2013', 'behm-2016'], syllabus: null,
  },
  {
    key: 'pilates', label: 'Pilates', sport: 'pilates', famille: 'mobilite',
    // Méthode de CONTRÔLE MOTEUR avant d'être un travail de souplesse :
    // le gainage y prime sur l'amplitude.
    exigences: { gainage: 9, mobilite: 6, economie: 6, force_max: 4, reactivite: 3, prehension: 2, aerobie: 2, anaerobie: 2, puissance: 2, seuil: 2 },
    repartition: { technique: 3, physique: 2, souplesse: 2 },
    priorites: ['gainage'],
    sources: ['wells-2012'], syllabus: null,
  },
  {
    key: 'etirements', label: 'Étirements', sport: 'etirements', famille: 'mobilite',
    exigences: { mobilite: 9, gainage: 3, economie: 3, force_max: 1, reactivite: 1, prehension: 1, aerobie: 1, anaerobie: 1, puissance: 1, seuil: 1 },
    repartition: { technique: 1, physique: 1, souplesse: 4 },
    priorites: ['mobilite'],
    sources: ['behm-2016'], syllabus: null,
  },
];

export const disciplineOf = (key) => DISCIPLINES.find((d) => d.key === key) ?? null;

/**
 * Les qualités à travailler en priorité, ordonnées.
 *
 * On ne renvoie que ce qui dépasse le seuil : une discipline exige
 * tout un peu, et un « plan » qui liste sept qualités ne hiérarchise
 * rien. Au-dessous de 7 sur 10, la qualité entretient ; au-dessus,
 * elle décide.
 */
export function prioritesPhysiques(key, { seuil = 7 } = {}) {
  const d = disciplineOf(key);
  if (!d) return [];
  return Object.entries(d.exigences)
    .filter(([, poids]) => poids >= seuil)
    .sort((a, b) => b[1] - a[1])
    .map(([quality, poids]) => ({
      quality,
      poids,
      label: QUALITES[quality].label,
      travail: QUALITES[quality].travail,
    }));
}

/**
 * Combien de séances de chaque nature sur une semaine donnée.
 *
 * La répartition est une PROPORTION, pas un nombre fixe : quelqu'un
 * qui s'entraîne trois fois et quelqu'un qui s'entraîne six fois
 * doivent obtenir le même équilibre, pas le même volume.
 *
 * Le reste des séances va à la technique : c'est elle qui progresse le
 * plus vite avec la répétition, et l'arrondi ne doit pas la rogner.
 */
export function semaineType(key, seances) {
  const d = disciplineOf(key);
  const n = Math.max(0, Math.floor(Number(seances) || 0));
  if (!d || n === 0) return null;

  const parts = d.repartition;
  const total = Object.values(parts).reduce((a, b) => a + b, 0);

  const brut = Object.fromEntries(
    Object.entries(parts).map(([k, p]) => [k, (n * p) / total]),
  );
  const plan = Object.fromEntries(Object.keys(parts).map((k) => [k, Math.floor(brut[k])]));

  // Les séances perdues à l'arrondi vont à ce qui en manque le plus,
  // la technique départageant les ex æquo.
  let restant = n - Object.values(plan).reduce((a, b) => a + b, 0);
  const ordre = Object.keys(parts).sort((a, b) => {
    const da = brut[a] - plan[a];
    const db = brut[b] - plan[b];
    if (db !== da) return db - da;
    return a === 'technique' ? -1 : 1;
  });
  for (let i = 0; restant > 0; i += 1, restant -= 1) plan[ordre[i % ordre.length]] += 1;

  return plan;
}

export const SOURCES = {
  'chaabene-2012': {
    texte: 'Chaabene H. et al. (2012), « Physical and Physiological Profile of Elite Karate Athletes », Sports Medicine 42(10).',
    dit: 'Effort intermittent de haute intensité ; lactatémie de 6 à 12 mmol/L après kumité ; la base aérobie sert la RÉCUPÉRATION entre séquences.',
  },
  'zehr-sale-1994': {
    texte: 'Zehr E.P. & Sale D.G. (1994), « Ballistic Movement: Muscle Activation and Neuromuscular Adaptation », Sports Medicine 17(6).',
    dit: 'Une frappe dure moins longtemps que le temps nécessaire pour atteindre sa force maximale : c’est la vitesse de montée en force qui décide.',
  },
  'ravier-2009': {
    texte: 'Ravier G. et al. (2009), profil anaérobie des karatékas de haut niveau.',
    dit: 'La puissance anaérobie distingue les niveaux mieux que la force maximale.',
  },
  'slimani-2017': {
    texte: 'Slimani M. et al. (2017), « Anthropometric and Physiological Characteristics of Male Boxers », Journal of Sports Medicine and Physical Fitness.',
    dit: 'Le format 3 min / 1 min de repos répété impose une base aérobie élevée, qui conditionne ce qu’il reste dans les derniers rounds.',
  },
  'davis-2015': {
    texte: 'Davis P. et al. (2015), analyse temps-mouvement de la boxe amateur.',
    dit: 'Densité de frappes et durée des échanges : l’effort est intermittent, très bref, très répété.',
  },
  'turner-2009': {
    texte: 'Turner A. (2009), « Strength and Conditioning for Muay Thai », Strength & Conditioning Journal 31(6).',
    dit: 'Amplitude de hanche et transmission par le tronc : sans elles, ni coup de pied haut ni travail en clinch.',
  },
  'crisafulli-2009': {
    texte: 'Crisafulli A. et al. (2009), réponses cardiovasculaires au combat de boxe thaï.',
    dit: 'Sollicitation proche du maximum pendant les reprises, récupération incomplète entre elles.',
  },
  'james-2016': {
    texte: 'James L.P. et al. (2016), « Physiological Qualities of Mixed Martial Arts Competitors », Strength & Conditioning Journal.',
    dit: 'Aucune qualité n’y est dispensable : c’est le point faible qui est exploité, pas le point fort qui l’emporte.',
  },
  'delvecchio-2011': {
    texte: 'Del Vecchio F.B. et al. (2011), analyse temps-mouvement du MMA.',
    dit: 'Alternance debout / sol / corps à corps à l’intérieur d’un même round.',
  },
  'franchini-2011': {
    texte: 'Franchini E. et al. (2011), « Physiological Profiles of Elite Judo Athletes », Sports Medicine 41(2).',
    dit: 'L’endurance de force de préhension est l’un des marqueurs qui distinguent le mieux les niveaux.',
  },
  'franchini-2013': {
    texte: 'Franchini E. et al. (2013), Special Judo Fitness Test — protocole de référence.',
    dit: 'Un test de terrain reproductible pour suivre la condition spécifique.',
  },
  'andreato-2017': {
    texte: 'Andreato L.V. et al. (2017), « Physical and Physiological Profiles of Brazilian Jiu-Jitsu Athletes », Sports Medicine 47(9).',
    dit: 'Effort largement isométrique ; la préhension et le tronc priment sur la puissance explosive.',
  },
  'chaabene-2017': {
    texte: 'Chaabene H. et al. (2017), profil physique et physiologique des lutteurs.',
    dit: 'La force maximale relative au poids de corps y pèse plus que dans les disciplines de percussion.',
  },
  'horswill-1992': {
    texte: 'Horswill C.A. (1992), « Applied Physiology of Amateur Wrestling », Sports Medicine 14(2).',
    dit: 'Effort continu en opposition, avec très peu de phases de récupération réelle.',
  },
  'roi-2008': {
    texte: 'Roi G.S. & Bianchedi D. (2008), « The Science of Fencing », Sports Medicine 38(6).',
    dit: 'Actions très brèves et longues pauses : le temps de réaction et la vitesse de fente décident.',
  },
  'seiler-2010': {
    texte: 'Seiler S. (2010), « What is Best Practice for Training Intensity and Duration Distribution in Endurance Athletes? », International Journal of Sports Physiology and Performance 5(3).',
    dit: 'Les athlètes d’endurance qui progressent le plus passent environ 80 % de leur temps d’entraînement en BASSE intensité.',
  },
  'joyner-coyle-2008': {
    texte: 'Joyner M.J. & Coyle E.F. (2008), « Endurance Exercise Performance: the Physiology of Champions », The Journal of Physiology 586(1).',
    dit: 'Trois déterminants expliquent l’essentiel de la performance : consommation maximale d’oxygène, seuil, et économie de mouvement.',
  },
  'laursen-jenkins-2002': {
    texte: 'Laursen P.B. & Jenkins D.G. (2002), « The Scientific Basis for High-Intensity Interval Training », Sports Medicine 32(1).',
    dit: 'Le travail intermittent de haute intensité améliore la performance chez des sujets déjà entraînés, là où le seul volume plafonne.',
  },
  'schoenfeld-2017': {
    texte: 'Schoenfeld B.J. et al. (2017), « Dose-Response Relationship between Weekly Resistance Training Volume and Increases in Muscle Mass », Journal of Sports Sciences 35(11).',
    dit: 'L’hypertrophie suit le volume hebdomadaire par groupe musculaire, de façon dose-dépendante.',
  },
  'suchomel-2018': {
    texte: 'Suchomel T.J. et al. (2018), « The Importance of Muscular Strength: Training Considerations », Sports Medicine 48(4).',
    dit: 'La force maximale sous-tend la puissance, la vitesse et la résistance à la blessure dans la plupart des sports.',
  },
  'storey-smith-2012': {
    texte: 'Storey A. & Smith H.K. (2012), « Unique Aspects of Competitive Weightlifting », Sports Medicine 42(9).',
    dit: 'L’haltérophilie développe la puissance — force produite vite — plus que la force maximale brute ; la mobilité conditionne l’accès aux positions.',
  },
  'watts-2004': {
    texte: 'Watts P.B. (2004), « Physiology of Difficult Rock Climbing », European Journal of Applied Physiology 91(4).',
    dit: 'La force et l’endurance de préhension sont les déterminants les plus discriminants de la performance en escalade.',
  },
  'saul-2019': {
    texte: 'Saul D. et al. (2019), « Determinants for Success in Climbing: A Systematic Review », Journal of Exercise Science & Fitness 17(3).',
    dit: 'La force de doigts distingue les niveaux mieux que la force générale ou la composition corporelle.',
  },
  'behm-2016': {
    texte: 'Behm D.G. et al. (2016), « Acute Effects of Muscle Stretching on Physical Performance, Range of Motion, and Injury Incidence », Applied Physiology, Nutrition, and Metabolism 41(1).',
    dit: 'Les étirements statiques prolongés avant l’effort réduisent temporairement force et puissance ; le bénéfice sur l’amplitude, lui, est réel.',
  },
  'cramer-2013': {
    texte: 'Cramer H. et al. (2013), méta-analyses sur le yoga et la lombalgie chronique, Clinical Journal of Pain.',
    dit: 'Le yoga améliore la fonction et réduit la douleur dans la lombalgie chronique.',
  },
  'wells-2012': {
    texte: 'Wells C. et al. (2012), « The Effectiveness of Pilates Exercise in People with Chronic Low Back Pain », PLOS ONE 9(7) et travaux associés.',
    dit: 'La méthode Pilates agit d’abord sur le contrôle moteur, ce qui explique son usage en accompagnement des lombalgies.',
  },
  'oms-2020': {
    texte: 'Organisation mondiale de la santé (2020), lignes directrices sur l’activité physique et la sédentarité.',
    dit: '150 à 300 min d’activité d’intensité modérée par semaine, ou 75 à 150 min d’intensité soutenue.',
  },
  'turner-2014': {
    texte: 'Turner A. et al. (2014), caractéristiques physiques de la fente et du changement de direction en escrime.',
    dit: 'La qualité de la fente repose sur la puissance des membres inférieurs et la mobilité de hanche.',
  },
};
