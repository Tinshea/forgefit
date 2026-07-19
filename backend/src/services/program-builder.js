// Générateur de programme, fondé sur les paramètres de `evidence.js`.
//
// Le raisonnement se fait en SÉRIES HEBDOMADAIRES PAR GROUPE MUSCULAIRE
// — l'unité sur laquelle porte la relation dose-réponse. Le nombre
// d'exercices par séance en découle, il n'est pas choisi a priori :
// deux programmes à 6 exercices peuvent différer du simple au double en
// volume réel.
//
// Chaîne complète :
//   score radar → volume hebdo visé → réparti sur N séances
//   → converti en exercices → dosé en séries/reps/charge

import { clamp } from './stats-math.js';
import {
  WEEKLY_SETS, FREQUENCY, GOALS, TIMED_WORK, SOURCES,
} from './evidence.js';

/**
 * Répartitions hebdomadaires.
 *
 * Chaque axe doit revenir au moins deux fois par semaine dès que le
 * nombre de jours le permet (cf. FREQUENCY) : c'est pourquoi les splits
 * à 4 jours et plus repassent sur les mêmes axes plutôt que d'ajouter
 * des journées isolées.
 */
const SPLITS = {
  2: [
    { title: 'Corps entier A', focus: 'push', axes: ['push', 'pull', 'legs'] },
    { title: 'Corps entier B', focus: 'legs', axes: ['legs', 'pull', 'push'] },
  ],
  3: [
    { title: 'Poussée', focus: 'push', axes: ['push', 'core'] },
    { title: 'Tirage', focus: 'pull', axes: ['pull'] },
    { title: 'Jambes', focus: 'legs', axes: ['legs', 'mobility'] },
  ],
  4: [
    { title: 'Haut du corps A', focus: 'push', axes: ['push', 'pull'] },
    { title: 'Bas du corps A', focus: 'legs', axes: ['legs', 'core'] },
    { title: 'Haut du corps B', focus: 'pull', axes: ['pull', 'push'] },
    { title: 'Bas du corps B', focus: 'legs', axes: ['legs', 'mobility', 'flexibility'] },
  ],
  5: [
    { title: 'Poussée lourde', focus: 'push', axes: ['push'] },
    { title: 'Tirage lourd', focus: 'pull', axes: ['pull'] },
    { title: 'Jambes', focus: 'legs', axes: ['legs', 'explosive'] },
    { title: 'Haut du corps volume', focus: 'push', axes: ['push', 'pull', 'core'] },
    { title: 'Bas du corps & mobilité', focus: 'legs', axes: ['legs', 'mobility', 'flexibility'] },
  ],
  6: [
    { title: 'Poussée lourde', focus: 'push', axes: ['push'] },
    { title: 'Tirage lourd', focus: 'pull', axes: ['pull'] },
    { title: 'Jambes lourdes', focus: 'legs', axes: ['legs'] },
    { title: 'Poussée volume', focus: 'push', axes: ['push', 'core'] },
    { title: 'Tirage volume', focus: 'pull', axes: ['pull'] },
    { title: 'Jambes & mobilité', focus: 'legs', axes: ['legs', 'mobility', 'flexibility'] },
  ],
};

const TIMED_AXES = new Set(['mobility', 'flexibility']);

/**
 * Volume hebdomadaire visé pour un axe, en séries.
 *
 * On part de la cible de l'objectif, puis on module selon le score :
 * un point faible monte vers le plafond récupérable, un point fort
 * redescend vers le volume d'entretien. Toujours borné par les repères
 * de la littérature — jamais sous l'entretien, jamais au-dessus du
 * plafond.
 */
export function weeklySetsFor(score, goalPreset) {
  const s = clamp(score ?? 0, 0, 100);
  const base = goalPreset.weeklySetsTarget;

  // Écart au médian : +50 % de volume à 0/100, −40 % à 100/100.
  const modifier = 1 + ((50 - s) / 100) * 0.9;
  const target = base * modifier;

  return Math.round(clamp(
    target,
    WEEKLY_SETS.maintenance,
    WEEKLY_SETS.maximumRecoverable,
  ));
}

/** Palier nommé, pour expliquer la décision. */
export function volumeVerdict(weeklySets) {
  if (weeklySets >= WEEKLY_SETS.adaptiveRange[1]) {
    return { label: 'Volume maximal', note: 'proche du plafond récupérable' };
  }
  if (weeklySets >= WEEKLY_SETS.minimumEffective) {
    return { label: 'Volume de progression', note: 'dans la fenêtre d’adaptation' };
  }
  return { label: 'Volume d’entretien', note: 'sous le seuil de progression, acquis conservés' };
}

/**
 * Construit la structure du programme.
 * @returns {{days: Array, preset: object, rationale: object}}
 */
export function buildProgram({ daysPerWeek = 4, goal = 'equilibre', scores = {} }) {
  const preset = GOALS[goal] ?? GOALS.equilibre;
  const split = SPLITS[clamp(daysPerWeek, 2, 6)] ?? SPLITS[4];

  // Combien de séances touchent chaque axe : c'est le diviseur qui
  // transforme un volume hebdomadaire en volume par séance.
  const sessionsPerAxis = new Map();
  for (const day of split) {
    for (const axis of day.axes) {
      sessionsPerAxis.set(axis, (sessionsPerAxis.get(axis) ?? 0) + 1);
    }
  }

  // Au-delà de 4 exercices pour un même axe dans une séance, on empile
  // des variantes redondantes du même muscle sans gain réel.
  const MAX_EXERCISES_PER_AXIS_PER_SESSION = 4;

  // Plan de volume, axe par axe.
  const volumePlan = new Map();
  for (const [axis, sessions] of sessionsPerAxis) {
    const timed = TIMED_AXES.has(axis);
    const timedSpec = TIMED_WORK[axis === 'mobility' ? 'mobility' : 'flexibility'];
    const setsPerExercise = timed ? timedSpec.setsPerExercise : preset.setsPerExercise;

    const requested = timed
      ? timedSpec.setsPerExercise * sessions * 2
      : weeklySetsFor(scores[axis], preset);

    // Volume maximal réellement livrable compte tenu de la fréquence.
    // Un axe vu une seule fois par semaine ne peut pas absorber 22
    // séries : promettre ce volume et n'en programmer que la moitié
    // serait un mensonge silencieux.
    const deliverableCap = MAX_EXERCISES_PER_AXIS_PER_SESSION * setsPerExercise * sessions;
    const weeklySets = Math.min(requested, deliverableCap);
    const cappedByFrequency = requested > deliverableCap;

    const exercisesPerSession = clamp(
      Math.round(weeklySets / sessions / setsPerExercise),
      1,
      MAX_EXERCISES_PER_AXIS_PER_SESSION,
    );

    volumePlan.set(axis, {
      axis,
      score: Math.round(clamp(scores[axis] ?? 0, 0, 100) * 10) / 10,
      requested_weekly_sets: requested,
      weekly_sets: weeklySets,
      sessions_per_week: sessions,
      sets_per_session: Math.round((weeklySets / sessions) * 10) / 10,
      sets_per_exercise: setsPerExercise,
      exercises_per_session: exercisesPerSession,
      // Volume réellement programmé, après arrondi en exercices entiers.
      actual_weekly_sets: exercisesPerSession * setsPerExercise * sessions,
      capped_by_frequency: cappedByFrequency,
      timed,
      ...volumeVerdict(weeklySets),
      meets_frequency: sessions >= FREQUENCY.minimumPerMuscle,
    });
  }

  const days = split.map((day, i) => ({
    day_index: i + 1,
    title: day.title,
    focus: day.focus,
    slots: day.axes.map((axis) => {
      const plan = volumePlan.get(axis);
      return {
        axis,
        count: plan.exercises_per_session,
        sets: plan.sets_per_exercise,
        reps: plan.timed ? null : preset.repsTarget,
        seconds: plan.timed
          ? TIMED_WORK[axis === 'mobility' ? 'mobility' : 'flexibility'].holdSeconds
          : null,
        rest: plan.timed ? 45 : preset.rest,
        intensity: preset.intensity,
        rir: preset.rir,
        plan,
      };
    }),
  }));

  const table = [...volumePlan.values()].sort((a, b) => a.score - b.score);
  const weakest = table.slice(0, 3).map((t) => ({ axis: t.axis, score: t.score }));
  const totalExercises = days.reduce(
    (s, d) => s + d.slots.reduce((n, x) => n + x.count, 0), 0,
  );
  const underFrequency = table.filter((t) => !t.meets_frequency && !t.timed);
  const capped = table.filter((t) => t.capped_by_frequency && !t.timed);

  return {
    days,
    preset,
    rationale: {
      goal,
      goal_label: preset.label,
      goal_rationale: preset.rationale,
      days_per_week: daysPerWeek,
      scores,
      weakest_axes: weakest,
      volume_table: table,
      total_exercises: totalExercises,
      total_weekly_sets: table.reduce((s, t) => s + t.actual_weekly_sets, 0),
      landmarks: {
        maintenance: WEEKLY_SETS.maintenance,
        minimum_effective: WEEKLY_SETS.minimumEffective,
        adaptive_range: WEEKLY_SETS.adaptiveRange,
        maximum_recoverable: WEEKLY_SETS.maximumRecoverable,
      },
      method: [
        'Le dosage se fait en séries hebdomadaires par groupe musculaire — '
          + 'l’unité sur laquelle porte la relation dose-réponse.',
        `Repères : ${WEEKLY_SETS.maintenance} séries pour entretenir, `
          + `${WEEKLY_SETS.minimumEffective} pour progresser, `
          + `${WEEKLY_SETS.adaptiveRange[0]}–${WEEKLY_SETS.adaptiveRange[1]} en fenêtre `
          + `d’adaptation, ${WEEKLY_SETS.maximumRecoverable} au maximum récupérable.`,
        `Objectif ${preset.label} : cible de ${preset.weeklySetsTarget} séries/semaine, `
          + `${preset.setsPerExercise} séries par exercice, ${preset.repsTarget} répétitions `
          + `à ≈ ${Math.round(preset.intensity * 100)} % du 1RM.`,
        'Un score bas augmente le volume vers le plafond récupérable ; un score '
          + 'élevé le ramène vers l’entretien. Jamais en dehors de ces bornes.',
        `Chaque muscle est travaillé au moins ${FREQUENCY.minimumPerMuscle} fois par `
          + 'semaine : à volume égal, répartir vaut mieux que concentrer.',
        `Séries arrêtées à ${preset.rir[0]}–${preset.rir[1]} répétitions de la réserve : `
          + 'l’échec n’apporte pas plus, il coûte plus en récupération.',
      ],
      sources: SOURCES,
      warnings: [
        ...(underFrequency.length
          ? [`${underFrequency.map((t) => t.axis).join(', ')} : une seule séance par `
            + `semaine. Avec ${daysPerWeek} jours, la fréquence recommandée de `
            + `${FREQUENCY.minimumPerMuscle}× n’est pas atteignable sur tous les axes.`]
          : []),
        ...(capped.length
          ? [`${capped.map((t) => t.axis).join(', ')} : volume limité par la fréquence. `
            + 'Ces axes mériteraient plus de séries que le nombre de séances ne permet '
            + 'd’en placer — ajouter un jour d’entraînement lèverait la contrainte.']
          : []),
      ],
      generated_at: new Date().toISOString(),
      summary: weakest.length
        ? `Volume renforcé sur ${weakest.map((w) => w.axis).join(', ')} — les scores les plus bas.`
        : 'Répartition équilibrée, aucun déficit marqué.',
    },
  };
}

/**
 * Charge conseillée, depuis le 1RM estimé.
 * Arrondie au pas de 2,5 kg : l'incrément réel des disques.
 */
export function suggestLoad(oneRepMaxKg, intensity) {
  if (!(oneRepMaxKg > 0)) return null;
  return Math.max(2.5, Math.round((oneRepMaxKg * intensity) / 2.5) * 2.5);
}

export { GOALS as GOAL_PRESETS };
