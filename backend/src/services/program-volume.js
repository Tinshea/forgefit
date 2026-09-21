// Volume hebdomadaire d'un programme, muscle par muscle.
//
// ┌─ POURQUOI PAS « NOMBRE D'EXERCICES » ─────────────────────────────┐
// │ L'unité de dosage est la SÉRIE HEBDOMADAIRE PAR MUSCLE            │
// │ (cf. evidence.js). Deux programmes à six exercices peuvent        │
// │ différer du simple au double en volume réel, et un programme qui  │
// │ « fait du dos » trois fois par semaine peut très bien laisser les │
// │ dorsaux sous le seuil d'entretien pendant que les biceps          │
// │ explosent le plafond.                                             │
// │                                                                    │
// │ Compter par muscle est la seule façon de voir ça.                 │
// └────────────────────────────────────────────────────────────────────┘

import { WEEKLY_SETS, FREQUENCY } from './evidence.js';

/**
 * Poids d'un muscle secondaire dans le compte de séries.
 *
 * Même valeur que la vue `muscle_load_recent` : la charge affichée sur
 * la heatmap et le volume affiché sur le programme doivent compter la
 * même chose, sinon les deux écrans se contredisent.
 *
 * 0,4 est un choix assumé, pas une mesure. Un muscle secondaire travaille
 * réellement, mais moins et rarement dans sa position la plus favorable.
 */
export const SECONDARY_WEIGHT = 0.4;

/** Muscles qui ne relèvent pas d'un dosage en séries. */
const NOT_A_MUSCLE = new Set(['cardiovascular system']);

/**
 * Verdict de dose-réponse pour un volume hebdomadaire.
 *
 * Les seuils viennent de `evidence.js`, qui porte les références.
 */
export function volumeVerdict(sets) {
  if (sets < WEEKLY_SETS.maintenance) {
    return {
      level: 'sous-entretien',
      label: 'Sous l’entretien',
      note: `Moins de ${WEEKLY_SETS.maintenance} séries par semaine : `
        + 'de quoi entretenir difficilement, pas de quoi progresser.',
    };
  }
  if (sets < WEEKLY_SETS.minimumEffective) {
    return {
      level: 'entretien',
      label: 'Entretien',
      note: `Entre ${WEEKLY_SETS.maintenance} et ${WEEKLY_SETS.minimumEffective} `
        + 'séries : les acquis tiennent, la progression est lente.',
    };
  }
  if (sets <= WEEKLY_SETS.adaptiveRange[1]) {
    return {
      level: 'adaptation',
      label: 'Fenêtre d’adaptation',
      note: `${WEEKLY_SETS.minimumEffective} séries et plus : la zone où le `
        + 'volume produit son meilleur effet.',
    };
  }
  if (sets <= WEEKLY_SETS.maximumRecoverable) {
    return {
      level: 'haut',
      label: 'Volume haut',
      note: 'Rendement décroissant. Tenable en bloc de spécialisation, '
        + 'pas toute l’année.',
    };
  }
  return {
    level: 'plafond',
    label: 'Au-dessus du plafond',
    note: `Au-delà de ${WEEKLY_SETS.maximumRecoverable} séries, c’est la `
      + 'récupération qui limite, plus le stimulus.',
  };
}

/**
 * Agrège les séries hebdomadaires par muscle.
 *
 * @param {Array} days  jours du programme, chacun avec ses `items`
 * @returns {{muscles, total_sets, aerobic_minutes, warnings}}
 */
export function programVolume(days = []) {
  /** @type {Map<string, {sets:number, primary_sets:number, days:Set}>} */
  const byMuscle = new Map();
  let aerobicMinutes = 0;
  let totalSets = 0;

  const bump = (muscle, sets, dayKey, isPrimary) => {
    if (!muscle || NOT_A_MUSCLE.has(muscle)) return;
    const entry = byMuscle.get(muscle)
      ?? { sets: 0, primary_sets: 0, days: new Set() };
    entry.sets += sets;
    if (isPrimary) entry.primary_sets += sets;
    // La fréquence se compte en JOURS distincts, pas en exercices : trois
    // mouvements de pectoraux le même jour font une séance, pas trois.
    entry.days.add(dayKey);
    byMuscle.set(muscle, entry);
  };

  for (const day of days) {
    const dayKey = day.id ?? day.day_index;
    for (const item of day.items ?? []) {
      const sets = Number(item.target_sets ?? 0);

      // Travail chronométré : il se dose en minutes, pas en séries.
      // Le compter comme des séries gonflerait artificiellement le
      // volume d'un programme de mobilité.
      if (item.target_seconds > 0 && !(sets > 0)) continue;
      if (item.discipline === 'cardio') {
        aerobicMinutes += (Number(item.target_seconds ?? 0) * Math.max(1, sets)) / 60;
        continue;
      }
      if (!(sets > 0)) continue;

      totalSets += sets;
      bump(item.target, sets, dayKey, true);
      for (const secondary of item.secondary_muscles ?? []) {
        if (secondary === item.target) continue;
        bump(secondary, sets * SECONDARY_WEIGHT, dayKey, false);
      }
    }
  }

  const round = (v) => Math.round(v * 10) / 10;

  const muscles = [...byMuscle.entries()]
    .map(([muscle, e]) => ({
      muscle,
      weekly_sets: round(e.sets),
      primary_sets: round(e.primary_sets),
      // Séries obtenues UNIQUEMENT comme muscle secondaire : un muscle
      // qui n'atteint son volume qu'en accompagnement n'est pas entraîné,
      // il est sollicité. La distinction compte.
      secondary_sets: round(e.sets - e.primary_sets),
      sessions_per_week: e.days.size,
      ...volumeVerdict(e.sets),
    }))
    .sort((a, b) => b.weekly_sets - a.weekly_sets);

  const warnings = [];
  const under = muscles.filter((m) => m.primary_sets > 0 && m.level === 'sous-entretien');
  if (under.length) {
    warnings.push(`Travaillés mais sous le seuil d’entretien : `
      + `${under.map((m) => m.muscle).join(', ')}.`);
  }
  const over = muscles.filter((m) => m.level === 'plafond');
  if (over.length) {
    warnings.push(`Au-dessus du plafond de récupération : `
      + `${over.map((m) => m.muscle).join(', ')}.`);
  }
  const rare = muscles.filter(
    (m) => m.primary_sets >= WEEKLY_SETS.minimumEffective
      && m.sessions_per_week < FREQUENCY.minimumPerMuscle,
  );
  if (rare.length) {
    warnings.push(`Tout le volume sur une seule séance : `
      + `${rare.map((m) => m.muscle).join(', ')}. À volume égal, le répartir sur `
      + `${FREQUENCY.minimumPerMuscle} séances donne mieux.`);
  }

  return {
    muscles,
    total_sets: round(totalSets),
    aerobic_minutes: Math.round(aerobicMinutes),
    warnings,
    thresholds: {
      maintenance: WEEKLY_SETS.maintenance,
      minimum_effective: WEEKLY_SETS.minimumEffective,
      adaptive_range: WEEKLY_SETS.adaptiveRange,
      maximum_recoverable: WEEKLY_SETS.maximumRecoverable,
      secondary_weight: SECONDARY_WEIGHT,
    },
  };
}
