// Calibration de la dépense énergétique sur données réelles.
//
// ┌─ POURQUOI CE FICHIER EXISTE ──────────────────────────────────────┐
// │ Toutes les formules de `anthropometry.js` sont des PRÉDICTIONS :  │
// │ elles estiment ce que dépense une personne moyenne partageant tes │
// │ caractéristiques. Toi, tu n'es pas la moyenne, et l'écart typique │
// │ est de l'ordre de ±10 %.                                          │
// │                                                                    │
// │ Or le corps tient la comptabilité exacte. Le bilan énergétique     │
// │ s'écrit :                                                          │
// │                                                                    │
// │     énergie stockée = énergie ingérée − énergie dépensée           │
// │                                                                    │
// │ Ce qui se réarrange en :                                           │
// │                                                                    │
// │     dépense = apport moyen − (Δ poids × 7 700 / nombre de jours)   │
// │                                                                    │
// │ Un mois de journal alimentaire et de pesées vaut mieux que         │
// │ n'importe quelle équation — à condition de dire honnêtement quand  │
// │ les données ne suffisent pas.                                      │
// └────────────────────────────────────────────────────────────────────┘

/**
 * Densité énergétique du tissu adipeux : ≈ 7 700 kcal par kilogramme.
 *
 * Valeur de Wishnofsky (1958). Elle est APPROXIMATIVE et ne vaut que
 * pour une variation composée majoritairement de graisse : une reprise
 * de masse maigre, ou un simple changement de stock de glycogène, ne
 * coûte pas le même prix énergétique. C'est la principale source
 * d'erreur de cette méthode, et c'est pourquoi on exige une fenêtre
 * longue — le glycogène et l'eau oscillent, la graisse dérive.
 */
export const KCAL_PER_KG = 7700;

/** En deçà, le bruit hydrique dépasse le signal. */
export const MIN_DAYS = 14;
/** Deux pesées ne font pas une tendance. */
export const MIN_WEIGHTS = 6;
/** Une journée non journalisée n'est pas une journée à zéro calorie. */
export const MIN_COVERAGE = 0.8;

/**
 * Régression linéaire des moindres carrés.
 *
 * Préférée à « dernier poids moins premier » : une seule pesée un jour
 * de rétention d'eau décalerait la pente de plusieurs centaines de
 * kcal/jour. La régression répartit l'influence sur toutes les mesures.
 *
 * @param {Array<{x:number,y:number}>} points
 */
export function linearFit(points) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // Écart-type des résidus : mesure la régularité de la tendance.
  // Élevé, il signale des pesées erratiques — donc une pente peu sûre.
  const residuals = points.map((p) => p.y - (slope * p.x + intercept));
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const tss = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);

  return {
    slope,
    intercept,
    n,
    r2: tss === 0 ? null : Math.max(0, 1 - rss / tss),
    // Erreur type de la pente : sert à borner l'incertitude de la
    // dépense calculée, au lieu d'annoncer un chiffre rond trompeur.
    slope_se: n > 2 ? Math.sqrt(rss / (n - 2) / sxx) : null,
  };
}

const dayIndex = (iso, origin) => Math.round(
  (Date.parse(`${iso}T00:00:00Z`) - origin) / 86400000,
);

const round = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/**
 * Dépense réelle estimée depuis le journal et les pesées.
 *
 * @param {object} p
 * @param {Array<{date:string, kcal:number}>} p.intake   apports journaliers
 * @param {Array<{date:string, weight_kg:number}>} p.weights
 * @param {number} [p.predictedTdee] dépense prédite, pour comparaison
 * @param {number} [p.bmr]           métabolisme de base, pour en déduire
 *                                   le multiplicateur d'activité RÉEL
 */
export function calibrateTdee({
  intake = [], weights = [], predictedTdee = null, bmr = null,
} = {}) {
  const logged = intake.filter((d) => Number(d.kcal) > 0);
  const scale = weights
    .filter((w) => Number(w.weight_kg) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const reasons = [];

  if (scale.length < MIN_WEIGHTS) {
    reasons.push(`${scale.length} pesée${scale.length > 1 ? 's' : ''} sur la période, `
      + `il en faut au moins ${MIN_WEIGHTS}.`);
  }
  if (logged.length < MIN_DAYS) {
    reasons.push(`${logged.length} jour${logged.length > 1 ? 's' : ''} de journal `
      + `alimentaire, il en faut au moins ${MIN_DAYS}.`);
  }

  if (reasons.length) {
    return {
      ok: false, reasons, tdee: null,
      // Ce qu'il reste à faire, chiffré : « pèse-toi encore 4 fois » est
      // actionnable là où « données insuffisantes » ne l'est pas.
      needed: {
        weights: Math.max(0, MIN_WEIGHTS - scale.length),
        logged_days: Math.max(0, MIN_DAYS - logged.length),
      },
    };
  }

  const origin = Date.parse(`${scale[0].date}T00:00:00Z`);
  const fit = linearFit(scale.map((w) => ({
    x: dayIndex(w.date, origin),
    y: Number(w.weight_kg),
  })));
  if (!fit) return { ok: false, reasons: ['Pesées toutes le même jour.'], tdee: null };

  const spanDays = dayIndex(scale[scale.length - 1].date, origin);
  if (spanDays < MIN_DAYS) {
    return {
      ok: false, tdee: null,
      reasons: [`Les pesées ne couvrent que ${spanDays} jours, il en faut ${MIN_DAYS}.`],
      needed: { span_days: MIN_DAYS - spanDays },
    };
  }

  // Les apports doivent couvrir LA MÊME période que la tendance de
  // poids : moyenner sur des jours situés hors de la fenêtre de pesée
  // mélangerait deux régimes alimentaires différents.
  const from = scale[0].date;
  const to = scale[scale.length - 1].date;
  const window = logged.filter((d) => d.date >= from && d.date <= to);

  // Couverture : les jours sans journal ne sont PAS des jours à zéro.
  // On moyenne sur les jours journalisés, et on refuse si le journal est
  // trop troué — quelques jours oubliés sont presque toujours les plus
  // gros, et leur omission fait paraître la dépense plus basse.
  const coverage = window.length / (spanDays + 1);
  if (coverage < MIN_COVERAGE) {
    return {
      ok: false, tdee: null,
      reasons: [`Journal rempli ${Math.round(coverage * 100)} % des jours de la `
        + `période. En dessous de ${Math.round(MIN_COVERAGE * 100)} %, la moyenne `
        + 'des apports est sous-estimée — ce sont rarement les petites journées '
        + 'qu’on oublie de noter.'],
      coverage: round(coverage, 2),
    };
  }

  const meanIntake = window.reduce((s, d) => s + Number(d.kcal), 0) / window.length;
  const kgPerDay = fit.slope;
  const tdee = meanIntake - kgPerDay * KCAL_PER_KG;

  // Incertitude : propagée depuis l'erreur type de la pente, qui domine
  // très largement celle de la moyenne des apports.
  const marginKcal = fit.slope_se != null
    ? Math.abs(fit.slope_se * KCAL_PER_KG)
    : null;

  const weeklyKg = kgPerDay * 7;

  return {
    ok: true,
    tdee: round(tdee),
    margin_kcal: round(marginKcal),
    range: marginKcal != null
      ? [round(tdee - marginKcal), round(tdee + marginKcal)]
      : null,
    mean_intake_kcal: round(meanIntake),
    from,
    to,
    trend_kg_per_week: round(weeklyKg, 3),
    span_days: spanDays,
    logged_days: window.length,
    weigh_ins: scale.length,
    coverage: round(coverage, 2),
    // R² bas = pesées erratiques. Ce n'est pas disqualifiant, mais la
    // marge s'élargit et il faut le dire.
    trend_quality: fit.r2 == null ? null : round(fit.r2, 2),
    predicted_tdee: round(predictedTdee),
    // L'écart prédiction / mesure est le vrai enseignement : il dit de
    // combien la formule se trompe SUR TOI.
    prediction_error_kcal: predictedTdee ? round(tdee - predictedTdee) : null,
    prediction_error_pct: predictedTdee
      ? round(((tdee - predictedTdee) / predictedTdee) * 100, 1)
      : null,
    // Multiplicateur d'activité réel, à confronter au multiplicateur
    // déclaré (1,375 « léger », 1,55 « modéré »…).
    activity_multiplier: bmr > 0 ? round(tdee / bmr, 3) : null,
    reasons: [],
  };
}

/**
 * Traduit la calibration en phrases.
 *
 * Séparé du calcul : les tests portent sur les nombres, l'interface sur
 * les mots, et mélanger les deux rend les deux plus durs à changer.
 */
const fr = (v) => String(v).replace('.', ',');

export function explainCalibration(result, { declaredMultiplier = null } = {}) {
  if (!result?.ok) return result?.reasons ?? [];

  const lines = [
    `Sur ${result.span_days} jours : ${result.mean_intake_kcal} kcal avalées en `
    + `moyenne, poids en ${result.trend_kg_per_week < 0 ? 'baisse' : 'hausse'} de `
    + `${fr(Math.abs(result.trend_kg_per_week))} kg par semaine.`,
    `Dépense réelle : ${result.tdee} kcal par jour`
    + (result.range ? ` (entre ${result.range[0]} et ${result.range[1]}).` : '.'),
  ];

  if (result.prediction_error_kcal != null) {
    const sign = result.prediction_error_kcal >= 0 ? 'sous-estime' : 'surestime';
    lines.push(`La formule ${sign} ta dépense de `
      + `${Math.abs(result.prediction_error_kcal)} kcal `
      + `(${fr(Math.abs(result.prediction_error_pct))} %).`);
  }

  if (declaredMultiplier && result.activity_multiplier) {
    const delta = result.activity_multiplier - declaredMultiplier;
    if (Math.abs(delta) >= 0.05) {
      lines.push(`Ton multiplicateur d’activité réel est `
        + `${fr(result.activity_multiplier)}, tu as déclaré ${fr(declaredMultiplier)}.`);
    }
  }

  if (result.trend_quality != null && result.trend_quality < 0.3) {
    lines.push('Tes pesées sont irrégulières : la tendance est peu nette et la '
      + 'marge d’erreur large. Pèse-toi à heure fixe, à jeun.');
  }

  return lines;
}
