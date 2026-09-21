// Catalogue de recettes.
//
// Le journal alimentaire sait compter ce qui a été mangé ; il ne sait
// rien proposer. Ces recettes comblent ce trou : des plats composés
// d'aliments DU CATALOGUE, dont les macros se recalculent depuis les
// ingrédients — jamais saisies à la main, sinon elles divergeraient de
// la fiche des aliments à la première correction.
//
// Les quantités sont TOUJOURS en grammes, y compris pour ce qui se
// compte à la pièce : deux œufs valent 100 g, une dose de whey 30 g.
// Mélanger grammes et pièces dans une même liste est la façon la plus
// sûre de se tromper d'un facteur deux.
//
// Les ingrédients sont référencés par NOM. La résolution vers le
// catalogue se fait à l'insertion et signale tout nom introuvable
// plutôt que d'enregistrer une recette aux macros fausses.

/** Repas auxquels une recette convient. */
const MATIN = ['matin'];
const MIDI_SOIR = ['midi', 'soir'];
const COLLATION = ['collation'];

const r = (slug, name, meals, opts) => ({
  slug, name, meals, servings: 1, ...opts,
});

export const RECIPES = [
  // --- Matin ----------------------------------------------------------
  r('porridge-proteine', 'Porridge protéiné aux myrtilles', MATIN, {
    prep_minutes: 8,
    tags: ['rapide', 'riche-proteines', 'vegetarien'],
    ingredients: [
      ['Flocons d’avoine', 60],
      ['Lait demi-écrémé', 200],
      ['Whey protéine (dose)', 30],
      ['Myrtilles', 80],
      ['Amandes', 15],
      ['Cannelle', 2],
    ],
    steps: [
      'Porter le lait à frémissement, verser les flocons et cuire 4 min en remuant.',
      'Hors du feu, laisser tiédir avant d’incorporer la whey : versée dans un liquide '
        + 'bouillant, elle coagule en grumeaux.',
      'Ajouter les myrtilles, les amandes concassées et la cannelle.',
    ],
    note: 'Le petit-déjeuner est le repas où les protéines manquent le plus souvent : '
      + 'une dose de whey suffit à le remonter au seuil par repas.',
  }),

  r('skyr-avoine-fruits-rouges', 'Skyr, avoine et fruits rouges', MATIN, {
    prep_minutes: 3,
    tags: ['rapide', 'sans-cuisson', 'riche-proteines', 'vegetarien'],
    ingredients: [
      ['Skyr nature', 250],
      ['Fruits rouges', 100],
      ['Flocons d’avoine', 30],
      ['Beurre de cacahuète', 15],
    ],
    steps: [
      'Mélanger le skyr et les flocons, laisser reposer 5 min — ou toute la nuit.',
      'Ajouter les fruits rouges et le beurre de cacahuète.',
    ],
  }),

  r('oeufs-brouilles-avocat', 'Œufs brouillés, avocat et pain complet', MATIN, {
    prep_minutes: 10,
    tags: ['vegetarien', 'riche-proteines'],
    ingredients: [
      ['Œuf entier', 100],
      ['Blanc d’œuf', 90],
      ['Pain complet', 80],
      ['Avocat', 50],
      ['Tomate', 80],
    ],
    steps: [
      'Battre les œufs entiers avec les blancs.',
      'Cuire à feu doux en remuant sans arrêt : c’est la chaleur douce qui donne '
        + 'la texture, pas le temps de cuisson.',
      'Servir sur le pain grillé avec l’avocat et la tomate.',
    ],
    note: 'Deux œufs entiers pour le goût et les micronutriments du jaune, des blancs '
      + 'pour monter les protéines sans les lipides.',
  }),

  r('pain-complet-jambon-fromage-blanc', 'Tartines jambon et fromage blanc', MATIN, {
    prep_minutes: 5,
    tags: ['rapide', 'sans-cuisson'],
    ingredients: [
      ['Pain complet', 80],
      ['Jambon blanc', 60],
      ['Fromage blanc 0 %', 120],
      ['Kiwi', 100],
      ['Moutarde', 5],
    ],
    steps: [
      'Tartiner le pain de fromage blanc moutardé, garnir de jambon.',
      'Servir avec le kiwi.',
    ],
  }),

  // --- Midi et soir -----------------------------------------------------
  r('poulet-riz-brocoli', 'Poulet, riz complet et brocoli', MIDI_SOIR, {
    prep_minutes: 25,
    tags: ['batch-cooking', 'riche-proteines'],
    ingredients: [
      ['Blanc de poulet', 180],
      ['Riz complet cuit', 200],
      ['Brocoli', 200],
      ['Huile d’olive', 10],
      ['Sauce soja', 10],
    ],
    steps: [
      'Saisir le poulet 6 min par face dans l’huile.',
      'Cuire le brocoli 5 min à la vapeur : il doit rester ferme.',
      'Assembler et déglacer à la sauce soja.',
    ],
    note: 'Le plat de fond de la préparation à l’avance : il se garde trois jours et se '
      + 'réchauffe sans se dégrader.',
  }),

  r('saumon-quinoa-epinards', 'Saumon, quinoa et épinards', MIDI_SOIR, {
    prep_minutes: 20,
    tags: ['omega-3', 'riche-proteines'],
    ingredients: [
      ['Saumon', 150],
      ['Quinoa cuit', 180],
      ['Épinards', 150],
      ['Huile de colza', 8],
      ['Orange', 100],
    ],
    steps: [
      'Cuire le saumon 12 min à 180 °C, peau dessous.',
      'Faire tomber les épinards à la poêle, 2 min.',
      'Servir avec le quinoa et quelques quartiers d’orange.',
    ],
  }),

  r('bowl-thon-pois-chiches', 'Bowl thon et pois chiches', MIDI_SOIR, {
    prep_minutes: 8,
    tags: ['rapide', 'sans-cuisson', 'a-emporter'],
    ingredients: [
      ['Thon au naturel', 120],
      ['Pois chiches cuits', 150],
      ['Concombre', 100],
      ['Tomate', 100],
      ['Huile d’olive', 10],
      ['Moutarde', 8],
    ],
    steps: [
      'Égoutter le thon et les pois chiches.',
      'Détailler les légumes, mélanger le tout avec l’huile et la moutarde.',
    ],
    note: 'Aucune cuisson, se transporte : c’est le plat qui évite le sandwich du midi.',
  }),

  r('wrap-dinde-hummus', 'Wrap dinde et hummus', MIDI_SOIR, {
    prep_minutes: 7,
    tags: ['rapide', 'a-emporter'],
    ingredients: [
      ['Wrap tortilla', 120],
      ['Filet de dinde', 150],
      ['Hummus', 40],
      ['Concombre', 80],
      ['Épinards', 40],
    ],
    steps: [
      'Tartiner les wraps de hummus.',
      'Garnir de dinde, d’épinards et de concombre, rouler serré.',
    ],
  }),

  r('dinde-patate-douce', 'Dinde, patate douce et haricots verts', MIDI_SOIR, {
    prep_minutes: 30,
    tags: ['batch-cooking', 'riche-proteines'],
    ingredients: [
      ['Filet de dinde', 180],
      ['Patate douce cuite', 250],
      ['Haricots verts', 150],
      ['Huile d’olive', 8],
    ],
    steps: [
      'Rôtir la patate douce en cubes 25 min à 200 °C.',
      'Saisir la dinde 5 min par face.',
      'Cuire les haricots 8 min à la vapeur.',
    ],
  }),

  r('pates-steak-tomate', 'Pâtes, steak haché et tomate', MIDI_SOIR, {
    prep_minutes: 20,
    tags: ['riche-glucides'],
    ingredients: [
      ['Pâtes blanches cuites', 220],
      ['Steak haché 5 %', 150],
      ['Tomate', 150],
      ['Parmesan', 15],
      ['Huile d’olive', 8],
    ],
    steps: [
      'Faire revenir le steak émietté, ajouter la tomate concassée, mijoter 10 min.',
      'Mélanger aux pâtes, parsemer de parmesan.',
    ],
    note: 'Glucides élevés : le plat à placer le jour d’une séance lourde plutôt qu’un '
      + 'jour de repos.',
  }),

  r('lentilles-oeufs-legumes', 'Lentilles, œufs et légumes', MIDI_SOIR, {
    prep_minutes: 15,
    tags: ['vegetarien', 'riche-fibres'],
    ingredients: [
      ['Lentilles cuites', 200],
      ['Œuf entier', 100],
      ['Carotte', 100],
      ['Épinards', 100],
      ['Huile de colza', 8],
      ['Vinaigrette', 10],
    ],
    steps: [
      'Cuire les œufs 9 min pour un jaune encore fondant.',
      'Mélanger lentilles, carotte râpée et épinards, assaisonner.',
      'Ajouter les œufs coupés en deux.',
    ],
    note: 'Végétarien et très fibreux : les légumineuses sont le levier le plus simple '
      + 'pour atteindre les 25 g de fibres quotidiens.',
  }),

  r('couscous-poulet-legumes', 'Couscous de poulet aux légumes', MIDI_SOIR, {
    prep_minutes: 35,
    tags: ['batch-cooking', 'riche-fibres'],
    ingredients: [
      ['Cuisse de poulet', 150],
      ['Couscous cuit', 200],
      ['Courgette', 150],
      ['Carotte', 100],
      ['Pois chiches cuits', 80],
      ['Huile d’olive', 8],
    ],
    steps: [
      'Dorer la cuisse de poulet, réserver.',
      'Faire suer les légumes en dés 15 min, ajouter les pois chiches.',
      'Servir sur la semoule avec le poulet.',
    ],
  }),

  r('cabillaud-pommes-terre', 'Cabillaud, pommes de terre et courgette', MIDI_SOIR, {
    prep_minutes: 25,
    tags: ['leger', 'riche-proteines'],
    ingredients: [
      ['Cabillaud', 200],
      ['Pomme de terre cuite', 250],
      ['Courgette', 150],
      ['Huile d’olive', 10],
    ],
    steps: [
      'Cuire le cabillaud 10 min à la vapeur ou au four.',
      'Poêler les courgettes en rondelles.',
      'Servir avec les pommes de terre.',
    ],
    note: 'Très peu de lipides pour beaucoup de protéines : utile les jours où le reste '
      + 'de la journée a déjà consommé le budget de gras.',
  }),

  r('omelette-champignons-comte', 'Omelette champignons et comté', MIDI_SOIR, {
    prep_minutes: 12,
    tags: ['rapide', 'vegetarien'],
    ingredients: [
      ['Œuf entier', 150],
      ['Blanc d’œuf', 90],
      ['Champignons', 150],
      ['Comté', 25],
      ['Épinards', 100],
      ['Huile d’olive', 5],
    ],
    steps: [
      'Faire suer les champignons jusqu’à évaporation complète de leur eau.',
      'Ajouter les épinards, verser les œufs battus.',
      'Parsemer de comté, replier.',
    ],
  }),

  r('crevettes-riz-courgette', 'Crevettes sautées, riz et courgette', MIDI_SOIR, {
    prep_minutes: 15,
    tags: ['rapide', 'leger', 'riche-proteines'],
    ingredients: [
      ['Crevettes décortiquées', 180],
      ['Riz blanc cuit', 180],
      ['Courgette', 200],
      ['Sauce soja', 15],
      ['Huile de colza', 8],
    ],
    steps: [
      'Sauter les courgettes 5 min à feu vif.',
      'Ajouter les crevettes 3 min : au-delà, elles deviennent caoutchouteuses.',
      'Déglacer à la sauce soja, servir sur le riz.',
    ],
  }),

  r('tofu-quinoa-brocoli', 'Tofu grillé, quinoa et brocoli', MIDI_SOIR, {
    prep_minutes: 20,
    tags: ['vegetarien', 'vegan', 'riche-fibres'],
    ingredients: [
      ['Tofu nature', 200],
      ['Quinoa cuit', 180],
      ['Brocoli', 200],
      ['Sauce soja', 15],
      ['Huile de colza', 10],
      ['Amandes', 15],
    ],
    steps: [
      'Presser le tofu 10 min pour en extraire l’eau, puis le griller sur toutes ses faces.',
      'Cuire le brocoli à la vapeur.',
      'Assembler, déglacer à la sauce soja, parsemer d’amandes.',
    ],
  }),

  r('sardines-pommes-terre', 'Sardines, pommes de terre et haricots', MIDI_SOIR, {
    prep_minutes: 10,
    tags: ['rapide', 'omega-3', 'placard'],
    ingredients: [
      ['Sardines à l’huile', 100],
      ['Pomme de terre cuite', 250],
      ['Haricots verts', 150],
      ['Moutarde', 10],
    ],
    steps: [
      'Écraser grossièrement les pommes de terre tièdes avec la moutarde.',
      'Ajouter les sardines égouttées et les haricots.',
    ],
    note: 'Entièrement issu du placard : le plat de secours des soirs où rien n’est prêt.',
  }),

  r('bresaola-mozzarella-salade', 'Bresaola, mozzarella et tomates', MIDI_SOIR, {
    prep_minutes: 6,
    tags: ['rapide', 'sans-cuisson', 'riche-proteines'],
    ingredients: [
      ['Bresaola', 80],
      ['Mozzarella light', 100],
      ['Tomate', 150],
      ['Concombre', 100],
      ['Pain complet', 60],
      ['Huile d’olive', 12],
    ],
    steps: [
      'Dresser la bresaola, la mozzarella et les légumes.',
      'Arroser d’huile d’olive, servir avec le pain.',
    ],
  }),

  r('soupe-legumes-oeufs', 'Soupe de légumes et œufs', MIDI_SOIR, {
    prep_minutes: 10,
    tags: ['rapide', 'leger', 'vegetarien', 'riche-fibres'],
    ingredients: [
      ['Soupe 10 légumes', 400],
      ['Œuf entier', 100],
      ['Pain complet', 60],
      ['Fromage blanc 0 %', 100],
    ],
    steps: [
      'Réchauffer la soupe.',
      'Y pocher les œufs 3 min, ou les servir durs à côté.',
      'Accompagner du pain et du fromage blanc.',
    ],
    note: 'Faible en calories pour un volume important : le repas du soir des jours où '
      + 'le budget calorique est déjà entamé.',
  }),

  // --- Collations --------------------------------------------------------
  r('shaker-banane', 'Shaker whey et banane', COLLATION, {
    prep_minutes: 2,
    tags: ['rapide', 'sans-cuisson', 'post-seance', 'riche-proteines'],
    ingredients: [
      ['Whey protéine (dose)', 30],
      ['Lait d’amande sans sucre', 250],
      ['Banane', 120],
    ],
    steps: ['Mixer ou secouer énergiquement.'],
    note: 'La fenêtre post-séance est bien plus large qu’on ne le dit : ce shaker vaut '
      + 'surtout comme moyen commode d’atteindre le total de la journée.',
  }),

  r('fromage-blanc-amandes', 'Fromage blanc, amandes et myrtilles', COLLATION, {
    prep_minutes: 2,
    tags: ['rapide', 'sans-cuisson', 'riche-proteines', 'vegetarien'],
    ingredients: [
      ['Fromage blanc 0 %', 250],
      ['Amandes', 20],
      ['Myrtilles', 80],
    ],
    steps: ['Mélanger.'],
  }),

  r('galettes-beurre-cacahuete', 'Galettes de riz au beurre de cacahuète', COLLATION, {
    prep_minutes: 2,
    tags: ['rapide', 'sans-cuisson', 'avant-seance'],
    ingredients: [
      ['Galette de riz', 27],
      ['Beurre de cacahuète', 20],
      ['Banane', 100],
    ],
    steps: ['Tartiner les galettes, garnir de rondelles de banane.'],
    note: 'Glucides rapides et peu de volume : la collation d’avant-séance.',
  }),

  r('yaourt-grec-chocolat', 'Yaourt grec, chocolat noir et fraises', COLLATION, {
    prep_minutes: 2,
    tags: ['rapide', 'sans-cuisson', 'vegetarien'],
    ingredients: [
      ['Yaourt grec 0 %', 200],
      ['Chocolat noir 70 %', 20],
      ['Fraises', 100],
    ],
    steps: ['Concasser le chocolat sur le yaourt, ajouter les fraises.'],
  }),

  r('pomme-amandes', 'Pomme et amandes', COLLATION, {
    prep_minutes: 1,
    tags: ['rapide', 'sans-cuisson', 'a-emporter', 'vegan'],
    ingredients: [
      ['Pomme', 150],
      ['Amandes', 25],
    ],
    steps: ['Rien à préparer.'],
    note: 'Aucune préparation, se glisse dans un sac : c’est ce qui la rend utile.',
  }),

  r('skyr-compote-cannelle', 'Skyr, compote et cannelle', COLLATION, {
    prep_minutes: 2,
    tags: ['rapide', 'sans-cuisson', 'riche-proteines', 'vegetarien'],
    ingredients: [
      ['Skyr nature', 200],
      ['Compote sans sucre', 100],
      ['Cannelle', 2],
      ['Flocons d’avoine', 20],
    ],
    steps: ['Mélanger.'],
  }),
];

/** Tous les ingrédients cités, pour vérifier la couverture du catalogue. */
export const referencedFoods = () => [
  ...new Set(RECIPES.flatMap((x) => x.ingredients.map(([name]) => name))),
].sort();

export const recipeStats = () => {
  const byMeal = {};
  for (const x of RECIPES) {
    for (const meal of x.meals) byMeal[meal] = (byMeal[meal] ?? 0) + 1;
  }
  return { total: RECIPES.length, byMeal, foods: referencedFoods().length };
};
