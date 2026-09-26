import { query } from '../db.js';
import { computeReadiness } from './scoring.js';
import { hydrationTarget } from './anthropometry.js';

/**
 * Rassemble les signaux de disponibilité, et rend le score.
 *
 * ┌─ POURQUOI EXTRAIT D'UNE ROUTE ────────────────────────────────────┐
 * │ Ce calcul vivait dans `GET /api/stats/readiness`. Le coach en a   │
 * │ besoin aussi — c'est même ce qui rend l'entraînement adaptatif.   │
 * │                                                                    │
 * │ Une première version le récupérait par un APPEL HTTP du serveur à │
 * │ lui-même. Cela marchait, et cassait dès que l'instance devenait   │
 * │ protégée : l'appel interne ne porte pas de session, il recevait   │
 * │ un 401, et la disponibilité retombait silencieusement à `null`.   │
 * │ Un chaînon qui disparaît sans rien dire est pire qu'un chaînon    │
 * │ absent.                                                            │
 * │                                                                    │
 * │ Les deux appelants passent maintenant par cette fonction. Une     │
 * │ seule formule, un seul chiffre : l'écran Aperçu et le coach ne    │
 * │ peuvent pas se contredire.                                        │
 * └────────────────────────────────────────────────────────────────────┘
 */
export async function disponibiliteDe(userId) {
  // Dernière valeur par type, sur trois jours.
  const { rows: metrics } = await query(
    `SELECT DISTINCT ON (metric_type) metric_type, magnitude, recorded_at
       FROM health_metrics
      WHERE user_id = $1 AND magnitude IS NOT NULL
        AND recorded_at > now() - INTERVAL '3 days'
      ORDER BY metric_type, recorded_at DESC`,
    [userId],
  );

  // Ligne de base personnelle sur trente jours : une VFC brute ne
  // signifie rien comparée entre individus, seul l'écart à sa propre
  // moyenne informe.
  const { rows: baselines } = await query(
    `SELECT metric_type, AVG(magnitude)::numeric AS baseline
       FROM health_metrics
      WHERE user_id = $1 AND magnitude IS NOT NULL
        AND recorded_at > now() - INTERVAL '30 days'
      GROUP BY metric_type`,
    [userId],
  );

  const latest = Object.fromEntries(metrics.map((m) => [m.metric_type, Number(m.magnitude)]));
  const base = Object.fromEntries(baselines.map((b) => [b.metric_type, Number(b.baseline)]));

  const { rows: fatigueRows } = await query(
    'SELECT fatigue_raw FROM muscle_load_recent WHERE user_id = $1', [userId],
  );
  const maxFatigue = fatigueRows.reduce((m, r) => Math.max(m, Number(r.fatigue_raw) || 0), 0);
  const avgFatigue = fatigueRows.length
    ? fatigueRows.reduce((s, r) => s + (Number(r.fatigue_raw) || 0), 0) / fatigueRows.length
    : 0;
  const fatigueIndex = maxFatigue > 0 ? avgFatigue / maxFatigue : null;

  const { rows: hydration } = await query(
    `SELECT COALESCE(SUM(magnitude), 0)::numeric AS total_ml
       FROM health_metrics
      WHERE user_id = $1 AND metric_type = 'hydration'
        AND recorded_at >= date_trunc('day', now())
        AND recorded_at <  date_trunc('day', now()) + INTERVAL '1 day'`,
    [userId],
  );

  const { rows: weightRows } = await query(
    `SELECT COALESCE(
       (SELECT magnitude FROM health_metrics
         WHERE user_id = $1 AND metric_type = 'weight' AND magnitude IS NOT NULL
         ORDER BY recorded_at DESC LIMIT 1),
       (SELECT bodyweight_kg FROM users WHERE id = $1)
     ) AS weight_kg`,
    [userId],
  );
  const hydrationGoal = hydrationTarget(Number(weightRows[0]?.weight_kg) || null);

  const { rows: mobility } = await query(
    `SELECT COALESCE(SUM(ws.duration_s), 0)::numeric / 60 AS minutes
       FROM workout_sets ws
       JOIN workout_sessions s ON s.id = ws.session_id
       JOIN exercises e        ON e.id = ws.exercise_id
      WHERE s.user_id = $1 AND e.axis IN ('mobility', 'flexibility')
        AND ws.completed_at > now() - INTERVAL '7 days'`,
    [userId],
  );

  const readiness = computeReadiness({
    fatigueIndex,
    sleepHours: latest.sleep ?? null,
    hrvMs: latest.hrv ?? null,
    hrvBaselineMs: base.hrv ?? null,
    restingHr: latest.resting_hr ?? null,
    restingHrBaseline: base.resting_hr ?? null,
    // Objectif proportionnel au poids : la même quantité d'eau ne
    // représente pas le même effort à 60 kg et à 95 kg.
    hydrationRatio: Number(hydration[0].total_ml) / hydrationGoal.ml,
    mobilityMinutes7d: Number(mobility[0].minutes),
  });

  return {
    ...readiness,
    signals: {
      sleep_hours: latest.sleep ?? null,
      hrv_ms: latest.hrv ?? null,
      hrv_baseline_ms: base.hrv ?? null,
      resting_hr: latest.resting_hr ?? null,
      resting_hr_baseline: base.resting_hr ?? null,
      hydration_ml: Number(hydration[0].total_ml),
      hydration_goal_ml: hydrationGoal.ml,
      mobility_minutes_7d: Number(mobility[0].minutes),
      fatigue_index: fatigueIndex,
    },
  };
}
