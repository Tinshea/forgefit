// Mesures corporelles et indices dérivés.
//
// ┌─ POURQUOI LA TAILLE COMPTE ───────────────────────────────────────┐
// │ Les formules assises sur la masse maigre (Katch-McArdle,          │
// │ Cunningham) demandent un taux de masse grasse que tout le monde   │
// │ n'a pas. Sans lui, elles ne peuvent pas être appliquées du tout.  │
// │                                                                    │
// │ Mifflin-St Jeor et Harris-Benedict prennent en entrée taille,     │
// │ poids, âge et sexe — des données que tout le monde possède. Ce    │
// │ sont les replis, et c'est là que la taille devient indispensable. │
// │                                                                    │
// │ La taille sert aussi à l'IMC et surtout au FFMI, qui rapporte la  │
// │ masse maigre au carré de la taille : un athlète de 1,90 m et un   │
// │ de 1,65 m avec la même masse maigre ne sont pas comparables.      │
// └────────────────────────────────────────────────────────────────────┘

import { clamp } from './stats-math.js';

/**
 * ┌─ POURQUOI PLUSIEURS FORMULES ─────────────────────────────────────┐
 * │ Aucune équation prédictive n'est « la bonne ». Validées contre    │
 * │ calorimétrie indirecte, les meilleures placent environ deux tiers │
 * │ des sujets à ±10 % de leur dépense réelle — et se trompent de     │
 * │ plus de 10 % pour le tiers restant. Sur 1 700 kcal, ±10 % font    │
 * │ ±170 kcal, soit largement de quoi transformer un déficit visé en  │
 * │ maintien.                                                          │
 * │                                                                    │
 * │ D'où trois principes ici :                                        │
 * │   1. la formule est un CHOIX, affiché et modifiable ;             │
 * │   2. l'écart entre formules est montré, pas masqué ;              │
 * │   3. la calibration sur données réelles (cf. tdee-calibration.js) │
 * │      prime sur toute prédiction dès qu'elle est possible.         │
 * └────────────────────────────────────────────────────────────────────┘
 */

/**
 * Métabolisme de base — Mifflin-St Jeor (1990).
 *
 *   homme : 10×poids + 6,25×taille − 5×âge + 5
 *   femme : 10×poids + 6,25×taille − 5×âge − 161
 *
 * La plus fiable des formules ne demandant pas la composition
 * corporelle, et celle que recommandent les sociétés de diététique.
 */
export function mifflinStJeor({ weightKg, heightCm, age, sex }) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'female') return base - 161;
  if (sex === 'male') return base + 5;
  // Sexe non renseigné : moyenne des deux, plutôt que de supposer.
  return base - 78;
}

/**
 * Harris-Benedict révisée — Roza & Shizgal (1984).
 *
 * La révision de 1984 corrige l'originale de 1919, établie sur une
 * population plus maigre et plus active, qui surestimait d'environ 5 %.
 * Reste légèrement plus haute que Mifflin sur la plupart des profils.
 */
export function harrisBenedict({ weightKg, heightCm, age, sex }) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  const male = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  const female = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age;
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return (male + female) / 2;
}

/**
 * Owen (1986) : poids seul.
 *
 *   homme : 879 + 10,2 × poids      femme : 795 + 7,18 × poids
 *
 * Volontairement rustique — ni taille ni âge. Elle sert de repère bas :
 * quand elle s'écarte beaucoup des autres, c'est que le gabarit sort de
 * l'ordinaire, et la prédiction est d'autant moins fiable.
 */
export function owen({ weightKg, sex }) {
  if (!(weightKg > 0)) return null;
  if (sex === 'female') return 795 + 7.18 * weightKg;
  if (sex === 'male') return 879 + 10.2 * weightKg;
  return (879 + 10.2 * weightKg + 795 + 7.18 * weightKg) / 2;
}

/** Métabolisme de base — Katch-McArdle, sur la masse maigre. */
export function katchMcArdle(leanMassKg) {
  if (!(leanMassKg > 0)) return null;
  return 370 + 21.6 * leanMassKg;
}

/**
 * Cunningham (1980) : 500 + 22 × masse maigre.
 *
 * Même entrée que Katch-McArdle mais systématiquement plus haute —
 * environ +90 kcal à 60 kg de masse maigre. Établie sur une population
 * entraînée, elle est celle que retiennent le plus souvent les travaux
 * en nutrition sportive. Chez un sujet sédentaire, elle surestime.
 */
export function cunningham(leanMassKg) {
  if (!(leanMassKg > 0)) return null;
  return 500 + 22 * leanMassKg;
}

/**
 * Registre des formules.
 *
 * `needs` sert à l'interface : elle peut dire ce qui manque pour
 * débloquer une méthode au lieu de la griser sans explication.
 * `rank` fixe l'ordre de repli automatique, du plus au moins informé.
 */
export const BMR_FORMULAS = {
  'katch-mcardle': {
    label: 'Katch-McArdle',
    short: 'Masse maigre',
    rank: 1,
    needs: ['masse maigre'],
    unlock: 'ton taux de masse grasse',
    precision: 'haute',
    formula: '370 + 21,6 × masse maigre',
    source: 'Katch & McArdle (1996), Exercise Physiology',
    rationale: 'Prend en entrée le tissu métaboliquement actif plutôt que '
      + 'le poids total. À poids égal, deux compositions corporelles '
      + 'différentes ne dépensent pas la même chose.',
    compute: ({ leanMassKg }) => katchMcArdle(leanMassKg),
  },
  cunningham: {
    label: 'Cunningham',
    short: 'Masse maigre, sportifs',
    rank: 2,
    needs: ['masse maigre'],
    unlock: 'ton taux de masse grasse',
    precision: 'haute',
    formula: '500 + 22 × masse maigre',
    source: 'Cunningham (1980), Am J Clin Nutr',
    rationale: 'Établie sur une population entraînée. Rend environ 90 kcal '
      + 'de plus que Katch-McArdle : à préférer si tu constates que tu '
      + 'perds plus vite que prévu.',
    compute: ({ leanMassKg }) => cunningham(leanMassKg),
  },
  'mifflin-st-jeor': {
    label: 'Mifflin-St Jeor',
    short: 'Taille, poids, âge',
    rank: 3,
    needs: ['poids', 'taille', 'date de naissance'],
    precision: 'moyenne',
    formula: '10×poids + 6,25×taille − 5×âge ± constante',
    source: 'Mifflin et al. (1990), Am J Clin Nutr',
    rationale: 'La référence quand la composition corporelle est inconnue. '
      + 'N’exige que des mesures que tout le monde possède.',
    compute: mifflinStJeor,
  },
  'harris-benedict': {
    label: 'Harris-Benedict révisée',
    short: 'Taille, poids, âge',
    rank: 4,
    needs: ['poids', 'taille', 'date de naissance'],
    precision: 'moyenne',
    formula: '88,36 + 13,40×poids + 4,80×taille − 5,68×âge (homme)',
    source: 'Roza & Shizgal (1984), Am J Clin Nutr',
    rationale: 'Révision de l’équation de 1919. Rend un peu plus que '
      + 'Mifflin sur la plupart des profils.',
    compute: harrisBenedict,
  },
  owen: {
    label: 'Owen',
    short: 'Poids seul',
    rank: 5,
    needs: ['poids'],
    precision: 'basse',
    formula: '879 + 10,2 × poids (homme)',
    source: 'Owen et al. (1986/1987), Am J Clin Nutr',
    rationale: 'Ni taille ni âge. Sert de garde-fou : un gros écart avec '
      + 'les autres signale un gabarit atypique, donc une prédiction peu '
      + 'fiable quelle que soit la formule.',
    compute: owen,
  },
};

/** Ordre de repli : la mieux informée d'abord. */
const FALLBACK_ORDER = Object.entries(BMR_FORMULAS)
  .sort((a, b) => a[1].rank - b[1].rank)
  .map(([key]) => key);

const round1 = (v) => Math.round(v * 10) / 10;

/** Ce qui manque pour appliquer une formule donnée. */
function missingFor(key, { leanMassKg, weightKg, heightCm, age }) {
  const have = {
    'masse maigre': leanMassKg > 0,
    poids: weightKg > 0,
    taille: heightCm > 0,
    'date de naissance': age > 0,
  };
  return BMR_FORMULAS[key].needs.filter((n) => !have[n]);
}

/**
 * Applique toutes les formules applicables.
 *
 * Renvoie aussi les non applicables, avec ce qui leur manque : une
 * méthode absente sans explication ressemble à un bug.
 */
export function compareBmrMethods(inputs) {
  const rows = FALLBACK_ORDER.map((key) => {
    const spec = BMR_FORMULAS[key];
    const missing = missingFor(key, inputs);
    const value = missing.length ? null : spec.compute(inputs);
    return {
      key,
      label: spec.label,
      short: spec.short,
      formula: spec.formula,
      source: spec.source,
      rationale: spec.rationale,
      precision: spec.precision,
      bmr: value == null ? null : round1(value),
      available: value != null,
      missing,
    };
  });

  const values = rows.filter((r) => r.available).map((r) => r.bmr);
  return {
    methods: rows,
    // L'écart entre formules EST l'information : il donne l'ordre de
    // grandeur de l'incertitude, que choisir une seule formule masque.
    spread: values.length > 1
      ? {
        min: Math.min(...values),
        max: Math.max(...values),
        delta: round1(Math.max(...values) - Math.min(...values)),
      }
      : null,
  };
}

/**
 * Choisit une formule et dit laquelle.
 *
 * `method` force un choix ; 'auto' (ou absent) prend la mieux informée
 * des formules applicables. Un choix forcé mais inapplicable retombe
 * automatiquement ET le signale — sinon l'utilisateur croirait ses
 * cibles calculées avec une méthode qui n'a jamais tourné.
 *
 * `measuredBmr` court-circuite tout : une valeur mesurée ou calibrée
 * n'est pas une prédiction, elle n'a pas à être devinée.
 */
export function estimateBmr({
  leanMassKg, weightKg, heightCm, age, sex,
  method = 'auto', measuredBmr = null,
}) {
  const inputs = { leanMassKg, weightKg, heightCm, age, sex };

  if (measuredBmr > 0) {
    return {
      bmr: round1(measuredBmr),
      method: 'mesure',
      method_label: 'Mesure personnelle',
      precision: 'mesurée',
      requested: method,
      fell_back: false,
      note: 'Valeur saisie ou calibrée sur tes données : aucune formule '
        + 'prédictive n’est utilisée.',
    };
  }

  const requested = method && method !== 'auto' && BMR_FORMULAS[method] ? method : null;
  const order = requested
    ? [requested, ...FALLBACK_ORDER.filter((k) => k !== requested)]
    : FALLBACK_ORDER;

  for (const key of order) {
    const missing = missingFor(key, inputs);
    if (missing.length) continue;
    const spec = BMR_FORMULAS[key];
    const fellBack = !!requested && key !== requested;
    const requestedMissing = fellBack ? missingFor(requested, inputs) : [];

    // En mode automatique, la formule retenue n'est pas forcément la
    // meilleure existante — seulement la meilleure APPLICABLE. Le dire,
    // et nommer la mesure qui débloquerait la suivante : sans cela,
    // l'utilisateur n'a aucune raison de soupçonner qu'il existe mieux.
    let upgrade = null;
    if (!requested) {
      const better = FALLBACK_ORDER.slice(0, FALLBACK_ORDER.indexOf(key))
        .map((k) => ({ key: k, missing: missingFor(k, inputs) }))
        .find((c) => c.missing.length);
      if (better) {
        const spec2 = BMR_FORMULAS[better.key];
        // `needs` nomme l'ENTRÉE de la formule, `unlock` nomme le champ
        // que l'utilisateur remplit réellement. Personne ne saisit une
        // masse maigre : on saisit un taux de masse grasse, dont elle
        // se déduit.
        upgrade = `Renseigne ${spec2.unlock ?? better.missing.join(', ')} pour `
          + `passer à ${spec2.label}, plus précise.`;
      }
    }

    return {
      bmr: round1(spec.compute(inputs)),
      method: key,
      method_label: `${spec.label} (${spec.short.toLowerCase()})`,
      precision: spec.precision,
      formula: spec.formula,
      source: spec.source,
      requested: method,
      fell_back: fellBack,
      upgrade,
      note: fellBack
        ? `${BMR_FORMULAS[requested].label} demande ${requestedMissing.join(', ')} : `
          + `calcul fait avec ${spec.label} en attendant.`
        : (upgrade ?? spec.rationale),
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
    requested: method,
    fell_back: false,
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
  bmrMethod = 'auto',
  measuredBmr = null,
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
    bmr: estimateBmr({
      leanMassKg: lean, weightKg, heightCm, age, sex,
      method: bmrMethod, measuredBmr,
    }),
    // Toutes les formules côte à côte : l'écart entre elles est ce qui
    // dit combien vaut vraiment le chiffre retenu.
    bmr_methods: compareBmrMethods({ leanMassKg: lean, weightKg, heightCm, age, sex }),
    hydration: hydrationTarget(weightKg, { trainingMinutes }),
  };
}
