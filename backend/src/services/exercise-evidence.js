// Curation du catalogue d'exercices.
//
// Le dataset met ses 1324 entrées sur le même plan : le squat barre y
// pèse autant que le « dumbbell biceps curl v sit on bosu ball ». Sans
// hiérarchie, le catalogue est un annuaire, pas un outil de choix — et
// un générateur qui y pioche au hasard produit des séances absurdes.
//
// Ce fichier attribue un PALIER et un PATRON DE MOUVEMENT à un noyau
// d'environ 130 exercices. Le reste du catalogue reste consultable,
// simplement non classé : ne pas figurer ici ne veut pas dire « mauvais »,
// mais « redondant avec un mouvement mieux documenté ».
//
// ⚠️ Aucun de ces exercices n'est validé par un professionnel de santé.
// Le classement s'appuie sur la littérature publiée, citée ligne à ligne.
// C'est vérifiable et contestable — ce qu'une « certification » maison
// ne serait pas.

// ---------------------------------------------------------------------
// Références
//
// Chaque affirmation du classement pointe vers l'une d'elles. Une règle
// de sélection sans source n'est qu'une préférence personnelle.
// ---------------------------------------------------------------------

export const REFERENCES = {
  who2020: {
    citation: 'OMS (2020). Lignes directrices sur l’activité physique et la sédentarité.',
    url: 'https://www.who.int/publications/i/item/9789240015128',
    claim: '150–300 min d’activité d’endurance modérée par semaine, et un '
      + 'renforcement musculaire de tous les grands groupes au moins 2 jours par semaine.',
  },
  schoenfeld2017volume: {
    citation: 'Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship '
      + 'between weekly resistance training volume and increases in muscle mass. '
      + 'Journal of Sports Sciences, 35(11), 1073–1082.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/',
    claim: 'L’hypertrophie croît avec le nombre de séries hebdomadaires par muscle, '
      + '≈ +0,37 % par série supplémentaire ; ≥ 10 séries donne le meilleur effet observé.',
  },
  schoenfeld2016frequency: {
    citation: 'Schoenfeld BJ, Ogborn D, Krieger JW (2016). Effects of resistance training '
      + 'frequency on measures of muscle hypertrophy: a systematic review and '
      + 'meta-analysis. Sports Medicine, 46(11), 1689–1697.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/',
    claim: 'À volume hebdomadaire égal, répartir sur ≥ 2 séances par muscle fait mieux '
      + 'que tout concentrer sur une.',
  },
  maeo2023triceps: {
    citation: 'Maeo S, Wu Y, Huang M, et al. (2023). Triceps brachii hypertrophy is '
      + 'substantially greater after elbow extension training performed in the overhead '
      + 'versus neutral arm position. European Journal of Sport Science, 23(7), 1240–1250.',
    url: 'https://doi.org/10.1080/17461391.2022.2100279',
    claim: 'Extensions de coude bras au-dessus de la tête plutôt que le long du corps : '
      + 'croissance nettement supérieure du triceps, surtout de son chef long.',
  },
  maeo2021hamstrings: {
    citation: 'Maeo S, Huang M, Wu Y, et al. (2021). Greater hamstrings muscle hypertrophy '
      + 'but similar damage protection after training at long versus short muscle lengths. '
      + 'Medicine & Science in Sports & Exercise, 53(4), 825–837.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33009197/',
    claim: 'Leg curl assis (hanche fléchie, ischio-jambiers allongés) contre allongé : '
      + '+14,1 % contre +9,3 % de section musculaire sur 12 semaines.',
  },
  plotkin2023glutes: {
    citation: 'Plotkin D, Rodas M, Vigotsky A, et al. (2023). Hip thrust and back squat '
      + 'training elicit similar gluteus muscle hypertrophy and transfer similarly to the '
      + 'deadlift. Frontiers in Physiology, 14, 1279170.',
    url: 'https://doi.org/10.3389/fphys.2023.1279170',
    claim: 'Hip thrust et squat produisent une hypertrophie fessière comparable ; le squat '
      + 'ajoute la cuisse. L’activation électromyographique supérieure du hip thrust ne '
      + 'préjugeait pas de la croissance.',
  },
  kassiano2026quads: {
    citation: 'Kassiano W, Costa B, Kunevaliki G, et al. (2026). Comparison of muscle '
      + 'hypertrophy and strength adaptations induced by back squat and leg extension '
      + 'resistance exercises. Journal of Strength and Conditioning Research, 40(4), 367–376.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41379528/',
    claim: 'Leg extension contre squat : croissance du droit fémoral supérieure sur les '
      + 'trois portions mesurées (proximale +11,4 % contre +2,0 %).',
  },
  zabaleta2021quads: {
    citation: 'Zabaleta-Korta A, Fernández-Peña E, Torres-Unda J, et al. (2021). The role '
      + 'of exercise selection in regional muscle hypertrophy: a randomized controlled '
      + 'trial. Journal of Sports Sciences.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34121615/',
    claim: 'Le squat fait croître le vaste latéral en sa portion centrale ; le leg '
      + 'extension fait croître le droit fémoral sur toute sa longueur.',
  },
  lengthened2025: {
    citation: 'Lengthened partial repetitions elicit similar muscular adaptations as full '
      + 'range of motion repetitions during resistance training in trained individuals '
      + '(2025). PeerJ, 13, e18904.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39959841/',
    claim: 'Travailler un muscle en position allongée vaut au moins l’amplitude complète, '
      + 'et fait mieux que le travail en position courte.',
  },
  wilson2012concurrent: {
    citation: 'Wilson JM, Marin PJ, Rhea MR, et al. (2012). Concurrent training: a '
      + 'meta-analysis examining interference of aerobic and resistance exercises. '
      + 'Journal of Strength and Conditioning Research, 26(8), 2293–2307.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22002517/',
    claim: 'L’interférence de l’endurance sur la force dépend de la modalité, de la '
      + 'fréquence et de la durée : la course pénalise force et hypertrophie, le vélo non.',
  },
  seilerPolarized: {
    citation: 'Seiler S (2010). What is best practice for training intensity and duration '
      + 'distribution in endurance athletes ? International Journal of Sports Physiology '
      + 'and Performance, 5(3), 276–291.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20861519/',
    claim: 'Les athlètes d’endurance placent ≈ 80 % de leur volume à basse intensité et '
      + '15–20 % à haute intensité, avec très peu entre les deux.',
  },
  stretching2024dose: {
    citation: 'Optimising the dose of static stretching to improve flexibility: a '
      + 'systematic review, meta-analysis and multivariate meta-regression (2024). '
      + 'Sports Medicine.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39614059/',
    claim: 'Environ 10 minutes d’étirement statique par groupe musculaire et par semaine '
      + 'suffisent ; au-delà de 4 min par séance, aucun bénéfice supplémentaire observé.',
  },
  progression2022: {
    citation: 'Progressive overload without progressing load? The effects of load or '
      + 'repetition progression on muscular adaptations (2022). PeerJ, 10, e14142.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9528903/',
    claim: 'Progresser en répétitions ou en charge donne des adaptations comparables : '
      + 'ce qui compte est qu’il y ait progression, pas laquelle.',
  },
};

// ---------------------------------------------------------------------
// Paliers
//
// La question à laquelle chaque palier répond n'est pas « cet exercice
// est-il bon ? » mais « mérite-t-il une place dans une séance, sachant
// que le temps est la ressource rare ? ».
// ---------------------------------------------------------------------

export const TIERS = {
  fondamental: {
    label: 'Fondamental',
    order: 1,
    criteria: 'Polyarticulaire, charge une grande masse musculaire, et se surcharge de '
      + 'façon mesurable sur des années. C’est le mouvement qui mérite sa place dans '
      + 'presque tout programme, et le seul pour lequel une table de force permet de se situer.',
  },
  complement: {
    label: 'Complément ciblé',
    order: 2,
    criteria: 'Retenu parce qu’il couvre ce que les fondamentaux laissent de côté, ou '
      + 'parce qu’un essai contrôlé le montre supérieur à une variante plus répandue. '
      + 'Il ne remplace pas un fondamental, il comble un trou identifié.',
  },
  accessoire: {
    label: 'Accessoire',
    order: 3,
    criteria: 'Utilisable, mais redondant avec un mouvement mieux classé, ou soutenu par '
      + 'peu de données directes. À placer en fin de séance, jamais à la place du reste.',
  },
};

/** Ce que veut dire l'absence de palier — affiché tel quel dans l'interface. */
export const UNRATED_NOTE = 'Non classé : présent dans le catalogue, mais redondant avec '
  + 'un mouvement mieux documenté ou trop spécifique pour être recommandé par défaut. '
  + 'Ce n’est pas un jugement de qualité.';

// ---------------------------------------------------------------------
// Patrons de mouvement
//
// Un programme se raisonne en patrons, pas en exercices : « un tirage
// vertical » survit à un changement de salle, « traction à la barre
// fixe » non. C'est ce qui permet à un même modèle de s'instancier en
// salle complète, avec deux haltères, ou à mains nues.
// ---------------------------------------------------------------------

/**
 * Groupes musculaires, unité réelle de la dose-réponse.
 *
 * Les repères de volume (10 séries pour progresser, 22 au plafond) sont
 * établis PAR MUSCLE. Les compter par axe les fausserait : « poussée »
 * mélange pectoraux, deltoïdes et triceps, et trois exercices de
 * poussée ne chargent pas trois fois le même muscle.
 */
export const MUSCLE_GROUPS = {
  pectoraux:   'Pectoraux',
  deltoides:   'Deltoïdes',
  triceps:     'Triceps',
  dorsaux:     'Dos (dorsaux)',
  trapezes:    'Trapèzes',
  biceps:      'Biceps',
  quadriceps:  'Quadriceps',
  ischio:      'Ischio-jambiers',
  fessiers:    'Fessiers',
  mollets:     'Mollets',
  tronc:       'Tronc',
};

/**
 * Part d'une série comptée pour un muscle travaillé en second.
 *
 * Même pondération que la vue `muscle_load_recent` du schéma : le
 * backend et les requêtes analytiques doivent compter pareil, sinon le
 * volume affiché par un programme contredit la carte de fatigue.
 */
export const SECONDARY_WEIGHT = 0.4;

export const MOVEMENT_PATTERNS = {
  squat:              { label: 'Squat (genou dominant)',       axis: 'legs',        compound: true,  group: 'Bas du corps',
    primary: ['quadriceps', 'fessiers'], secondary: ['ischio', 'tronc'] },
  hinge:              { label: 'Charnière de hanche',          axis: 'legs',        compound: true,  group: 'Bas du corps',
    primary: ['ischio', 'fessiers'],     secondary: ['dorsaux', 'tronc'] },
  lunge:              { label: 'Fente / unilatéral',           axis: 'legs',        compound: true,  group: 'Bas du corps',
    primary: ['quadriceps', 'fessiers'], secondary: ['ischio'] },
  hip_extension:      { label: 'Extension de hanche',          axis: 'legs',        compound: true,  group: 'Bas du corps',
    primary: ['fessiers'],               secondary: ['ischio'] },
  knee_flexion:       { label: 'Flexion de genou',             axis: 'legs',        compound: false, group: 'Bas du corps',
    primary: ['ischio'],                 secondary: [] },
  knee_extension:     { label: 'Extension de genou',           axis: 'legs',        compound: false, group: 'Bas du corps',
    primary: ['quadriceps'],             secondary: [] },
  calf:               { label: 'Mollets',                      axis: 'legs',        compound: false, group: 'Bas du corps',
    primary: ['mollets'],                secondary: [] },
  hip_abduction:      { label: 'Abduction de hanche',          axis: 'legs',        compound: false, group: 'Bas du corps',
    primary: ['fessiers'],               secondary: [] },
  horizontal_push:    { label: 'Poussée horizontale',          axis: 'push',        compound: true,  group: 'Haut du corps',
    primary: ['pectoraux'],              secondary: ['triceps', 'deltoides'] },
  vertical_push:      { label: 'Poussée verticale',            axis: 'push',        compound: true,  group: 'Haut du corps',
    primary: ['deltoides'],              secondary: ['triceps'] },
  horizontal_pull:    { label: 'Tirage horizontal',            axis: 'pull',        compound: true,  group: 'Haut du corps',
    primary: ['dorsaux'],                secondary: ['biceps', 'trapezes'] },
  vertical_pull:      { label: 'Tirage vertical',              axis: 'pull',        compound: true,  group: 'Haut du corps',
    primary: ['dorsaux'],                secondary: ['biceps'] },
  shoulder_extension: { label: 'Extension d’épaule (pull-over)', axis: 'pull',      compound: false, group: 'Haut du corps',
    primary: ['dorsaux'],                secondary: [] },
  chest_isolation:    { label: 'Écarté (pectoraux)',           axis: 'push',        compound: false, group: 'Haut du corps',
    primary: ['pectoraux'],              secondary: [] },
  shoulder_abduction: { label: 'Élévation latérale',           axis: 'push',        compound: false, group: 'Haut du corps',
    primary: ['deltoides'],              secondary: [] },
  rear_delt:          { label: 'Deltoïde postérieur',          axis: 'pull',        compound: false, group: 'Haut du corps',
    primary: ['deltoides'],              secondary: ['trapezes'] },
  elbow_flexion:      { label: 'Flexion de coude (biceps)',    axis: 'pull',        compound: false, group: 'Bras',
    primary: ['biceps'],                 secondary: [] },
  elbow_extension:    { label: 'Extension de coude (triceps)', axis: 'push',        compound: false, group: 'Bras',
    primary: ['triceps'],                secondary: [] },
  trap:               { label: 'Trapèzes (haussement)',        axis: 'pull',        compound: false, group: 'Haut du corps',
    primary: ['trapezes'],               secondary: [] },
  core_antiextension: { label: 'Gainage anti-extension',       axis: 'core',        compound: false, group: 'Tronc',
    primary: ['tronc'],                  secondary: [] },
  core_flexion:       { label: 'Flexion du tronc',             axis: 'core',        compound: false, group: 'Tronc',
    primary: ['tronc'],                  secondary: [] },
  core_antirotation:  { label: 'Gainage anti-rotation',        axis: 'core',        compound: false, group: 'Tronc',
    primary: ['tronc'],                  secondary: [] },
  carry:              { label: 'Port de charge',               axis: 'core',        compound: true,  group: 'Tronc',
    primary: ['tronc'],                  secondary: ['trapezes'] },
  // Endurance et amplitude ne relèvent pas de la dose-réponse en séries
  // par muscle : aucun groupe ne leur est rattaché, et le calcul de
  // volume les écarte explicitement plutôt que de les compter à tort.
  cardio:             { label: 'Endurance continue',           axis: 'endurance',   compound: true,  group: 'Endurance',
    primary: [],                         secondary: [] },
  cardio_interval:    { label: 'Fractionné',                   axis: 'endurance',   compound: true,  group: 'Endurance',
    primary: [],                         secondary: [] },
  mobility:           { label: 'Mobilité (amplitude active)',  axis: 'mobility',    compound: false, group: 'Amplitude',
    primary: [],                         secondary: [] },
  flexibility:        { label: 'Souplesse (étirement tenu)',   axis: 'flexibility', compound: false, group: 'Amplitude',
    primary: [],                         secondary: [] },
};

export const PATTERN_KEYS = Object.keys(MOVEMENT_PATTERNS);

// ---------------------------------------------------------------------
// Le noyau curé
//
// `id` est l'identifiant du dataset (`external_id` en base) : stable,
// indépendant de la traduction française et des collisions de slug.
// `rank` ordonne les choix à l'intérieur d'un patron — c'est lui que les
// modèles de programme suivent pour résoudre « un tirage vertical ».
// ---------------------------------------------------------------------

const e = (id, pattern, tier, rank, note = null, refs = []) => ({
  id, pattern, tier, rank, note, refs,
});

export const CURATED = [
  // --- Squat ------------------------------------------------------------
  e('0043', 'squat', 'fondamental', 1,
    'La référence du genou dominant : amplitude complète, charge lourde, et des tables '
    + 'de force publiées qui permettent de se situer.'),
  e('0042', 'squat', 'fondamental', 2,
    'Barre devant : buste plus vertical, davantage de quadriceps et moins de bras de '
    + 'levier sur le bas du dos à charge égale.'),
  e('0739', 'squat', 'fondamental', 3,
    'Presse à cuisses : la charge progresse sans exigence d’équilibre ni de mobilité de '
    + 'cheville. C’est le fondamental du bas du corps le plus accessible.'),
  e('1760', 'squat', 'complement', 4,
    'Charge tenue devant la poitrine : excellent pour apprendre la position, mais la '
    + 'charge maximale reste limitée par la prise.'),
  e('0743', 'squat', 'complement', 5,
    'Hack squat guidé : trajectoire imposée, quadriceps chargés avec le dos soutenu.'),
  e('0755', 'squat', 'accessoire', 6),

  // --- Charnière de hanche ---------------------------------------------
  e('0032', 'hinge', 'fondamental', 1,
    'Le mouvement qui met le plus de masse musculaire sous charge en une fois. Coûteux '
    + 'en récupération : il se programme, il ne s’empile pas.',
    ['schoenfeld2017volume']),
  e('0085', 'hinge', 'fondamental', 2,
    'Genoux peu fléchis, bassin qui recule : les ischio-jambiers y travaillent en '
    + 'position allongée, celle qui produit le plus de croissance.',
    ['lengthened2025', 'maeo2021hamstrings']),
  e('0811', 'hinge', 'fondamental', 3,
    'Poignées sur les côtés : dos moins incliné et technique plus tolérante, pour une '
    + 'charge comparable au soulevé classique.'),
  e('1459', 'hinge', 'complement', 4,
    'Version haltères du soulevé de terre roumain : amplitude libre, charge plus modeste.'),
  e('0549', 'hinge', 'complement', 5,
    'Charnière explosive : la hanche produit la force, les bras ne font que suivre.'),
  e('0044', 'hinge', 'accessoire', 6),
  e('0196', 'hinge', 'accessoire', 7),

  // --- Fente / unilatéral -----------------------------------------------
  e('0410', 'lunge', 'fondamental', 1,
    'Fente bulgare : une jambe à la fois, grande amplitude de hanche, et la charge '
    + 'nécessaire reste modeste — la jambe d’appui fait le travail de deux.'),
  e('1460', 'lunge', 'complement', 2),
  e('0431', 'lunge', 'complement', 3,
    'Montée sur banc : pas de phase excentrique imposée, donc peu de courbatures. Utile '
    + 'quand la récupération est déjà sollicitée ailleurs.'),
  e('0336', 'lunge', 'complement', 4),
  e('3470', 'lunge', 'complement', 5,
    'Fente au poids de corps : le point d’entrée quand aucune charge n’est disponible.'),
  e('0114', 'lunge', 'accessoire', 6),

  // --- Extension de hanche ---------------------------------------------
  e('1409', 'hip_extension', 'fondamental', 1,
    'Pont fessier chargé. Le hip thrust à la barre, absent du dataset, en est la variante '
    + 'sur banc : les deux produisent une hypertrophie fessière comparable au squat, avec '
    + 'moins de sollicitation du quadriceps.',
    ['plotkin2023glutes']),
  e('0489', 'hip_extension', 'complement', 2,
    'Extension lombaire au poids de corps : chaîne postérieure chargée sans contrainte '
    + 'de prise ni de matériel.'),
  e('0573', 'hip_extension', 'complement', 3),
  e('3013', 'hip_extension', 'accessoire', 4),
  e('0593', 'hip_extension', 'accessoire', 5),

  // --- Flexion de genou --------------------------------------------------
  e('0599', 'knee_flexion', 'complement', 1,
    'Leg curl ASSIS : hanche fléchie, donc ischio-jambiers biarticulaires plus allongés. '
    + 'Sur 12 semaines à volume identique, +14,1 % de section contre +9,3 % pour la '
    + 'version allongée. La même charge, mieux placée.',
    ['maeo2021hamstrings']),
  e('0586', 'knee_flexion', 'complement', 2,
    'Leg curl allongé : efficace, mais la hanche étendue raccourcit les ischio-jambiers. '
    + 'À choisir seulement si la machine assise manque.',
    ['maeo2021hamstrings']),
  e('0496', 'knee_flexion', 'complement', 3,
    'Leg curl inversé (nordique) : phase excentrique très chargée au poids de corps, sans '
    + 'aucune machine.'),
  e('0582', 'knee_flexion', 'accessoire', 4),

  // --- Extension de genou ------------------------------------------------
  e('0585', 'knee_extension', 'complement', 1,
    'Le droit fémoral est le seul chef biarticulaire du quadriceps, et le squat le '
    + 'sollicite peu : +2,0 % en portion proximale contre +11,4 % au leg extension. Ce '
    + 'n’est pas une redite du squat, c’est ce qu’il laisse de côté.',
    ['kassiano2026quads', 'zabaleta2021quads']),
  e('3007', 'knee_extension', 'accessoire', 2),

  // --- Mollets -----------------------------------------------------------
  e('0594', 'calf', 'complement', 1,
    'Genou fléchi : le gastrocnémien passe en position courte et le soléaire prend le '
    + 'relais. C’est la seule façon de le charger réellement.'),
  e('1372', 'calf', 'complement', 2,
    'Genou tendu : gastrocnémien chargé sur toute son amplitude.'),
  e('1391', 'calf', 'complement', 3),
  e('0417', 'calf', 'complement', 4),
  e('1373', 'calf', 'accessoire', 5),

  e('0597', 'hip_abduction', 'accessoire', 1),

  // --- Poussée horizontale ----------------------------------------------
  e('0025', 'horizontal_push', 'fondamental', 1,
    'Développé couché : charge maximale du haut du corps, et le mouvement de poussée le '
    + 'mieux documenté qui soit.'),
  e('0047', 'horizontal_push', 'fondamental', 2,
    'Plan incliné : sollicite davantage le faisceau claviculaire du pectoral, celui que '
    + 'le développé plat atteint le moins.'),
  e('0289', 'horizontal_push', 'fondamental', 3,
    'Haltères : amplitude plus grande en position basse, et chaque bras porte sa propre '
    + 'charge — aucun côté ne compense l’autre.',
    ['lengthened2025']),
  e('0314', 'horizontal_push', 'fondamental', 4),
  e('0251', 'horizontal_push', 'fondamental', 5,
    'Dips poitrine : poids de corps, lestable sans limite, et amplitude profonde. Le '
    + 'fondamental de poussée qui ne demande qu’une barre parallèle.'),
  e('0662', 'horizontal_push', 'fondamental', 6,
    'Pompes : aucun matériel, progression par l’inclinaison puis par le lest. Le point '
    + 'd’entrée de toute poussée.'),
  e('0030', 'horizontal_push', 'complement', 7,
    'Prise serrée : la poussée devient à dominante triceps.'),
  e('0577', 'horizontal_push', 'complement', 8),
  e('1299', 'horizontal_push', 'complement', 9),
  e('0493', 'horizontal_push', 'accessoire', 10,
    'Pompes inclinées : la régression à utiliser tant que la pompe au sol n’est pas tenue.'),
  e('0279', 'horizontal_push', 'accessoire', 11),

  // --- Poussée verticale --------------------------------------------------
  e('0426', 'vertical_push', 'fondamental', 1,
    'Développé debout : épaules chargées, tronc obligé de tenir la position. Rien ne '
    + 'soutient le buste, donc rien ne triche.'),
  e('0091', 'vertical_push', 'fondamental', 2,
    'Développé assis à la barre : le dossier permet une charge plus lourde que debout.'),
  e('0405', 'vertical_push', 'fondamental', 3),
  e('0774', 'vertical_push', 'complement', 4),
  e('0603', 'vertical_push', 'complement', 5),
  e('0471', 'vertical_push', 'accessoire', 6,
    'Pompes en équilibre : exigeant, spectaculaire, mais la charge n’y est pas réglable.'),
  e('0086', 'vertical_push', 'accessoire', 7,
    'Derrière la nuque : exige une amplitude d’épaule que peu possèdent, sans avantage '
    + 'démontré sur la version devant. Rien n’oblige à passer par là.'),

  // --- Tirage vertical ----------------------------------------------------
  e('0652', 'vertical_pull', 'fondamental', 1,
    'Traction pronation : le tirage vertical de référence, lestable indéfiniment.'),
  e('1326', 'vertical_pull', 'fondamental', 2,
    'Traction supination : mêmes dorsaux, biceps nettement plus sollicités. Souvent la '
    + 'première traction tenue.'),
  e('0198', 'vertical_pull', 'fondamental', 3,
    'Tirage vertical à la poulie : le seul tirage vertical dont on peut descendre la '
    + 'charge SOUS le poids de corps, et donc le seul qui permette de commencer à zéro.'),
  e('0841', 'vertical_pull', 'complement', 4),
  e('0017', 'vertical_pull', 'complement', 5,
    'Traction assistée : la machine retire une part du poids de corps, réduite au fil '
    + 'des semaines.'),
  e('0245', 'vertical_pull', 'complement', 6),
  e('1429', 'vertical_pull', 'complement', 7),
  e('1325', 'vertical_pull', 'accessoire', 8,
    'Derrière la nuque : même réserve que le développé — amplitude d’épaule exigeante, '
    + 'sans bénéfice établi sur la version devant.'),

  // --- Tirage horizontal --------------------------------------------------
  e('0027', 'horizontal_pull', 'fondamental', 1,
    'Rowing barre buste penché : le tirage horizontal le plus chargeable, au prix d’un '
    + 'maintien lombaire isométrique.'),
  e('0180', 'horizontal_pull', 'fondamental', 2,
    'Tirage assis à la poulie : dos soutenu, tension constante, charge réglable finement. '
    + 'Le tirage horizontal le plus simple à doser.'),
  e('3017', 'horizontal_pull', 'complement', 3,
    'Rowing Pendlay : chaque répétition repart du sol, donc sans rebond ni élan.'),
  e('1350', 'horizontal_pull', 'complement', 4),
  e('0541', 'horizontal_pull', 'complement', 5,
    'Rowing à un bras : amplitude plus grande et déséquilibres droite/gauche visibles.'),
  e('3166', 'horizontal_pull', 'complement', 6,
    'Tirage horizontal au poids de corps : l’équivalent de la pompe côté tirage, réglable '
    + 'par l’inclinaison.'),
  e('0189', 'horizontal_pull', 'accessoire', 7),
  e('1349', 'horizontal_pull', 'accessoire', 8),

  // --- Extension d'épaule (pull-over) -------------------------------------
  e('0375', 'shoulder_extension', 'complement', 1,
    'Pull-over : dorsaux chargés en position allongée, sans passer par la flexion du coude.'),
  e('2285', 'shoulder_extension', 'complement', 2),
  e('0238', 'shoulder_extension', 'accessoire', 3),

  // --- Écarté --------------------------------------------------------------
  e('0171', 'chest_isolation', 'complement', 1,
    'Écarté incliné à la poulie : tension maintenue en position allongée, là où l’haltère '
    + 'n’en produit plus.',
    ['lengthened2025']),
  e('0188', 'chest_isolation', 'complement', 2),
  e('0319', 'chest_isolation', 'complement', 3),
  e('0308', 'chest_isolation', 'accessoire', 4,
    'Écarté haltères à plat : la résistance disparaît en haut du mouvement, où les bras '
    + 'sont à la verticale.'),

  // --- Élévation latérale ---------------------------------------------------
  e('0178', 'shoulder_abduction', 'complement', 1,
    'Poulie : tension présente dès le bas du mouvement, là où l’haltère n’en produit '
    + 'aucune. Le deltoïde moyen n’est atteint par aucun mouvement de poussée.'),
  e('0334', 'shoulder_abduction', 'complement', 2),
  e('0584', 'shoulder_abduction', 'complement', 3),
  e('0396', 'shoulder_abduction', 'accessoire', 4),
  e('0120', 'shoulder_abduction', 'accessoire', 5,
    'Rowing menton : pincement possible de l’épaule en prise serrée, pour un résultat que '
    + 'l’élévation latérale obtient sans ce risque.'),

  // --- Deltoïde postérieur --------------------------------------------------
  e('0383', 'rear_delt', 'complement', 1,
    'Le faisceau postérieur du deltoïde n’est travaillé ni par les poussées ni pleinement '
    + 'par les tirages : il lui faut son propre mouvement.'),
  e('0602', 'rear_delt', 'complement', 2),
  e('0203', 'rear_delt', 'complement', 3),
  e('0993', 'rear_delt', 'accessoire', 4),

  // --- Biceps ----------------------------------------------------------------
  e('0318', 'elbow_flexion', 'complement', 1,
    'Curl incliné : bras derrière le tronc, donc chef long du biceps étiré. Le travail en '
    + 'position allongée fait au moins aussi bien que l’amplitude complète, et mieux que '
    + 'le travail en position courte.',
    ['lengthened2025']),
  e('0294', 'elbow_flexion', 'complement', 2),
  e('0313', 'elbow_flexion', 'complement', 3,
    'Prise marteau : charge le brachial et le brachio-radial, que la prise supination '
    + 'sollicite peu.'),
  e('0165', 'elbow_flexion', 'accessoire', 4),
  e('0070', 'elbow_flexion', 'accessoire', 5,
    'Pupitre : la résistance est maximale en position courte, l’inverse de ce que la '
    + 'littérature sur la longueur musculaire suggère de privilégier.',
    ['lengthened2025']),
  e('0592', 'elbow_flexion', 'accessoire', 6),

  // --- Triceps ----------------------------------------------------------------
  e('0194', 'elbow_extension', 'complement', 1,
    'Extension au-dessus de la tête : le chef long du triceps croise l’épaule, il n’est '
    + 'donc étiré que bras levé. Croissance nettement supérieure à la version bras le '
    + 'long du corps, à charge et volume identiques.',
    ['maeo2023triceps']),
  e('0092', 'elbow_extension', 'complement', 2,
    'Même position haute, à la barre : la charge se suit plus facilement qu’à la poulie.',
    ['maeo2023triceps']),
  e('0060', 'elbow_extension', 'complement', 3,
    'Barre au front : bras à mi-chemin entre la verticale et le corps, donc chef long '
    + 'partiellement étiré.'),
  e('0814', 'elbow_extension', 'complement', 4),
  e('0201', 'elbow_extension', 'accessoire', 5,
    'Extension à la poulie haute, bras le long du corps : c’est exactement la position '
    + 'qui a le moins fait croître le triceps dans l’essai de référence.',
    ['maeo2023triceps']),
  e('0200', 'elbow_extension', 'accessoire', 6),
  e('0283', 'elbow_extension', 'accessoire', 7),

  e('0095', 'trap', 'accessoire', 1),
  e('0406', 'trap', 'accessoire', 2),

  // --- Tronc --------------------------------------------------------------------
  e('2135', 'core_antiextension', 'complement', 1,
    'Gainage face au sol : le rôle premier des abdominaux est d’empêcher le bassin de '
    + 'basculer, pas de plier le tronc. Le lest est optionnel.'),
  e('0276', 'core_antiextension', 'complement', 2),
  e('3665', 'core_antiextension', 'accessoire', 3),
  e('0472', 'core_flexion', 'complement', 1,
    'Relevé de jambes suspendu : amplitude complète et charge progressive par la position '
    + 'des jambes.'),
  e('0175', 'core_flexion', 'complement', 2,
    'Crunch à la poulie : le seul travail de flexion du tronc dont la charge se chiffre.'),
  e('0011', 'core_flexion', 'accessoire', 3),
  e('0274', 'core_flexion', 'accessoire', 4),
  e('0979', 'core_antirotation', 'complement', 1,
    'Pallof press : résister à la rotation, ce qu’aucun crunch ne travaille.'),
  e('1015', 'core_antirotation', 'accessoire', 2),
  e('0687', 'core_antirotation', 'accessoire', 3),
  e('2133', 'carry', 'complement', 1,
    'Port de charge : gainage, prise et trapèzes chargés simultanément, en marchant.'),
  e('3548', 'carry', 'accessoire', 2),

  // --- Endurance continue ------------------------------------------------------------
  //
  // L'ordre n'est pas anodin : l'interférence de l'endurance sur la
  // force dépend de la MODALITÉ. La course pénalise l'hypertrophie et
  // la force, le vélo non. Qui entretient sa masse musculaire en
  // parallèle a donc intérêt à commencer par le bas de cette liste.
  e('2138', 'cardio', 'complement', 1,
    'Vélo : intensité finement réglable, aucun impact articulaire, et la modalité qui '
    + 'interfère le moins avec les adaptations de force.',
    ['who2020', 'wilson2012concurrent']),
  e('2331', 'cardio', 'complement', 2,
    'Elliptique : effort porté, sollicitation des bras en plus, impact nul.',
    ['who2020', 'wilson2012concurrent']),
  e('3666', 'cardio', 'complement', 3,
    'Marche en pente : c’est la façon la plus simple de tenir une intensité modérée '
    + 'longtemps — celle sur laquelle porte l’essentiel du volume d’endurance.',
    ['who2020', 'seilerPolarized']),
  e('2311', 'cardio', 'complement', 4, null, ['who2020']),
  e('0685', 'cardio', 'complement', 5,
    'Course à pied : la modalité la plus efficace pour la capacité aérobie, mais la '
    + 'seule dont l’essai de référence montre qu’elle ampute les gains de force et '
    + 'd’hypertrophie lorsqu’elle est cumulée.',
    ['who2020', 'wilson2012concurrent']),
  e('2612', 'cardio', 'complement', 6,
    'Corde à sauter : densité élevée, encombrement nul, impact important.',
    ['who2020']),
  e('0798', 'cardio', 'accessoire', 7),
  e('2141', 'cardio', 'accessoire', 8),

  // --- Fractionné ---------------------------------------------------------------------
  //
  // Un modèle polarisé place 15 à 20 % du volume ici, et le reste en
  // continu. C'est la proportion, pas la présence d'intervalles, qui
  // distingue une préparation d'un empilement de séances dures.
  e('1160', 'cardio_interval', 'complement', 1,
    'Burpee : sollicite tout le corps, aucun matériel, intensité maximale atteinte en '
    + 'quelques répétitions.',
    ['seilerPolarized']),
  e('3361', 'cardio_interval', 'complement', 2,
    'Bonds latéraux : intervalle avec changement de direction, utile là où la course '
    + 'seule ne travaille qu’un plan.'),
  e('3636', 'cardio_interval', 'complement', 3, null, ['seilerPolarized']),
  e('0630', 'cardio_interval', 'complement', 4),
  e('3360', 'cardio_interval', 'accessoire', 5),
  e('3224', 'cardio_interval', 'accessoire', 6),

  // --- Mobilité (amplitude active) --------------------------------------------------
  e('1604', 'mobility', 'complement', 1,
    'Amplitude active sur hanche, cheville et tronc en un seul passage.'),
  e('1368', 'mobility', 'complement', 2),
  e('0688', 'mobility', 'complement', 3,
    'Traction scapulaire : contrôle actif de l’omoplate, préalable à tout tirage vertical.'),
  e('1167', 'mobility', 'complement', 4),
  e('2329', 'mobility', 'complement', 5),
  e('3012', 'mobility', 'complement', 6,
    'Dips scapulaires : contrôle actif de la ceinture scapulaire en appui, préalable aux '
    + 'dips et aux poussées verticales.'),
  e('1428', 'mobility', 'accessoire', 7),
  e('0257', 'mobility', 'accessoire', 8),

  // --- Souplesse (étirement tenu) ----------------------------------------------------
  // Le dosage compte plus que la variété : ≈ 10 min par groupe musculaire
  // et par semaine, sans bénéfice au-delà de 4 min par séance. Les
  // entrées ci-dessous couvrent les groupes, elles ne s'empilent pas.
  e('1511', 'flexibility', 'complement', 1, null, ['stretching2024dose']),
  e('1564', 'flexibility', 'complement', 2),
  e('1271', 'flexibility', 'complement', 3),
  e('1424', 'flexibility', 'complement', 4),
  e('1377', 'flexibility', 'complement', 5),
  e('1346', 'flexibility', 'complement', 6),
  e('1363', 'flexibility', 'complement', 7),
  e('1405', 'flexibility', 'complement', 8, null, ['stretching2024dose']),
  e('1512', 'flexibility', 'accessoire', 9),
];

// ---------------------------------------------------------------------
// Index dérivés
// ---------------------------------------------------------------------

export const CURATED_BY_ID = new Map(CURATED.map((x) => [x.id, x]));

/** Les exercices d'un patron, du mieux classé au moins bien. */
export function byPattern(pattern) {
  return CURATED
    .filter((x) => x.pattern === pattern)
    .sort((a, b) => a.rank - b.rank);
}

/** Le patron est-il polyarticulaire ? (pilote la colonne `is_compound`) */
export const isCompound = (pattern) => MOVEMENT_PATTERNS[pattern]?.compound ?? false;

/** Références complètes d'une entrée, prêtes à être stockées en JSONB. */
export function resolveRefs(refs) {
  return refs
    .map((key) => (REFERENCES[key] ? { key, ...REFERENCES[key] } : null))
    .filter(Boolean);
}

/** Décompte par palier — sert aux tests et à l'affichage du catalogue. */
export function curationStats() {
  const byTier = {};
  const byPatternCount = {};
  for (const x of CURATED) {
    byTier[x.tier] = (byTier[x.tier] ?? 0) + 1;
    byPatternCount[x.pattern] = (byPatternCount[x.pattern] ?? 0) + 1;
  }
  return { total: CURATED.length, byTier, byPattern: byPatternCount };
}
