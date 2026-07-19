#!/usr/bin/env node
// Historique d'entrainement de demonstration.
//
//   npm run seed:demo
//
// ATTENTION : vide workout_sessions / workout_sets et les metriques de
// source 'demo' avant d'ecrire. Ne pas lancer sur des donnees reelles.

import { pool, waitForDatabase } from '../db.js';
import { config } from '../config.js';

const USER = config.defaultUserId;

/**
 * Recherche un exercice par motif.
 *
 * Le repliage de casse d'ILIKE sur les caractères accentués dépend de la
 * locale du cluster : sous `C`, « É » ne se replie pas sur « é » et le
 * motif ne matche jamais. On désaccentue donc les deux côtés — après
 * unaccent tout est ASCII, et ILIKE redevient fiable partout.
 */
const pick = async (pattern, discipline) => {
  const { rows } = await pool.query(
    `SELECT id, name_fr, target FROM exercises
      WHERE immutable_unaccent(name_fr) ILIKE immutable_unaccent($1)
        ${discipline ? 'AND discipline = $2::discipline' : ''}
      ORDER BY length(name_fr) LIMIT 1`,
    discipline ? [pattern, discipline] : [pattern],
  );
  return rows[0] ?? null;
};

// [motif, charge, reps, jours ecoules] — motifs sans accent, cf. pick()
const PLAN = [
  ['developpe couche a la barre', 100, 5, 1],
  ['developpe couche a la barre', 95, 8, 5],
  ['squat complet a la barre', 140, 5, 2],
  ['squat complet a la barre', 130, 8, 6],
  ['souleve de terre a la barre', 170, 3, 3],
  ['rowing buste penche%barre%', 80, 8, 2],
  ['developpe militaire%barre%', 55, 6, 4],
  ['traction', 0, 10, 1],
  ['dips%', 0, 12, 4],
  ['curl marteau%halteres%', 16, 12, 3],
  ['tirage vertical%poulie%', 70, 10, 5],
];

const STRETCHES = ['%etirement%ischio%', '%etirement%pectoraux%', '%etirement%fessiers%'];

async function main() {
  await waitForDatabase();
  await pool.query('TRUNCATE workout_sets, workout_sessions CASCADE');
  await pool.query("DELETE FROM health_metrics WHERE source = 'demo'");

  const byDay = new Map();
  for (const [pattern, weight, reps, daysAgo] of PLAN) {
    if (!byDay.has(daysAgo)) byDay.set(daysAgo, []);
    byDay.get(daysAgo).push([pattern, weight, reps]);
  }

  for (const [daysAgo, items] of byDay) {
    const started = new Date(Date.now() - daysAgo * 86400000);
    const { rows } = await pool.query(
      `INSERT INTO workout_sessions (user_id, title, started_at, ended_at, perceived_exertion)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [USER, `Séance J-${daysAgo}`, started, new Date(started.getTime() + 4.2e6), 7],
    );
    const sessionId = rows[0].id;

    for (const [pattern, weight, reps] of items) {
      const ex = await pick(pattern);
      if (!ex) { console.log('  introuvable :', pattern); continue; }
      // 3 séries en pyramide descendante.
      for (let i = 1; i <= 3; i += 1) {
        await pool.query(
          `INSERT INTO workout_sets
             (session_id, exercise_id, set_index, weight_kg, reps, completed_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [sessionId, ex.id, i, weight ? weight - (i - 1) * 5 : null,
            reps + (i - 1) * 2, new Date(started.getTime() + i * 3e5)],
        );
      }
      console.log(`  J-${daysAgo}  ${ex.name_fr}`);
    }
  }

  // Souplesse : régulière.
  for (const daysAgo of [1, 4, 6]) {
    const s = await pool.query(
      `INSERT INTO workout_sessions (user_id, title, started_at)
       VALUES ($1, 'Souplesse', now() - ($2 || ' days')::interval) RETURNING id`,
      [USER, String(daysAgo)],
    );
    for (const p of STRETCHES) {
      const ex = await pick(p, 'souplesse');
      if (!ex) continue;
      await pool.query(
        `INSERT INTO workout_sets (session_id, exercise_id, set_index, duration_s, completed_at)
         VALUES ($1,$2,1,480, now() - ($3 || ' days')::interval)`,
        [s.rows[0].id, ex.id, String(daysAgo)],
      );
    }
    console.log(`  souplesse J-${daysAgo}`);
  }

  // Mobilité : volontairement plus rare, pour rendre le déséquilibre
  // souplesse/mobilité visible sur le tableau de bord.
  const mob = await pool.query(
    `INSERT INTO workout_sessions (user_id, title, started_at)
     VALUES ($1, 'Mobilité', now() - INTERVAL '3 days') RETURNING id`, [USER],
  );
  const { rows: mobEx } = await pool.query(
    "SELECT id, name_fr FROM exercises WHERE discipline = 'mobilite' LIMIT 3",
  );
  for (const ex of mobEx) {
    await pool.query(
      `INSERT INTO workout_sets (session_id, exercise_id, set_index, duration_s, completed_at)
       VALUES ($1,$2,1,300, now() - INTERVAL '3 days')`,
      [mob.rows[0].id, ex.id],
    );
    console.log('  mobilité :', ex.name_fr);
  }

  // Métriques santé sur 30 jours, façon Apple Watch.
  for (let d = 0; d < 30; d += 1) {
    const at = new Date(Date.now() - d * 86400000);
    const rows = [
      ['hrv', 58 + Math.sin(d / 3) * 9 + (d === 0 ? 8 : 0), 'ms'],
      ['sleep', 7.2 + Math.sin(d / 4) * 0.9, 'h'],
      ['resting_hr', 54 + Math.cos(d / 5) * 3, 'bpm'],
      ['steps', 8500 + Math.sin(d) * 2500, 'count'],
      ['calories_active', 520 + Math.cos(d / 2) * 140, 'kcal'],
      ['weight', 78 - d * 0.02, 'kg'],
      ['spo2', 97 + Math.sin(d / 6), '%'],
    ];
    for (const [type, value, unit] of rows) {
      await pool.query(
        `INSERT INTO health_metrics
           (user_id, metric_type, recorded_at, source, external_id, unit, value)
         VALUES ($1,$2,$3,'demo',$4,$5,$6::jsonb)
         ON CONFLICT DO NOTHING`,
        [USER, type, at, `demo-${type}-${d}`, unit,
          JSON.stringify({ value: Math.round(value * 100) / 100 })],
      );
    }
  }

  // Hydratation du jour.
  for (const ml of [500, 250, 500, 250]) {
    await pool.query(
      `INSERT INTO health_metrics (user_id, metric_type, recorded_at, source, unit, value)
       VALUES ($1,'hydration', now(), 'demo', 'ml', $2::jsonb)`,
      [USER, JSON.stringify({ value: ml })],
    );
  }

  console.log('\nSeed de démonstration terminé.');
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[seed] échec :', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
