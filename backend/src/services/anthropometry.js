// Mesures corporelles et indices dérivés.
//
// ┌─ POURQUOI LA TAILLE COMPTE ───────────────────────────────────────┐
// │ Katch-McArdle (370 + 21,6 × masse maigre) est la formule la plus  │
// │ juste pour qui connaît son taux de masse grasse. Mais la plupart  │
// │ des gens ne le connaissent pas, et sans lui la formule ne peut    │
// │ pas être appliquée du tout.                                       │
// │                                                                    │
// │ Mifflin-St Jeor prend en entrée taille, poids, âge et sexe — des  │
// │ données que tout le monde possède. C'est le repli, et c'est là    │
// │ que la taille devient indispensable.                              │
// │                                                                    │
// │ La taille sert aussi à l'IMC et surtout au FFMI, qui rapporte la  │
// │ masse maigre au carré de la taille : un athlète de 1,90 m et un   │
// │ de 1,65 m avec la même masse maigre ne sont pas comparables.      │
// └────────────────────────────────────────────────────────────────────┘

import { clamp } from './stats-math.js';

/**
 * Métabolisme de base — Mifflin-St Jeor.
 *
 *   homme : 10×poids + 6,25×taille − 5×âge + 5
 *   femme : 10×poids + 6,25×taille − 5×âge − 161
 *
 * Reconnue comme la plus fiable des formules ne demandant pas la
 * composition corporelle.
 */
export function mifflinStJeor({ weightKg, heightCm, age, sex }) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'female') return base - 161;
  if (sex === 'male') return base + 5;
  // Sexe non renseigné : moyenne des deux, plutôt que de supposer.
  return base - 78;
}

/** Métabolisme de base — Katch-McArdle, sur la masse maigre. */
export function katchMcArdle(leanMassKg) {
  if (!(leanMassKg > 0)) return null;
  return 370 + 21.6 * leanMassKg;
}

/**
 * Choisit la meilleure formule disponible et dit laquelle.
 *
 * L'utilisateur doit savoir sur quelle base son objectif est calculé :
 * un chiffre sans sa méthode n'est pas vérifiable.
 */
export function estimateBmr({ leanMassKg, weightKg, heightCm, age, sex }) {
  const katch = katchMcArdle(leanMassKg);
  if (katch) {
    return {
      bmr: Math.round(katch * 10) / 10,
      method: 'katch-mcardle',
      method_label: 'Katch-McArdle (masse maigre)',
      precision: 'haute',
      note: 'Calculée sur ta masse maigre — la plus précise.',
    };
  }

  const mifflin = mifflinStJeor({ weightKg, heightCm, age, sex });
  if (mifflin) {
    return {
      bmr: Math.round(mifflin * 10) / 10,
      method: 'mifflin-st-jeor',
      method_label: 'Mifflin-St Jeor (taille, poids, âge)',
      precision: 'moyenne',
      note: 'Renseigne ton taux de masse grasse pour passer à '
        + 'Katch-McArdle, plus précise.',
    };
  }

  const missing = [];
  if (!(weightKg > 0)) missing.push('poids');
  if (!(heightCm > 0)) missing.push('taille');
  if (!(age > 0)) missing.push('date de naissance');

  return {
    bmr: null,
    method: null,
    method_label: null,
    precision: null,
    note: `Renseigne ${missing.join(', ')} pour estimer ta dépense.`,
    missing,
  };
}

/** Indice de masse corporelle. */
export function bmi(weightKg, heightCm) {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/**
 * Interprétation de l'IMC, avec sa limite explicite.
 *
 * L'IMC ne distingue pas muscle et graisse. Un pratiquant de force
 * entraîné sort régulièrement en « surpoids » sans excès de masse
 * grasse : le signaler évite un contresens.
 */
export function bmiCategory(value, { muscular = false } = {}) {
  if (value == null) return null;
  let label;
  if (value < 18.5) label = 'Insuffisance pondérale';
  else if (value < 25) label = 'Corpulence normale';
  else if (value < 30) label = 'Surpoids';
  else label = 'Obésité';

  return {
    value,
    label,
    caveat: muscular && value >= 25
      ? 'L’IMC ne distingue pas muscle et graisse : chez une personne '
        + 'entraînée, il surestime l’adiposité. Le FFMI est plus parlant.'
      : null,
  };
}

/**
 * FFMI — indice de masse maigre, normalisé à 1,80 m.
 *
 *   FFMI = masse maigre / taille²
 *   normalisé = FFMI + 6,1 × (1,80 − taille)
 *
 * C'est l'équivalent musculaire de l'IMC. Il permet de comparer des
 * gabarits différents, là où la masse maigre brute avantage
 * mécaniquement les grands.
 */
export function ffmi(leanMassKg, heightCm) {
  if (!(leanMassKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  const raw = leanMassKg / (m * m);
  const normalized = raw + 6.1 * (1.8 - m);
  return {
    raw: Math.round(raw * 10) / 10,
    normalized: Math.round(normalized * 10) / 10,
  };
}

/**
 * Repères de FFMI normalisé.
 * Autour de 25 se situe la limite couramment admise du développement
 * musculaire naturel ; au-delà, elle reste possible mais rare.
 */
export function ffmiCategory(normalized, sex) {
  if (normalized == null) return null;
  const scale = sex === 'female'
    ? [[13, 'Peu musclée'], [15, 'Moyenne'], [17, 'Athlétique'], [19, 'Très musclée'], [Infinity, 'Exceptionnelle']]
    : [[18, 'Peu musclé'], [20, 'Moyen'], [22, 'Athlétique'], [25, 'Très musclé'], [Infinity, 'Exceptionnel']];
  const hit = scale.find(([max]) => normalized < max);
  return hit ? hit[1] : null;
}

/** Masse maigre depuis poids et taux de masse grasse. */
export function leanMass(weightKg, bodyFatPct) {
  if (!(weightKg > 0) || bodyFatPct == null) return null;
  return Math.round(weightKg * (1 - clamp(bodyFatPct, 0, 70) / 100) * 100) / 100;
}

/**
 * Objectif d'hydratation, proportionnel au poids.
 *
 * Une valeur fixe de 2,5 L convient à une personne de 70 kg et sous-dose
 * nettement quelqu'un de 95 kg. Base retenue : 35 ml/kg/jour, plus un
 * supplément pour les séances d'entraînement (pertes sudorales).
 */
export function hydrationTarget(weightKg, { trainingMinutes = 0 } = {}) {
  if (!(weightKg > 0)) return { ml: 2500, basis: 'valeur par défaut, poids inconnu' };
  const base = weightKg * 35;
  const training = (trainingMinutes / 60) * 600;
  return {
    ml: Math.round((base + training) / 50) * 50,
    base_ml: Math.round(base / 50) * 50,
    training_ml: Math.round(training / 50) * 50,
    basis: `35 ml/kg${trainingMinutes > 0 ? ' + 600 ml par heure d’entraînement' : ''}`,
  };
}

/** Âge en années, depuis la date de naissance. */
export function ageFrom(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const years = diff / (365.2425 * 24 * 3600 * 1000);
  return years > 0 && years < 130 ? Math.floor(years) : null;
}

/** Ensemble des indices dérivés, pour l'écran de profil. */
export function deriveMetrics({
  weightKg, heightCm, bodyFatPct, birthDate, sex, trainingMinutes = 0,
  // Masse maigre mesurée directement (DEXA, balance à impédance). Elle
  // prime sur celle déduite du taux de masse grasse.
  leanMassKg = null,
}) {
  const age = ageFrom(birthDate);
  const lean = leanMassKg ?? leanMass(weightKg, bodyFatPct);
  const bmiValue = bmi(weightKg, heightCm);
  const ffmiValue = ffmi(lean, heightCm);

  return {
    age,
    lean_mass_kg: lean,
    fat_mass_kg: lean != null && weightKg
      ? Math.round((weightKg - lean) * 100) / 100
      : null,
    bmi: bmiCategory(bmiValue, { muscular: ffmiValue?.normalized >= 20 }),
    ffmi: ffmiValue
      ? { ...ffmiValue, label: ffmiCategory(ffmiValue.normalized, sex) }
      : null,
    bmr: estimateBmr({ leanMassKg: lean, weightKg, heightCm, age, sex }),
    hydration: hydrationTarget(weightKg, { trainingMinutes }),
  };
}
