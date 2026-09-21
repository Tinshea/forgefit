import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROTEIN, FIBRE, REFERENCES, proteinPerMeal, reviewTargets,
} from '../src/services/nutrition-evidence.js';
import { mealBudget, scoreRecipe, suggestMeals } from '../src/services/meal-planner.js';
import { RECIPES, referencedFoods, recipeStats } from '../src/services/recipe-catalogue.js';

// ---------------------------------------------------------------------
// Repères
// ---------------------------------------------------------------------

test('chaque référence porte une citation et une affirmation', () => {
  for (const [key, ref] of Object.entries(REFERENCES)) {
    assert.ok(ref.citation?.length > 30, `citation trop courte : ${key}`);
    assert.ok(ref.claim?.length > 20, `affirmation manquante : ${key}`);
  }
});

test('les sources citées par les repères existent', () => {
  for (const key of [...PROTEIN.sources, ...FIBRE.sources]) {
    assert.ok(REFERENCES[key], `référence inconnue : ${key}`);
  }
});

test('la répartition des protéines compare au seuil par repas', () => {
  // 140 g sur 4 repas pour 80 kg : 35 g par repas contre un seuil de 32.
  const ok = proteinPerMeal(140, 80, 4);
  assert.equal(ok.per_meal_g, 35);
  assert.equal(ok.threshold_g, 32);
  assert.equal(ok.meets_threshold, true);
  assert.equal(ok.meets_frequency, true);

  // Même total sur deux repas : le seuil est atteint, mais pas la
  // fréquence — et c'est la répartition qui est en cause.
  const concentrated = proteinPerMeal(140, 80, 2);
  assert.equal(concentrated.meets_frequency, false);
});

test('un apport trop bas est signalé, pas corrigé', () => {
  const review = reviewTargets({
    targets: { protein_g: 90, fiber_g: 30 }, goal: 'maintien', weightKg: 80,
  });
  const protein = review.checks.find((c) => c.key === 'protein_daily');
  assert.equal(protein.ok, false);
  // La cible n'est pas modifiée : seul un constat est produit.
  assert.ok(protein.value.startsWith('1.13'), protein.value);
  assert.ok(protein.note.includes('1.6'));
});

test('en déficit, la cible se rapporte à la masse maigre', () => {
  // Helms : 2,3–3,1 g/kg de masse maigre en restriction calorique.
  const low = reviewTargets({
    targets: { protein_g: 130, fiber_g: 30 }, goal: 'perte', leanMassKg: 63.5,
  });
  const check = low.checks.find((c) => c.key === 'protein_deficit');
  assert.ok(check, 'le contrôle spécifique au déficit doit exister');
  assert.equal(check.ok, false);
  assert.equal(check.source, 'helms2014deficit');

  const enough = reviewTargets({
    targets: { protein_g: 160, fiber_g: 30 }, goal: 'perte', leanMassKg: 63.5,
  });
  assert.equal(enough.checks.find((c) => c.key === 'protein_deficit').ok, true);
});

test('un apport au-dessus du plateau est dit sans être blâmé', () => {
  const review = reviewTargets({
    targets: { protein_g: 200, fiber_g: 30 }, goal: 'maintien', weightKg: 80,
  });
  const protein = review.checks.find((c) => c.key === 'protein_daily');
  // 2,5 g/kg : au-dessus de la fourchette, mais sans danger connu.
  assert.equal(protein.ok, true);
  assert.ok(protein.note.includes('aucun gain supplémentaire'), protein.note);
});

test('les fibres sont comparées au plancher de référence', () => {
  const low = reviewTargets({ targets: { protein_g: 140, fiber_g: 12 }, weightKg: 80 });
  assert.equal(low.checks.find((c) => c.key === 'fibre').ok, false);
  const ok = reviewTargets({ targets: { protein_g: 140, fiber_g: 30 }, weightKg: 80 });
  assert.equal(ok.checks.find((c) => c.key === 'fibre').ok, true);
  assert.equal(FIBRE.dailyMinimumG, 25);
});

test('la revue annonce ses limites', () => {
  const review = reviewTargets({ targets: { protein_g: 140, fiber_g: 30 }, weightKg: 80 });
  assert.ok(review.disclaimer.includes('avis médical'));
  assert.ok(review.sources.length > 0);
});

test('sans cibles, la revue ne fabrique rien', () => {
  assert.deepEqual(reviewTargets({ targets: null }).checks, []);
});

// ---------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------

const RECIPE = (over = {}) => ({
  id: 'r1', name: 'Test', kcal: 500, protein_g: 40,
  carbs_g: 50, fat_g: 15, fiber_g: 8, price_eur: 2, ...over,
});

test('le budget se partage entre les repas restants', () => {
  const budget = mealBudget({ kcal: 2000, protein_g: 160, fiber_g: 30 }, 4);
  assert.equal(budget.kcal, 500);
  assert.equal(budget.protein_g, 40);
  assert.equal(budget.meals_left, 4);
});

test('un budget négatif est ramené à zéro, pas propagé', () => {
  // Un dépassement de la journée ne doit pas produire un budget négatif
  // qui inverserait tout le classement.
  const budget = mealBudget({ kcal: -300, protein_g: -20 }, 2);
  assert.equal(budget.kcal, 0);
  assert.equal(budget.protein_g, 0);
});

test('la portion proposée est une fraction servable', () => {
  const budget = mealBudget({ kcal: 2000, protein_g: 160 }, 4);
  const evaluation = scoreRecipe(RECIPE({ kcal: 370 }), budget, { kcal: 2000 }, 80);
  assert.ok([0.5, 0.75, 1, 1.25, 1.5, 2].includes(evaluation.portion), `${evaluation.portion}`);
});

test('la portion reste bornée, même face à un budget absurde', () => {
  const budget = mealBudget({ kcal: 6000, protein_g: 400 }, 1);
  const evaluation = scoreRecipe(RECIPE({ kcal: 200 }), budget, { kcal: 6000 }, 80);
  // Proposer cinq portions n'aiderait personne.
  assert.ok(evaluation.portion <= 2, `${evaluation.portion}`);
});

test('une recette qui fait déborder la journée est pénalisée et le dit', () => {
  const budget = mealBudget({ kcal: 300, protein_g: 30 }, 1);
  const tight = scoreRecipe(RECIPE({ kcal: 1200 }), budget, { kcal: 300 }, 80);
  assert.ok(tight.warnings.some((w) => w.includes('Dépasse')), JSON.stringify(tight.warnings));

  const fitting = scoreRecipe(RECIPE({ kcal: 300 }), budget, { kcal: 300 }, 80);
  assert.ok(fitting.score > tight.score, `${fitting.score} vs ${tight.score}`);
});

test('à calories égales, la recette la plus protéinée passe devant', () => {
  const { items } = suggestMeals({
    recipes: [
      RECIPE({ id: 'pauvre', protein_g: 12 }),
      RECIPE({ id: 'riche', protein_g: 45 }),
    ],
    remaining: { kcal: 2000, protein_g: 160, fiber_g: 30 },
    mealsLeft: 4,
    bodyweightKg: 80,
  });
  assert.equal(items[0].recipe.id, 'riche');
});

test('le seuil par repas est évalué sur la portion, pas sur la recette', () => {
  // 40 g de protéines à la portion entière, mais une demi-portion tombe
  // sous le seuil de 32 g : c'est ce qui est servi qui compte.
  const budget = mealBudget({ kcal: 1000, protein_g: 80 }, 4);
  const evaluation = scoreRecipe(RECIPE({ kcal: 1000 }), budget, { kcal: 1000 }, 80);
  assert.equal(evaluation.portion, 0.5);
  assert.equal(evaluation.macros.protein_g, 20);
  assert.equal(evaluation.meets_protein_threshold, false);
});

test('chaque suggestion explique son rang', () => {
  const { items } = suggestMeals({
    recipes: [RECIPE()],
    remaining: { kcal: 2000, protein_g: 160, fiber_g: 30 },
    mealsLeft: 4,
    bodyweightKg: 80,
  });
  // Un classement qu'on ne peut pas contredire ne vaut pas mieux qu'un
  // tirage au sort.
  assert.ok(items[0].reasons.length > 0);
});

test('un budget épuisé est annoncé, pas masqué', () => {
  const result = suggestMeals({
    recipes: [RECIPE()],
    remaining: { kcal: -100, protein_g: 10 },
    mealsLeft: 1,
    bodyweightKg: 80,
  });
  assert.equal(result.exhausted, true);
});

test('une recette sans calories est écartée au lieu de diviser par zéro', () => {
  const budget = mealBudget({ kcal: 2000, protein_g: 160 }, 4);
  assert.equal(scoreRecipe(RECIPE({ kcal: 0 }), budget, { kcal: 2000 }, 80), null);
});

// ---------------------------------------------------------------------
// Catalogue de recettes
// ---------------------------------------------------------------------

test('les identifiants de recette sont uniques', () => {
  const slugs = RECIPES.map((x) => x.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('chaque recette a des ingrédients, des repas et des étapes', () => {
  for (const recipe of RECIPES) {
    assert.ok(recipe.ingredients.length >= 2, `${recipe.slug} : trop peu d’ingrédients`);
    assert.ok(recipe.meals.length > 0, `${recipe.slug} : aucun repas`);
    assert.ok(recipe.steps?.length > 0, `${recipe.slug} : aucune étape`);
    assert.ok(recipe.servings > 0);
    for (const [name, quantity] of recipe.ingredients) {
      assert.ok(name?.length > 1, `${recipe.slug} : ingrédient sans nom`);
      assert.ok(quantity >= 1, `${recipe.slug} : ${name} à ${quantity}`);
    }
  }
});

test('les repas déclarés sont des créneaux connus', () => {
  const slots = new Set(['matin', 'midi', 'soir', 'collation']);
  for (const recipe of RECIPES) {
    for (const meal of recipe.meals) {
      assert.ok(slots.has(meal), `${recipe.slug} : créneau inconnu ${meal}`);
    }
  }
});

test('chaque créneau de repas est couvert', () => {
  // Un créneau sans recette rendrait les suggestions muettes à ce repas.
  const stats = recipeStats();
  for (const meal of ['matin', 'midi', 'soir', 'collation']) {
    assert.ok(stats.byMeal[meal] > 0, `aucune recette pour ${meal}`);
  }
});

test('aucun ingrédient n’est répété dans une même recette', () => {
  // La contrainte d'unicité en base le refuserait, avec un message
  // autrement moins lisible.
  for (const recipe of RECIPES) {
    const names = recipe.ingredients.map(([n]) => n);
    assert.equal(new Set(names).size, names.length, `${recipe.slug} : ingrédient répété`);
  }
});

/**
 * Taille d'une pièce, pour les aliments du catalogue qui se comptent à
 * l'unité. C'est le piège principal de ce fichier : écrire « 2 » pour
 * deux œufs au lieu de 100 g diviserait leur apport par cinquante.
 */
const PIECE_SIZES = {
  'Œuf entier': 50,
  'Blanc d’œuf': 30,
  'Whey protéine (dose)': 30,
  'Galette de riz': 9,
  'Wrap tortilla': 60,
  'Chocolat noir 70 %': 10,
};

test('les ingrédients comptés à la pièce sont exprimés en grammes entiers', () => {
  for (const recipe of RECIPES) {
    for (const [name, quantity] of recipe.ingredients) {
      const piece = PIECE_SIZES[name];
      if (!piece) continue;
      assert.equal(
        quantity % piece, 0,
        `${recipe.slug} : ${name} à ${quantity} g n’est pas un multiple de ${piece} g `
        + '— une pièce écrite en unités plutôt qu’en grammes ?',
      );
      assert.ok(
        quantity >= piece,
        `${recipe.slug} : ${name} à ${quantity} g, moins d’une pièce`,
      );
    }
  }
});

test('le catalogue couvre plusieurs régimes', () => {
  const tags = new Set(RECIPES.flatMap((x) => x.tags ?? []));
  for (const tag of ['vegetarien', 'rapide', 'riche-proteines']) {
    assert.ok(tags.has(tag), `aucune recette marquée ${tag}`);
  }
  assert.ok(referencedFoods().length > 30);
});
