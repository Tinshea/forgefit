// Calcul des besoins nutritionnels.
//
// Modèle repris du tableur de l'utilisateur, dont les valeurs ont été
// recalculées et confirmées :
//   masse maigre 63,5 kg → BMR 1741,6 → TDEE 2394,7 → cible 2035,5 kcal
//   protéines 139,7 g · lipides 50,8 g · glucides 254,9 g
//
// Le choix structurant est d'asseoir TOUT sur la masse maigre plutôt que
// sur le poids total. Deux personnes de 80 kg à 12 % et 30 % de masse
// grasse n'ont ni le même métabolisme de base ni les mêmes besoins
// protéiques ; rapporter les g/kg au poids total surestimerait
// nettement la seconde.

import { clamp } from './stats-math.js';
import { estimateBmr, katchMcArdle } from './anthropometry.js';

/**
 * Densité énergétique des macronutriments, en kcal par gramme.
 *
 * La valeur des fibres vient du règlement européen 1169/2011 : 2 kcal/g.
 * Ce ne sont pas des calories nulles — les fibres fermentescibles sont
 * partiellement métabolisées par le microbiote.
 */
const KCAL_PER_GRAM = {
  fat: 9,
  carbs: 4,
  protein: 4,
  fiber: 2,
};

/**
 * Multiplicateurs d'activité (Harris-Benedict révisé).
 * Ce sont les valeurs du tableur, et les valeurs usuelles.
 */
export const ACTIVITY_MULTIPLIERS = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  intense: 1.725,
};

export const ACTIVITY_LABELS = {
  sedentaire: 'Sédentaire — bureau, peu de marche',
  leger: 'Léger — 1 à 3 séances par semaine',
  modere: 'Modéré — 3 à 5 séances par semaine',
  intense: 'Intense — 6 séances ou plus, travail physique',
};

/**
 * Paramètres par objectif : g/kg de MASSE MAIGRE et ajustement calorique.
 * Repris tels quels du tableur.
 */
export const GOAL_SETTINGS = {
  perte: {
    label: 'Perte de masse grasse',
    proteinPerKg: 2.2,
    fatPerKg: 0.8,
    calorieFactor: 0.85,
    // Protéines hautes en déficit : elles préservent la masse maigre
    // quand l'apport énergétique baisse.
    note: 'Déficit de 15 %. Protéines élevées pour préserver le muscle.',
  },
  maintien: {
    label: 'Maintien',
    proteinPerKg: 1.8,
    fatPerKg: 1.0,
    calorieFactor: 1.0,
    note: 'Apport aligné sur la dépense estimée.',
  },
  prise: {
    label: 'Prise de masse',
    proteinPerKg: 1.8,
    fatPerKg: 1.1,
    calorieFactor: 1.1,
    note: 'Surplus de 10 %, suffisant pour construire sans excès de gras.',
  },
};

/**
 * Métabolisme de base — Katch-McArdle.
 *
 *   BMR = 370 + 21,6 × masse maigre (kg)
 *
 * Préférée à Mifflin-St Jeor ici parce qu'elle prend la masse maigre en
 * entrée : c'est le tissu métaboliquement actif. Elle exige en revanche
 * de connaître son taux de masse grasse.
 */
/** Dépense énergétique totale : BMR × multiplicateur d'activité. */
function totalDailyExpenditure(bmr, activity) {
  if (!(bmr > 0)) return null;
  const multiplier = ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS.leger;
  return bmr * multiplier;
}

// La masse maigre et le métabolisme de base vivent dans
// `anthropometry.js` : les redéfinir ici créait deux implémentations de
// la même formule, qui pouvaient diverger.

/**
 * Cibles journalières complètes.
 *
 * Ordre de calcul, identique au tableur :
 *   1. protéines et lipides fixés en g/kg de masse maigre ;
 *   2. glucides = reliquat calorique.
 * Les glucides absorbent donc l'ajustement — c'est le macronutriment le
 * moins critique à l'échelle de la journée.
 *
 * @returns {{targets, breakdown, inputs}|null}
 */
export function computeTargets({
  leanMassKg,
  // Repli quand la masse maigre est inconnue : Mifflin-St Jeor n'exige
  // que des mesures que tout le monde possède.
  weightKg = null,
  heightCm = null,
  age = null,
  sex = null,
  goal = 'maintien',
  activity = 'leger',
  kcalOverride = null,
  proteinOverrideG = null,
  fatOverrideG = null,
  fiberTargetG = 30,
} = {}) {
  const settings = GOAL_SETTINGS[goal] ?? GOAL_SETTINGS.maintien;
  const estimate = estimateBmr({ leanMassKg, weightKg, heightCm, age, sex });

  if (!estimate.bmr) {
    return { targets: null, note: estimate.note, bmr_method: null };
  }

  const bmr = estimate.bmr;
  const tdee = totalDailyExpenditure(bmr, activity);

  // Les cibles de macros s'expriment en g/kg de masse maigre. Sans
  // masse maigre connue, on retombe sur le poids total en abaissant les
  // coefficients : appliquer 2,2 g/kg de protéines au poids total
  // surestimerait les besoins de quelqu'un ayant beaucoup de masse
  // grasse. Le facteur 0,85 approche le rapport masse maigre/poids
  // d'une personne moyennement composée.
  const macroBaseKg = leanMassKg > 0 ? leanMassKg : (weightKg ?? 0) * 0.85;
  const macroBasis = leanMassKg > 0 ? 'masse maigre' : 'poids total ajusté';
  const kcal = kcalOverride ?? tdee * settings.calorieFactor;

  const proteinG = proteinOverrideG ?? settings.proteinPerKg * macroBaseKg;
  const fatG = fatOverrideG ?? settings.fatPerKg * macroBaseKg;

  const proteinKcal = proteinG * KCAL_PER_GRAM.protein;
  const fatKcal = fatG * KCAL_PER_GRAM.fat;
  const carbsKcal = kcal - proteinKcal - fatKcal;

  // Un objectif calorique très bas combiné à des protéines et lipides
  // élevés peut rendre le reliquat négatif : on borne à zéro et on le
  // signale plutôt que d'afficher des glucides négatifs.
  const carbsG = Math.max(0, carbsKcal / KCAL_PER_GRAM.carbs);
  const infeasible = carbsKcal < 0;

  const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

  return {
    targets: {
      kcal: round(kcal),
      protein_g: round(proteinG),
      fat_g: round(fatG),
      carbs_g: round(carbsG),
      fiber_g: round(fiberTargetG),
    },
    bmr_method: {
      method: estimate.method,
      label: estimate.method_label,
      precision: estimate.precision,
      note: estimate.note,
    },
    breakdown: {
      bmr: round(bmr),
      tdee: round(tdee),
      macro_basis: macroBasis,
      macro_base_kg: round(macroBaseKg, 2),
      calorie_factor: settings.calorieFactor,
      protein_kcal: round(proteinKcal),
      fat_kcal: round(fatKcal),
      carbs_kcal: round(Math.max(0, carbsKcal)),
      protein_per_kg: settings.proteinPerKg,
      fat_per_kg: settings.fatPerKg,
      activity_multiplier: ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS.leger,
    },
    inputs: {
      lean_mass_kg: leanMassKg > 0 ? round(leanMassKg, 2) : null,
      weight_kg: weightKg ? round(weightKg, 2) : null,
      height_cm: heightCm ? round(heightCm, 1) : null,
      age,
      goal,
      goal_label: settings.label,
      goal_note: settings.note,
      activity,
      activity_label: ACTIVITY_LABELS[activity],
      overridden: {
        kcal: kcalOverride != null,
        protein: proteinOverrideG != null,
        fat: fatOverrideG != null,
      },
    },
    warnings: infeasible
      ? ['Les protéines et lipides visés dépassent à eux seuls l’objectif '
        + 'calorique : il ne reste aucun glucide. Relève les calories ou '
        + 'baisse les lipides.']
      : [],
    method: [
      `Métabolisme de base — ${estimate.method_label} : ${round(bmr)} kcal.`,
      `Dépense totale : BMR × ${ACTIVITY_MULTIPLIERS[activity] ?? 1.375} (${activity}).`,
      `Objectif calorique : dépense × ${settings.calorieFactor} (${settings.label.toLowerCase()}).`,
      `Protéines ${settings.proteinPerKg} g/kg et lipides ${settings.fatPerKg} g/kg `
        + `de ${macroBasis}.`,
      'Glucides : ce qu’il reste de calories, divisé par 4.',
    ],
  };
}

/** Macros d'une portion, depuis la fiche d'un aliment. */
export function scaleFood(food, quantity) {
  const ref = Number(food.reference_qty) || 100;
  const factor = Number(quantity) / ref;
  const scale = (v) => Math.round((Number(v ?? 0) * factor) * 100) / 100;

  return {
    kcal: scale(food.kcal),
    fat_g: scale(food.fat_g),
    carbs_g: scale(food.carbs_g),
    protein_g: scale(food.protein_g),
    fiber_g: scale(food.fiber_g),
    price_eur: food.price_eur == null
      ? null
      : Math.round(Number(food.price_eur) * factor * 1000) / 1000,
  };
}

/**
 * Contrôle de cohérence d'une fiche aliment.
 *
 * Les calories déclarées doivent correspondre aux macronutriments à
 * ±15 % près. Un écart plus grand signale une saisie erronée — cas
 * fréquent sur les données collaboratives, où un gramme se glisse à la
 * place d'un décigramme.
 */
export function validateFoodCoherence(food) {
  const fat = Number(food.fat_g ?? 0);
  const carbs = Number(food.carbs_g ?? 0);
  const protein = Number(food.protein_g ?? 0);
  const fiber = Number(food.fiber_g ?? 0);
  const declared = Number(food.kcal ?? 0);

  // Les fibres sont COMPTÉES DANS les glucides (convention de la table
  // source, et de l'étiquetage nord-américain). Les facturer à 4 kcal/g
  // comme des glucides assimilables surestime l'énergie de tous les
  // légumes et légumineuses — les aliments les plus fibreux étant
  // précisément ceux qu'on veut suivre.
  const availableCarbs = Math.max(0, carbs - fiber);
  const computed = fat * KCAL_PER_GRAM.fat
    + availableCarbs * KCAL_PER_GRAM.carbs
    + protein * KCAL_PER_GRAM.protein
    + fiber * KCAL_PER_GRAM.fiber;

  // Les fibres étant une fraction des glucides, elles ne peuvent pas
  // les dépasser.
  if (fiber > carbs + 0.01) {
    return {
      ok: false, computed: Math.round(computed * 10) / 10, declared, drift: null,
      message: `Fibres (${fiber} g) supérieures aux glucides (${carbs} g) : `
        + 'les fibres sont une fraction des glucides.',
    };
  }

  // En dessous de quelques calories, l'écart relatif n'a plus de sens :
  // un soda sans sucre à 0,3 kcal afficherait 100 % de dérive.
  if (declared < 5 && computed < 5) {
    return { ok: true, computed: Math.round(computed * 10) / 10, declared, drift: 0 };
  }
  if (declared === 0) {
    return { ok: false, computed, declared, drift: null,
      message: 'Calories nulles alors que des macronutriments sont renseignés.' };
  }

  const drift = Math.abs(computed - declared) / declared;
  return {
    ok: drift <= 0.15,
    computed: Math.round(computed * 10) / 10,
    declared,
    drift: Math.round(drift * 1000) / 10,
    message: drift > 0.15
      ? `Les macros donnent ${Math.round(computed)} kcal contre ${declared} déclarées `
        + `(${Math.round(drift * 100)} % d’écart).`
      : null,
  };
}
