// Traduction FR des noms d'exercices.
//
// Le dataset fournit les instructions en 10 langues (dont le français)
// mais le champ `name` reste anglais. On traduit donc au niveau du
// lexique : le vocabulaire de la salle est petit et très répétitif
// (537 tokens distincts sur 1324 exercices, dont 230 apparaissent 3 fois
// ou plus). Une table de correspondance couvre l'essentiel avec un rendu
// déterministe — préférable à une traduction automatique qui rendrait
// « curl » par « boucle » ou « press » par « presse à imprimer ».

/** Expressions multi-mots, appliquées avant le découpage en tokens. */
const PHRASES = [
  ['body weight', 'poids de corps'],
  ['bodyweight', 'poids de corps'],
  ['ez barbell', 'barre EZ'],
  ['olympic barbell', 'barre olympique'],
  ['smith machine', 'smith machine'],
  ['leverage machine', 'machine à levier'],
  ['sled machine', 'traîneau'],
  ['stability ball', 'swiss ball'],
  ['bosu ball', 'bosu'],
  ['medicine ball', 'medicine ball'],
  ['wheel roller', 'roue abdominale'],
  ['ab wheel', 'roue abdominale'],
  ['resistance band', 'élastique'],
  ['upper body ergometer', 'ergomètre bras'],
  ['stepmill machine', 'escalier mécanique'],
  ['elliptical machine', 'vélo elliptique'],
  ['stationary bike', 'vélo stationnaire'],
  ['skierg machine', 'skierg'],
  ['trap bar', 'trap bar'],
  ['sit up', 'relevé de buste'],
  ['sit-up', 'relevé de buste'],
  ['push up', 'pompe'],
  ['push-up', 'pompe'],
  ['pull up', 'traction'],
  ['pull-up', 'traction'],
  ['chin up', 'traction supination'],
  ['chin-up', 'traction supination'],
  ['muscle up', 'muscle-up'],
  ['pull down', 'tirage vertical'],
  ['pulldown', 'tirage vertical'],
  ['push down', 'extension à la poulie'],
  ['pushdown', 'extension à la poulie'],
  ['upright row', 'rowing menton'],
  ['bent over', 'buste penché'],
  ['bent-over', 'buste penché'],
  ['close grip', 'prise serrée'],
  ['wide grip', 'prise large'],
  ['narrow grip', 'prise serrée'],
  ['reverse grip', 'prise inversée'],
  ['neutral grip', 'prise neutre'],
  ['hammer grip', 'prise marteau'],
  ['straight arm', 'bras tendus'],
  ['straight leg', 'jambes tendues'],
  ['single leg', 'unilatéral'],
  ['single arm', 'unilatéral'],
  ['one arm', 'un bras'],
  ['one leg', 'une jambe'],
  ['two arm', 'deux bras'],
  ['lateral raise', 'élévation latérale'],
  ['front raise', 'élévation frontale'],
  ['rear delt', 'deltoïde postérieur'],
  ['calf raise', 'extension mollets'],
  ['leg raise', 'relevé de jambes'],
  ['leg press', 'presse à cuisses'],
  ['leg curl', 'leg curl'],
  ['leg extension', 'leg extension'],
  ['hip thrust', 'hip thrust'],
  ['glute bridge', 'pont fessier'],
  ['good morning', 'good morning'],
  ['jump rope', 'corde à sauter'],
  ['box jump', 'saut sur box'],
  ['jumping jack', 'jumping jack'],
  ['mountain climber', 'grimpeur'],
  ['russian twist', 'russian twist'],
  ['face pull', 'face pull'],
  ['farmers walk', 'marche du fermier'],
  ["farmer's walk", 'marche du fermier'],
  ['military press', 'développé militaire'],
  ['overhead press', 'développé vertical'],
  ['bench press', 'développé couché'],
  ['incline bench', 'banc incliné'],
  ['decline bench', 'banc décliné'],
  ['preacher curl', 'curl pupitre'],
  ['concentration curl', 'curl concentré'],
  ['hammer curl', 'curl marteau'],
  ['wrist curl', 'curl poignets'],
  ['skull crusher', 'barre au front'],
  ['tricep dip', 'dips triceps'],
  ['triceps dip', 'dips triceps'],
  ['foam roll', 'auto-massage rouleau'],
  // Variantes trait d'union : le decoupage se fait sur les espaces, ces
  // formes doivent donc etre captees comme expressions entieres.
  ['reverse-grip', 'prise inversée'],
  ['close-grip', 'prise serrée'],
  ['wide-grip', 'prise large'],
  ['clean-grip', 'prise épaulé'],
  ['v-bar', 'barre en V'],
  ['exercise ball', 'swiss ball'],
  ['rope attachment', 'corde'],
  ['battling ropes', 'battle ropes'],
  ['battle ropes', 'battle ropes'],
];

/** Traduction mot à mot, appliquée après les expressions. */
const TOKENS = new Map(Object.entries({
  // Matériel
  dumbbell: 'haltères', dumbbells: 'haltères',
  barbell: 'barre', bar: 'barre', bars: 'barres',
  cable: 'poulie', cables: 'poulies',
  band: 'élastique', bands: 'élastiques',
  kettlebell: 'kettlebell', kettlebells: 'kettlebells',
  machine: 'machine', lever: 'machine à levier', leverage: 'machine à levier',
  smith: 'smith', sled: 'traîneau', rope: 'corde',
  ball: 'ballon', roller: 'rouleau', weighted: 'lesté',
  assisted: 'assisté', ez: 'EZ', olympic: 'olympique',
  hammer: 'marteau', tire: 'pneu', wheel: 'roue',
  stability: 'stability', medicine: 'medicine', bosu: 'bosu',
  resistance: 'élastique', suspension: 'sangles', trx: 'TRX',

  // Mouvements
  press: 'développé', curl: 'curl', curls: 'curls',
  row: 'rowing', rows: 'rowing', raise: 'élévation', raises: 'élévations',
  squat: 'squat', squats: 'squats', deadlift: 'soulevé de terre',
  lunge: 'fente', lunges: 'fentes', extension: 'extension', extensions: 'extensions',
  fly: 'écarté', flye: 'écarté', flyes: 'écartés', flys: 'écartés',
  pullover: 'pullover', shrug: 'haussement d’épaules', shrugs: 'haussements d’épaules',
  dip: 'dips', dips: 'dips', crunch: 'crunch', crunches: 'crunchs',
  twist: 'rotation', twisting: 'rotation', twists: 'rotations',
  plank: 'planche', bridge: 'pont', thrust: 'poussée',
  kickback: 'kickback', kickbacks: 'kickbacks',
  pull: 'tirage', push: 'poussée', jump: 'saut', jumps: 'sauts',
  run: 'course', running: 'course', walk: 'marche', walking: 'marche',
  step: 'step', clean: 'épaulé', jerk: 'jeté', snatch: 'arraché',
  swing: 'swing', swings: 'swings', throw: 'lancer',
  stretch: 'étirement', stretches: 'étirements', stretching: 'étirement',
  mobility: 'mobilité', rotation: 'rotation', circle: 'cercle', circles: 'cercles',
  hold: 'maintien', carry: 'port', drag: 'traction au sol',
  hyperextension: 'hyperextension',

  // Position / angle
  seated: 'assis', standing: 'debout', lying: 'allongé', prone: 'face contre sol',
  supine: 'sur le dos', kneeling: 'à genoux', bent: 'penché',
  incline: 'incliné', decline: 'décliné', flat: 'plat',
  overhead: 'au-dessus de la tête', behind: 'derrière', front: 'avant',
  side: 'latéral', lateral: 'latéral', rear: 'arrière', reverse: 'inversé',
  alternate: 'alterné', alternating: 'alterné', single: 'unilatéral',
  wide: 'large', close: 'serré', narrow: 'serré', neutral: 'neutre',
  straight: 'tendu', wall: 'mur', floor: 'sol', bench: 'banc',
  parallel: 'parallèle', high: 'haut', low: 'bas', middle: 'milieu',
  full: 'complet', half: 'demi', partial: 'partiel', deep: 'profond',
  cross: 'croisé', split: 'fendu', hanging: 'suspendu', vertical: 'vertical',
  horizontal: 'horizontal', diagonal: 'diagonal',

  // Anatomie
  chest: 'pectoraux', pectorals: 'pectoraux', pec: 'pectoraux',
  back: 'dos', lat: 'dorsaux', lats: 'dorsaux',
  shoulder: 'épaules', shoulders: 'épaules', delt: 'deltoïdes', delts: 'deltoïdes',
  deltoid: 'deltoïde', trap: 'trapèzes', traps: 'trapèzes',
  bicep: 'biceps', biceps: 'biceps', tricep: 'triceps', triceps: 'triceps',
  forearm: 'avant-bras', forearms: 'avant-bras', wrist: 'poignets',
  abs: 'abdominaux', abdominal: 'abdominal', abdominals: 'abdominaux',
  oblique: 'obliques', obliques: 'obliques', core: 'gainage',
  leg: 'jambe', legs: 'jambes', quad: 'quadriceps', quads: 'quadriceps',
  hamstring: 'ischio-jambiers', hamstrings: 'ischio-jambiers',
  glute: 'fessiers', glutes: 'fessiers', gluteus: 'fessier',
  calf: 'mollets', calves: 'mollets', calfs: 'mollets',
  hip: 'hanche', hips: 'hanches', thigh: 'cuisse', thighs: 'cuisses',
  knee: 'genou', knees: 'genoux', ankle: 'cheville', ankles: 'chevilles',
  neck: 'nuque', spine: 'colonne', head: 'tête', arm: 'bras', arms: 'bras',
  hand: 'main', hands: 'mains', foot: 'pied', feet: 'pieds',
  toe: 'pointe de pied', toes: 'pointes de pieds',
  adductor: 'adducteurs', adductors: 'adducteurs',
  abductor: 'abducteurs', abductors: 'abducteurs',
  piriformis: 'piriforme', quadriceps: 'quadriceps',
  serratus: 'dentelé', latissimus: 'grand dorsal', rectus: 'droit',
  femoris: 'fémoral', upper: 'haut', lower: 'bas', flexor: 'fléchisseur',
  flexors: 'fléchisseurs', extensor: 'extenseur', body: 'corps',

  // Divers
  with: 'avec', and: 'et', on: 'sur', to: 'à', the: '', of: 'de',
  in: 'en', for: 'pour', up: '', down: '', over: 'au-dessus',
  // Le dataset ecrit deja "(male)" entre parentheses : ne pas en rajouter.
  exercise: 'exercice', male: 'homme', female: 'femme',
  grip: 'prise', squatting: 'squat', palms: 'paumes', self: 'auto',
  attachment: '', stirrups: 'étriers', handle: 'poignée',
  one: 'un', two: 'deux', three: 'trois',
  blaster: 'blaster', preacher: 'pupitre', concentration: 'concentré',
  military: 'militaire', pike: 'pike', frog: 'grenouille',
  butterfly: 'papillon', spider: 'araignée', zottman: 'Zottman',
  arnold: 'Arnold', romanian: 'roumain', bulgarian: 'bulgare',
  sumo: 'sumo', hack: 'hack', pistol: 'pistol', cossack: 'cosaque',
  burpee: 'burpee', burpees: 'burpees', plyometric: 'pliométrique',
  isometric: 'isométrique', eccentric: 'excentrique',
  dynamic: 'dynamique', static: 'statique', slow: 'lent', fast: 'rapide',
}));

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Trier par longueur décroissante : « bench press » doit primer sur « press ».
const PHRASE_RULES = [...PHRASES]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([en, fr]) => [new RegExp(`\\b${escapeRegExp(en)}\\b`, 'gi'), fr]);

// En français le matériel se place APRÈS le mouvement, introduit par une
// préposition : « développé couché à la barre », et non « barre développé
// couché ». Le dataset nomme presque toujours le matériel en tête, on le
// déplace donc en fin de chaîne.
const EQUIPMENT_TAIL = [
  ['barre EZ', 'à la barre EZ'],
  ['barre olympique', 'à la barre olympique'],
  ['smith machine', 'à la smith machine'],
  ['machine à levier', 'à la machine'],
  ['poids de corps', 'au poids de corps'],
  ['medicine ball', 'au medicine ball'],
  ['swiss ball', 'au swiss ball'],
  ['haltères', 'aux haltères'],
  ['barres', 'aux barres'],
  ['barre', 'à la barre'],
  ['poulies', 'aux poulies'],
  ['poulie', 'à la poulie'],
  ['élastiques', 'avec élastiques'],
  ['élastique', 'avec élastique'],
  ['kettlebells', 'aux kettlebells'],
  ['kettlebell', 'au kettlebell'],
  ['traîneau', 'au traîneau'],
  ['bosu', 'au bosu'],
  ['rouleau', 'au rouleau'],
  ['corde', 'à la corde'],
  ['machine', 'à la machine'],
  ['sangles', 'aux sangles'],
];

/**
 * Détache un matériel placé en tête : renvoie le corps du nom et le
 * complément prépositionnel à recoller en fin de chaîne.
 */
function splitEquipment(name) {
  for (const [lead, tail] of EQUIPMENT_TAIL) {
    if (name === lead) return { head: name, tail: '' };
    if (name.startsWith(`${lead} `)) {
      const head = name.slice(lead.length + 1).trim();
      if (head) return { head, tail };
    }
  }
  return { head: name, tail: '' };
}

// Le français place le nom du mouvement en tête, les qualificatifs
// ensuite : « développé couché incliné », pas « incliné couché développé ».
const MOVEMENT_HEADS = [
  'développé couché', 'développé militaire', 'développé vertical', 'développé',
  'soulevé de terre', 'relevé de buste', 'relevé de jambes',
  'extension à la poulie', 'tirage vertical', 'rowing menton',
  'presse à cuisses', 'traction supination', 'corde à sauter',
  'roue abdominale', 'barre au front', 'pont fessier', 'hip thrust',
  'leg curl', 'leg extension', 'élévation latérale', 'élévation frontale',
  'auto-massage rouleau', 'marche du fermier', 'saut sur box',
  'curl pupitre', 'curl concentré', 'curl marteau', 'curl poignets',
  'haussement d’épaules', 'haussements d’épaules',
  'étirement', 'étirements', 'mobilité', 'traction', 'tirage', 'rowing',
  'curl', 'squat', 'fente', 'fentes', 'extension', 'extensions',
  'élévation', 'élévations', 'écarté', 'écartés', 'pullover', 'dips',
  'crunch', 'crunchs', 'planche', 'pont', 'poussée', 'pompe', 'saut',
  'sauts', 'course', 'marche', 'rotation', 'rotations', 'muscle-up',
  'épaulé', 'jeté', 'arraché', 'swing', 'burpee', 'kickback', 'maintien',
].sort((a, b) => b.length - a.length);

/** Remonte le nom du mouvement en tête de chaîne. */
function frontMovement(head) {
  for (const move of MOVEMENT_HEADS) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(move)}(?=\\s|$)`);
    const m = head.match(re);
    if (!m) continue;
    const before = head.slice(0, m.index).trim();
    const after = head.slice(m.index + m[0].length).trim();
    const rest = [before, after].filter(Boolean).join(' ');
    return rest ? `${move} ${rest}` : move;
  }
  return head;
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Traduit un nom d'exercice anglais vers le français.
 * Les tokens inconnus (noms propres, marques) sont conservés tels quels.
 */
export function translateExerciseName(englishName) {
  if (!englishName) return '';

  let working = englishName.toLowerCase().trim();

  // 1) Expressions multi-mots -> jetons protégés, pour éviter qu'un
  //    remplacement ultérieur ne recoupe une traduction déjà posée.
  //    Sentinelle @@n@@ : les noms contiennent de vrais chiffres
  //    ("3/4 sit-up", "v. 2") qu'un index nu confondrait avec un jeton,
  //    et jamais d'arobase.
  const vault = [];
  for (const [pattern, replacement] of PHRASE_RULES) {
    working = working.replace(pattern, () => {
      vault.push(replacement);
      return `@@${vault.length - 1}@@`;
    });
  }

  // 2) Mot à mot sur ce qui reste.
  working = working
    .split(/(\s+|\/|,)/)
    .map((chunk) => {
      if (/^\s+$/.test(chunk) || chunk === '/' || chunk === ',') return chunk;
      if (chunk.startsWith('@@')) return chunk; // jeton protégé
      const key = chunk.replace(/[^a-z0-9']/g, '');
      if (!key) return chunk;
      const hit = TOKENS.get(key);
      if (hit === undefined) return chunk;
      return chunk.replace(key, hit);
    })
    .join('');

  // 3) Restitution des expressions protégées.
  working = working.replace(/@@(\d+)@@/g, (_, i) => vault[Number(i)] ?? '');

  // 4) Nettoyage des espaces laissés par les tokens vides ("up", "the").
  working = working.replace(/\s{2,}/g, ' ').replace(/\s+([,.)])/g, '$1').trim();

  // 5) Remise en ordre française : matériel en complément, mouvement en tête.
  const { head, tail } = splitEquipment(working);
  working = [frontMovement(head), tail].filter(Boolean).join(' ');

  // 6) Parenthèses vidées par un token neutralisé ("attachment").
  working = working.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

  return capitalize(working);
}

/** Slug URL-safe, accents retirés. */
export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
