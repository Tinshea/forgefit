// Scoring athletique : 6 axes -> score /100 -> rang global.
//
// Deux familles d'axes, deux methodes :
//
//  - Force (poussee / tirage / jambes) : mesurable objectivement. On
//    convertit les series en 1RM estime, puis en percentile mondial via
//    les standards. Le score EST le percentile.
//
//  - Capacites (endurance / mobilite / explosivite) : aucun 1RM ne les
//    resume. On les note sur l'assiduite et le volume hebdomadaire,
//    rapportes a des cibles explicites (cf. TARGETS).

import { clamp } from './stats-math.js';
import { matchLift, estimateOneRepMax, percentileFor } from './strength-standards.js';

export const AXES = ['push', 'pull', 'legs', 'endurance', 'mobility', 'explosive'];

export const AXIS_LABELS_FR = {
  push: 'Force Poussée',
  pull: 'Force Tirage',
  legs: 'Jambes',
  endurance: 'Endurance',
  mobility: 'Mobilité',
  explosive: 'Explosivité',
};

/**
 * Cibles hebdomadaires valant 100/100.
 * Endurance : 150 min/semaine, seuil d'activite de l'OMS, atteint a 80 ;
 * le plafond exige davantage.
 */
const TARGETS = {
  enduranceMinutes: 200,
  enduranceSets: 20,      // le gainage compte dans l'endurance
  // Mobilite : la frequence prime largement sur la duree. Dix minutes
  // par jour valent mieux qu'une heure le dimanche.
  mobilitySessions: 4,
  mobilityMinutes: 60,
  // Souplesse : c'est le temps SOUS tension qui fait l'adaptation du
  // tissu, d'ou une cible en minutes plus haute et moins de poids sur
  // la frequence.
  flexibilitySessions: 3,
  flexibilityMinutes: 90,
  explosiveSets: 24,
};

const RANKS = [
  { min: 90, rank: 'S', label: 'Élite' },
  { min: 80, rank: 'A', label: 'Avancé' },
  { min: 70, rank: 'B', label: 'Confirmé' },
  { min: 60, rank: 'C', label: 'Intermédiaire' },
  { min: 50, rank: 'D', label: 'Novice' },
  { min: 40, rank: 'E', label: 'Débutant' },
  { min: 0, rank: 'F', label: 'Non classé' },
];

/** Rang correspondant a un score /100. */
export function scoreToRank(score) {
  const hit = RANKS.find((r) => score >= r.min) ?? RANKS[RANKS.length - 1];
  return { rank: hit.rank, label: hit.label, score };
}

/** Rang global : moyenne non ponderee des six axes. */
export function rankFor(axisScores) {
  const values = AXES.map((a) => axisScores[a] ?? 0);
  const overall = values.reduce((s, v) => s + v, 0) / values.length;
  return { ...scoreToRank(overall), overall };
}

/**
 * Score de force d'un axe a partir des series enregistrees.
 *
 * On retient la MEILLEURE performance par mouvement, puis la moyenne des
 * deux meilleurs mouvements de l'axe : un seul mouvement travaille ne
 * doit pas suffire a plafonner un axe entier, mais on ne penalise pas
 * non plus l'athlete qui ne pratique pas les douze references.
 */
export function scoreStrengthAxis(sets, { sex, bodyweightKg }) {
  if (!bodyweightKg || !sets.length) return { score: 0, details: [] };

  const bestByLift = new Map();

  for (const set of sets) {
    const lift = matchLift(set.name_fr ?? set.exercise_name ?? '');
    if (!lift) continue;

    const reps = Number(set.reps ?? 0);
    const weight = Number(set.weight_kg ?? 0);
    if (!reps) continue;

    const oneRm = estimateOneRepMax(weight, reps) ?? 0;
    const result = percentileFor({
      lift,
      sex,
      bodyweightKg,
      oneRepMaxKg: oneRm,
      addedWeightKg: weight,
    });
    if (!result) continue;

    const prev = bestByLift.get(lift);
    if (!prev || result.percentile > prev.percentile) {
      bestByLift.set(lift, {
        lift,
        percentile: result.percentile,
        ratio: result.ratio,
        level: result.level,
        oneRepMaxKg: Math.round(oneRm * 10) / 10,
      });
    }
  }

  const details = [...bestByLift.values()].sort((a, b) => b.percentile - a.percentile);
  if (!details.length) return { score: 0, details: [] };

  const topTwo = details.slice(0, 2);
  const score = topTwo.reduce((s, d) => s + d.percentile, 0) / topTwo.length;

  return { score: clamp(score, 0, 100), details };
}

/**
 * Score d'une capacite (endurance / mobilite / explosivite).
 * Progression concave : les premieres seances rapportent le plus, on
 * s'approche de 100 sans jamais l'atteindre par le seul volume.
 */
function capacityScore(value, target) {
  if (!(target > 0) || !(value > 0)) return 0;
  const ratio = value / target;
  // 1 - exp(-1.6 r) : ~80/100 a la cible, ~95 au double.
  return clamp((1 - Math.exp(-1.6 * ratio)) * 100, 0, 100);
}

/** Endurance : minutes cardio + volume de gainage. */
export function scoreEndurance({ cardioMinutes = 0, coreSets = 0 }) {
  const cardio = capacityScore(cardioMinutes, TARGETS.enduranceMinutes);
  const core = capacityScore(coreSets, TARGETS.enduranceSets);
  // Le cardio pese davantage que le gainage.
  return clamp(cardio * 0.7 + core * 0.3, 0, 100);
}

/** Mobilité (amplitude active) : régularité d'abord, volume ensuite. */
export function scoreMobility({ sessions = 0, minutes = 0 }) {
  const bySession = capacityScore(sessions, TARGETS.mobilitySessions);
  const byMinutes = capacityScore(minutes, TARGETS.mobilityMinutes);
  return clamp(bySession * 0.65 + byMinutes * 0.35, 0, 100);
}

/**
 * Souplesse (amplitude passive) : c'est le temps cumulé sous étirement
 * qui produit l'adaptation, la fréquence pèse donc moins que pour la
 * mobilité.
 */
export function scoreFlexibility({ sessions = 0, minutes = 0 }) {
  const bySession = capacityScore(sessions, TARGETS.flexibilitySessions);
  const byMinutes = capacityScore(minutes, TARGETS.flexibilityMinutes);
  return clamp(bySession * 0.35 + byMinutes * 0.65, 0, 100);
}

/**
 * Branche « Mobilité » du radar.
 *
 * Le radar reste un hexagone à 6 branches (spécification d'origine), on
 * y fusionne donc les deux qualités. La mobilité pèse un peu plus : une
 * amplitude utilisable sous contrôle protège mieux qu'une amplitude
 * passive que l'on ne sait pas tenir. Les deux scores restent exposés
 * séparément par l'API.
 */
export function combineMobility(mobilityScore, flexibilityScore) {
  return clamp(mobilityScore * 0.6 + flexibilityScore * 0.4, 0, 100);
}

/**
 * Explosivite : volume de mouvements explosifs, rehausse par la force
 * des jambes -- la puissance ne s'exprime pas sans force de base.
 */
export function scoreExplosive({ explosiveSets = 0, legsScore = 0 }) {
  const volume = capacityScore(explosiveSets, TARGETS.explosiveSets);
  return clamp(volume * 0.75 + legsScore * 0.25, 0, 100);
}

/**
 * Score de "Readiness" /100 : disponibilite a l'entrainement du jour.
 *
 * Croise trois familles de signaux, chacune neutre (valeur 50) quand la
 * donnee manque -- un capteur absent ne doit ni penaliser ni recompenser.
 *
 *   - Recuperation : fatigue musculaire recente issue des logs.
 *   - Physiologie  : VFC, sommeil, repos cardiaque (objets connectes).
 *   - Hygiene      : hydratation, mobilite.
 */
export function computeReadiness({
  fatigueIndex = null,   // 0 = frais, 1 = tres fatigue
  sleepHours = null,
  hrvMs = null,
  hrvBaselineMs = null,
  restingHr = null,
  restingHrBaseline = null,
  hydrationRatio = null, // consomme / objectif
  mobilityMinutes7d = null,
} = {}) {
  const parts = [];
  const push = (label, value, weight) => {
    if (value === null || Number.isNaN(value)) return;
    parts.push({ label, value: clamp(value, 0, 100), weight });
  };

  // Recuperation musculaire : l'inverse de la fatigue accumulee.
  if (fatigueIndex !== null) {
    push('recuperation', (1 - clamp(fatigueIndex, 0, 1)) * 100, 0.30);
  }

  // Sommeil : optimum a 8 h, penalite symetrique en deca et au-dela.
  if (sleepHours !== null) {
    const deficit = Math.abs(sleepHours - 8);
    push('sommeil', 100 - deficit * 18, 0.25);
  }

  // VFC : lue en ecart relatif a la ligne de base personnelle. Une VFC
  // brute n'a aucun sens comparee entre individus.
  if (hrvMs !== null && hrvBaselineMs) {
    const delta = (hrvMs - hrvBaselineMs) / hrvBaselineMs;
    push('vfc', 50 + delta * 250, 0.25);
  }

  // Frequence cardiaque de repos : une hausse signale une recuperation
  // incomplete, le signe est donc inverse.
  if (restingHr !== null && restingHrBaseline) {
    const delta = (restingHr - restingHrBaseline) / restingHrBaseline;
    push('fc_repos', 50 - delta * 400, 0.10);
  }

  if (hydrationRatio !== null) {
    push('hydratation', clamp(hydrationRatio, 0, 1.2) * 85, 0.05);
  }

  if (mobilityMinutes7d !== null) {
    push('mobilite', capacityScore(mobilityMinutes7d, TARGETS.mobilityMinutes), 0.05);
  }

  if (!parts.length) {
    return { score: null, rank: null, contributions: [], note: 'Données insuffisantes' };
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;

  return {
    score: Math.round(score * 10) / 10,
    ...scoreToRank(score),
    contributions: parts.map((p) => ({
      label: p.label,
      value: Math.round(p.value * 10) / 10,
      // Poids renormalise sur les signaux reellement disponibles.
      weight: Math.round((p.weight / totalWeight) * 100) / 100,
    })),
  };
}


