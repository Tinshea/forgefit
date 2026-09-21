// Paramètres nutritionnels issus de la littérature.
//
// Même exigence que `evidence.js` côté entraînement : chaque valeur
// porte sa source. Un « coach nutritionnel » qui sort des chiffres sans
// référence n'est qu'une opinion présentée comme un calcul.
//
// ⚠️ Ces repères valent pour un adulte en bonne santé qui s'entraîne.
// Ils ne remplacent pas un avis médical, et ne conviennent pas en cas de
// pathologie rénale, de grossesse, de trouble du comportement
// alimentaire ou de traitement en cours.

export const REFERENCES = {
  morton2018protein: {
    citation: 'Morton RW, Murphy KT, McKellar SR, et al. (2018). A systematic review, '
      + 'meta-analysis and meta-regression of the effect of protein supplementation on '
      + 'resistance training-induced gains in muscle mass and strength in healthy adults. '
      + 'British Journal of Sports Medicine, 52(6), 376–384.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
    claim: 'Au-delà de ≈ 1,6 g de protéines par kg de poids et par jour, aucun gain '
      + 'supplémentaire de masse maigre n’a été observé ; l’intervalle de confiance monte '
      + 'à ≈ 2,2 g/kg.',
  },
  schoenfeld2018distribution: {
    citation: 'Schoenfeld BJ, Aragon AA (2018). How much protein can the body use in a '
      + 'single meal for muscle-building ? Implications for daily protein distribution. '
      + 'Journal of the International Society of Sports Nutrition, 15, 10.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29497353/',
    claim: '≈ 0,4 g de protéines par kg et par repas, sur au moins quatre repas : c’est '
      + 'la répartition, pas seulement le total, qui soutient la synthèse protéique.',
  },
  helms2014deficit: {
    citation: 'Helms ER, Zinn C, Rowlands DS, Brown SR (2014). A systematic review of '
      + 'dietary protein during caloric restriction in resistance trained lean athletes: '
      + 'a case for higher intakes. International Journal of Sport Nutrition and Exercise '
      + 'Metabolism, 24(2), 127–138.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24092765/',
    claim: 'En déficit calorique, les besoins montent à 2,3–3,1 g par kg de MASSE MAIGRE, '
      + 'd’autant plus haut que le déficit est marqué et la personne déjà sèche.',
  },
  efsaFibre: {
    citation: 'EFSA Panel on Dietetic Products, Nutrition and Allergies (2010). Scientific '
      + 'opinion on dietary reference values for carbohydrates and dietary fibre. '
      + 'EFSA Journal, 8(3), 1462.',
    url: 'https://www.efsa.europa.eu/en/efsajournal/pub/1462',
    claim: '25 g de fibres par jour suffisent au transit intestinal chez l’adulte ; les '
      + 'apports plus élevés sont associés à d’autres bénéfices de santé.',
  },
  who2020: {
    citation: 'OMS (2020). Lignes directrices sur l’activité physique et la sédentarité.',
    url: 'https://www.who.int/publications/i/item/9789240015128',
    claim: 'L’activité physique et l’alimentation se jugent ensemble : ni l’une ni '
      + 'l’autre ne compense seule l’absence de la seconde.',
  },
};

/**
 * Protéines.
 *
 * Deux régimes distincts, et c'est la distinction qui compte :
 *  - à l'entretien ou en surplus, la cible se rapporte au POIDS DE CORPS ;
 *  - en déficit, elle se rapporte à la MASSE MAIGRE et monte nettement,
 *    parce que l'enjeu n'est plus de construire mais de ne pas perdre.
 */
export const PROTEIN = {
  perKgBodyweight: { min: 1.6, max: 2.2, plateau: 1.62 },
  deficitPerKgLeanMass: { min: 2.3, max: 3.1 },
  // Par repas, rapporté au poids de corps.
  perMealPerKg: 0.4,
  minimumMealsPerDay: 4,
  sources: ['morton2018protein', 'schoenfeld2018distribution', 'helms2014deficit'],
};

/** Fibres : plancher de référence européen. */
export const FIBRE = {
  dailyMinimumG: 25,
  comfortableRangeG: [25, 35],
  sources: ['efsaFibre'],
};

/**
 * Répartition des protéines sur la journée.
 *
 * @param {number} proteinTargetG cible quotidienne
 * @param {number} bodyweightKg   poids de corps, pour le seuil par repas
 * @param {number} meals          nombre de repas réellement pris
 */
export function proteinPerMeal(proteinTargetG, bodyweightKg, meals = 4) {
  const count = Math.max(1, Math.round(meals));
  const even = proteinTargetG / count;
  const threshold = bodyweightKg > 0 ? PROTEIN.perMealPerKg * bodyweightKg : null;

  return {
    meals: count,
    per_meal_g: Math.round(even * 10) / 10,
    threshold_g: threshold ? Math.round(threshold * 10) / 10 : null,
    // Un total suffisant réparti sur deux repas ne vaut pas le même
    // total sur quatre : c'est le point de l'étude de répartition.
    meets_threshold: threshold ? even >= threshold : null,
    meets_frequency: count >= PROTEIN.minimumMealsPerDay,
  };
}

/**
 * Contrôle des cibles quotidiennes face aux repères.
 *
 * Renvoie des CONSTATS, pas des corrections : les cibles restent celles
 * de l'utilisateur. Signaler un écart et le corriger en douce sont deux
 * choses différentes, et la seconde rendrait le calcul invérifiable.
 */
export function reviewTargets({
  targets, goal, leanMassKg = null, weightKg = null,
} = {}) {
  if (!targets) return { checks: [], sources: [] };

  const checks = [];
  const used = new Set();

  const protein = Number(targets.protein_g ?? 0);
  const reference = weightKg ?? (leanMassKg ? leanMassKg / 0.85 : null);

  if (goal === 'perte' && leanMassKg > 0) {
    const perKg = protein / leanMassKg;
    const { min, max } = PROTEIN.deficitPerKgLeanMass;
    used.add('helms2014deficit');
    checks.push({
      key: 'protein_deficit',
      label: 'Protéines en déficit',
      value: `${Math.round(perKg * 100) / 100} g/kg de masse maigre`,
      ok: perKg >= min,
      note: perKg >= min
        ? `Dans la fourchette ${min}–${max} g/kg de masse maigre recommandée en déficit.`
        : `Sous le plancher de ${min} g/kg de masse maigre. En déficit, c’est la masse `
          + 'maigre qui paie en premier : monter les protéines la protège.',
      source: 'helms2014deficit',
    });
  } else if (reference > 0) {
    const perKg = protein / reference;
    const { min, max } = PROTEIN.perKgBodyweight;
    used.add('morton2018protein');
    checks.push({
      key: 'protein_daily',
      label: 'Protéines quotidiennes',
      value: `${Math.round(perKg * 100) / 100} g/kg de poids de corps`,
      ok: perKg >= min,
      note: perKg >= min
        ? (perKg > max
          ? `Au-dessus de ${max} g/kg : sans danger connu, mais aucun gain supplémentaire `
            + 'n’a été observé au-delà de ce niveau.'
          : `Dans la fourchette ${min}–${max} g/kg.`)
        : `Sous ${min} g/kg, le seuil au-delà duquel les gains de masse maigre cessent `
          + 'de progresser avec l’apport.',
      source: 'morton2018protein',
    });
  }

  if (reference > 0) {
    const perMeal = proteinPerMeal(protein, reference, PROTEIN.minimumMealsPerDay);
    used.add('schoenfeld2018distribution');
    checks.push({
      key: 'protein_distribution',
      label: 'Répartition sur la journée',
      value: `${perMeal.per_meal_g} g sur ${perMeal.meals} repas`,
      ok: perMeal.meets_threshold !== false,
      note: perMeal.meets_threshold === false
        ? `Sous le seuil de ${perMeal.threshold_g} g par repas. Le total compte, mais `
          + 'la répartition aussi : tout concentrer sur deux repas en gaspille une partie.'
        : `Au-dessus du seuil de ${perMeal.threshold_g} g par repas, sur au moins `
          + `${PROTEIN.minimumMealsPerDay} repas.`,
      source: 'schoenfeld2018distribution',
    });
  }

  const fibre = Number(targets.fiber_g ?? 0);
  used.add('efsaFibre');
  checks.push({
    key: 'fibre',
    label: 'Fibres',
    value: `${fibre} g par jour`,
    ok: fibre >= FIBRE.dailyMinimumG,
    note: fibre >= FIBRE.dailyMinimumG
      ? `Au-dessus du plancher de référence de ${FIBRE.dailyMinimumG} g.`
      : `Sous le plancher de référence de ${FIBRE.dailyMinimumG} g par jour.`,
    source: 'efsaFibre',
  });

  return {
    checks,
    sources: [...used].map((key) => ({ key, ...REFERENCES[key] })),
    disclaimer: 'Repères pour un adulte en bonne santé qui s’entraîne. Ils ne remplacent '
      + 'pas un avis médical, et ne conviennent pas en cas de pathologie rénale, de '
      + 'grossesse, de trouble du comportement alimentaire ou de traitement en cours.',
  };
}
