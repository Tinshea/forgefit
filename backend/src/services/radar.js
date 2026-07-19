// Calcul du radar athlétique.
//
// Extrait de la route pour être appelable directement par le générateur
// de programme. Une route qui s'appelle elle-même en HTTP dépendrait de
// son propre port, du réseau et de sa propre disponibilité — pour un
// calcul purement local.

import { query } from '../db.js';
import {
  AXES, AXIS_LABELS_FR, rankFor, scoreStrengthAxis, scoreEndurance,
  scoreMobility, scoreFlexibility, combineMobility, scoreExplosive,
} from './scoring.js';
import { REFERENCE_POPULATION } from './strength-standards.js';

async function loadProfile(userId) {
  const { rows } = await query(
    'SELECT id, display_name, sex, bodyweight_kg FROM users WHERE id = $1',
    [userId],
  );
  return rows[0] ?? null;
}

async function loadSets(userId, days) {
  const { rows } = await query(
    `SELECT ws.weight_kg, ws.reps, ws.duration_s, ws.completed_at,
            e.name_fr, e.axis, e.discipline, e.target
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
       JOIN exercises e        ON e.id = ws.exercise_id
      WHERE s.user_id = $1
        AND ws.is_warmup = FALSE
        AND ws.completed_at > now() - ($2 || ' days')::interval`,
    [userId, String(days)],
  );
  return rows;
}

/** @returns la charge utile complète du radar (axes, rang, décomposition). */
export async function computeRadar(userId, days = 90) {
  const profile = await loadProfile(userId);
  const sets = await loadSets(userId, days);

  // Les capacités se jugent sur la semaine écoulée : un mois de mobilité
  // interrompu depuis trois semaines ne doit pas gonfler le score.
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recent = sets.filter((s) => new Date(s.completed_at).getTime() >= weekAgo);

  const byAxis = (axis) => sets.filter((s) => s.axis === axis);
  const opts = {
    sex: profile?.sex ?? 'unspecified',
    bodyweightKg: Number(profile?.bodyweight_kg) || null,
  };

  const push = scoreStrengthAxis(byAxis('push'), opts);
  const pull = scoreStrengthAxis(byAxis('pull'), opts);
  const legs = scoreStrengthAxis(byAxis('legs'), opts);

  const cardioMinutes = recent
    .filter((s) => s.axis === 'endurance')
    .reduce((sum, s) => sum + (Number(s.duration_s) || 0) / 60, 0);
  const coreSets = recent.filter((s) => s.axis === 'core').length;

  const capacityOf = (axis) => {
    const list = recent.filter((s) => s.axis === axis);
    return {
      minutes: list.reduce((sum, s) => sum + (Number(s.duration_s) || 0) / 60, 0),
      sessions: new Set(
        list.map((s) => new Date(s.completed_at).toISOString().slice(0, 10)),
      ).size,
      sets: list.length,
    };
  };

  const mob = capacityOf('mobility');
  const flex = capacityOf('flexibility');
  const mobilityScore = scoreMobility({ sessions: mob.sessions, minutes: mob.minutes });
  const flexibilityScore = scoreFlexibility({ sessions: flex.sessions, minutes: flex.minutes });
  const explosiveSets = recent.filter((s) => s.axis === 'explosive').length;

  const scores = {
    push: push.score,
    pull: pull.score,
    legs: legs.score,
    endurance: scoreEndurance({ cardioMinutes, coreSets }),
    mobility: combineMobility(mobilityScore, flexibilityScore),
    explosive: scoreExplosive({ explosiveSets, legsScore: legs.score }),
  };

  const rounded = Object.fromEntries(
    Object.entries(scores).map(([k, v]) => [k, Math.round(v * 10) / 10]),
  );

  return {
    axes: AXES.map((axis) => ({
      axis, label: AXIS_LABELS_FR[axis], score: rounded[axis],
    })),
    scores: rounded,
    ...rankFor(scores),
    details: { push: push.details, pull: pull.details, legs: legs.details },
    mobility_breakdown: {
      mobilite: {
        score: Math.round(mobilityScore * 10) / 10,
        sessions_7d: mob.sessions,
        minutes_7d: Math.round(mob.minutes),
        sets_7d: mob.sets,
      },
      souplesse: {
        score: Math.round(flexibilityScore * 10) / 10,
        sessions_7d: flex.sessions,
        minutes_7d: Math.round(flex.minutes),
        sets_7d: flex.sets,
      },
    },
    // Scores par axe utilisés en interne (gainage, souplesse séparée) :
    // le générateur de programme en a besoin, le radar ne les affiche pas.
    internal_scores: {
      ...rounded,
      core: Math.round(scoreEndurance({ cardioMinutes: 0, coreSets }) * 10) / 10,
      mobility: Math.round(mobilityScore * 10) / 10,
      flexibility: Math.round(flexibilityScore * 10) / 10,
    },
    window_days: days,
    profile: profile
      ? { sex: profile.sex, bodyweight_kg: Number(profile.bodyweight_kg) }
      : null,
    reference: REFERENCE_POPULATION,
  };
}
