// Suggestion de repas.
//
// La question n'est pas « quelle recette est bonne ? » mais « laquelle
// fait entrer la journée dans ses cibles, compte tenu de ce qui a déjà
// été mangé et de ce qu'il reste de repas ». Une suggestion qui ignore
// le journal du jour n'est qu'un livre de cuisine.
//
// Le macronutriment CONTRAIGNANT est la protéine. Les glucides absorbent
// l'ajustement calorique (cf. `nutrition.js`), les lipides ont une
// fourchette large ; la protéine, elle, a un plancher qu'on rate ou
// qu'on atteint. Le classement en découle.

import { clamp } from './stats-math.js';
import { PROTEIN } from './nutrition-evidence.js';

/** Portions proposées : des fractions qu'on sait servir, pas 1,37×. */
const PORTION_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const nearestPortion = (ratio) => PORTION_STEPS.reduce(
  (best, step) => (Math.abs(step - ratio) < Math.abs(best - ratio) ? step : best),
  PORTION_STEPS[0],
);

/**
 * Part du budget restant attribuable à ce repas.
 *
 * Répartir le reste équitablement sur les repas qui restent évite le
 * piège classique : un déjeuner qui consomme tout le budget et un dîner
 * à 200 kcal.
 */
export function mealBudget(remaining, mealsLeft) {
  const share = Math.max(1, mealsLeft);
  const take = (v) => Math.max(0, Number(v ?? 0)) / share;
  return {
    kcal: take(remaining.kcal),
    protein_g: take(remaining.protein_g),
    fat_g: take(remaining.fat_g),
    carbs_g: take(remaining.carbs_g),
    fiber_g: take(remaining.fiber_g),
    meals_left: share,
  };
}

/** Macros d'une recette servie à `portion` parts. */
function scaleRecipe(recipe, portion) {
  const s = (v) => Math.round(Number(v ?? 0) * portion * 10) / 10;
  return {
    kcal: s(recipe.kcal),
    protein_g: s(recipe.protein_g),
    carbs_g: s(recipe.carbs_g),
    fat_g: s(recipe.fat_g),
    fiber_g: s(recipe.fiber_g),
    price_eur: recipe.price_eur == null
      ? null
      : Math.round(Number(recipe.price_eur) * portion * 100) / 100,
  };
}

/**
 * Note d'une recette face au budget du repas.
 *
 * @returns {{score, portion, macros, reasons, warnings}}
 */
export function scoreRecipe(recipe, budget, remaining, bodyweightKg = null) {
  const kcal = Number(recipe.kcal ?? 0);
  if (!(kcal > 0)) return null;

  // Portion visant le budget calorique du repas, bornée : proposer un
  // quart de portion ou trois portions n'aide personne.
  const portion = nearestPortion(clamp(budget.kcal / kcal, 0.5, 2));
  const macros = scaleRecipe(recipe, portion);

  const reasons = [];
  const warnings = [];

  // --- Protéines : le critère qui pèse le plus ------------------------
  const proteinTarget = budget.protein_g;
  const proteinCover = proteinTarget > 0
    ? clamp(macros.protein_g / proteinTarget, 0, 1.5)
    : 1;
  // Au-delà de la cible, l'excédent n'est pas un bonus : on plafonne.
  const proteinScore = Math.min(1, proteinCover);

  // Seuil par repas : c'est la répartition, pas seulement le total, qui
  // soutient la synthèse protéique.
  const mealThreshold = bodyweightKg > 0 ? PROTEIN.perMealPerKg * bodyweightKg : null;
  const meetsThreshold = mealThreshold ? macros.protein_g >= mealThreshold : null;
  if (meetsThreshold) {
    reasons.push(`${Math.round(macros.protein_g)} g de protéines : au-dessus du seuil de `
      + `${Math.round(mealThreshold)} g par repas.`);
  } else if (meetsThreshold === false) {
    warnings.push(`${Math.round(macros.protein_g)} g de protéines, sous le seuil de `
      + `${Math.round(mealThreshold)} g par repas.`);
  }

  // --- Calories : ne pas faire déborder la journée ---------------------
  const overshoot = remaining.kcal > 0
    ? Math.max(0, macros.kcal - remaining.kcal) / remaining.kcal
    : 1;
  const kcalFit = 1 - Math.min(1, Math.abs(macros.kcal - budget.kcal) / Math.max(1, budget.kcal));

  if (overshoot > 0) {
    warnings.push(`Dépasse le budget calorique restant de `
      + `${Math.round(macros.kcal - remaining.kcal)} kcal.`);
  } else if (kcalFit > 0.7) {
    reasons.push(`${Math.round(macros.kcal)} kcal, proche des `
      + `${Math.round(budget.kcal)} kcal prévues pour ce repas.`);
  }

  // --- Fibres : un appoint, jamais un critère de tri principal --------
  const fibreNeed = budget.fiber_g > 0 ? clamp(macros.fiber_g / budget.fiber_g, 0, 1) : 0;
  if (macros.fiber_g >= 8) {
    reasons.push(`${Math.round(macros.fiber_g)} g de fibres.`);
  }

  // Densité protéique : départage deux recettes qui couvrent autant de
  // protéines, en faveur de celle qui coûte le moins de calories.
  const density = clamp((macros.protein_g / Math.max(1, macros.kcal)) * 1000 / 12, 0, 1);

  const score = (
    proteinScore * 0.45
    + kcalFit * 0.25
    + density * 0.15
    + fibreNeed * 0.10
    + (meetsThreshold ? 0.05 : 0)
  ) * (1 - Math.min(0.8, overshoot * 1.5));

  return {
    score: Math.round(score * 1000) / 1000,
    portion,
    macros,
    meets_protein_threshold: meetsThreshold,
    protein_coverage: Math.round(proteinCover * 100) / 100,
    reasons,
    warnings,
  };
}

/**
 * Classe les recettes d'un repas.
 *
 * @param {object} p
 * @param {Array}  p.recipes      candidates, macros par portion
 * @param {object} p.remaining    ce qu'il reste sur la journée
 * @param {number} p.mealsLeft    repas encore à prendre, celui-ci compris
 * @param {number} [p.bodyweightKg]
 * @param {number} [p.limit]
 */
export function suggestMeals({
  recipes = [], remaining = {}, mealsLeft = 1, bodyweightKg = null, limit = 6,
} = {}) {
  const budget = mealBudget(remaining, mealsLeft);

  const scored = recipes
    .map((recipe) => {
      const evaluation = scoreRecipe(recipe, budget, remaining, bodyweightKg);
      return evaluation ? { recipe, ...evaluation } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return {
    budget: {
      kcal: Math.round(budget.kcal),
      protein_g: Math.round(budget.protein_g * 10) / 10,
      fat_g: Math.round(budget.fat_g * 10) / 10,
      carbs_g: Math.round(budget.carbs_g * 10) / 10,
      fiber_g: Math.round(budget.fiber_g * 10) / 10,
      meals_left: budget.meals_left,
    },
    // Sans budget restant, la liste n'a plus de sens à trier : on le dit
    // plutôt que de proposer des repas qui feront tous déborder.
    exhausted: remaining.kcal != null && remaining.kcal <= 0,
    items: scored.slice(0, limit),
  };
}
