import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_SESSIONS, levelForSessions, dayTypeFactors,
  summarizeLoad, reviewActivity, multiplierDriftKcal,
} from '../src/services/training-load.js';

test('chaque niveau d’activité déclare sa fourchette de séances', () => {
  for (const key of ['sedentaire', 'leger', 'modere', 'intense']) {
    assert.ok(Array.isArray(ACTIVITY_SESSIONS[key]), `fourchette manquante : ${key}`);
  }
});

test('le classement par séances ne laisse aucun trou', () => {
  // 5,2 séances tombait entre « modéré » (3 à 5) et « intense » (6 ou
  // plus), et le repli le classait sédentaire — l'inverse de la vérité.
  const seen = new Set();
  for (let n = 0; n <= 14; n += 0.1) {
    const level = levelForSessions(Math.round(n * 10) / 10);
    assert.ok(ACTIVITY_SESSIONS[level], `niveau inconnu pour ${n} : ${level}`);
    seen.add(level);
  }
  assert.equal(seen.size, 4, 'les quatre niveaux doivent être atteignables');
});

test('le classement est monotone : plus de séances ne baisse jamais le niveau', () => {
  const order = { sedentaire: 0, leger: 1, modere: 2, intense: 3 };
  let previous = -1;
  for (let n = 0; n <= 14; n += 0.1) {
    const rank = order[levelForSessions(Math.round(n * 10) / 10)];
    assert.ok(rank >= previous, `recul du niveau à ${n} séances`);
    previous = rank;
  }
});

test('la répartition entraînement / repos conserve le total hebdomadaire', () => {
  // C'est LA propriété qui rend ce réglage honnête : il déplace des
  // calories, il n'en crée pas.
  for (const t of [1, 2, 3, 4, 5, 6]) {
    for (const pct of [5, 10, 20, 30]) {
      const f = dayTypeFactors({ trainingDaysPerWeek: t, shiftPct: pct });
      const total = t * f.training + (7 - t) * f.rest;
      assert.ok(
        Math.abs(total - 7) < 0.02,
        `${t} jours à +${pct} % : total ${total.toFixed(3)} au lieu de 7`,
      );
    }
  }
});

test('les jours d’entraînement reçoivent plus, les jours de repos moins', () => {
  const f = dayTypeFactors({ trainingDaysPerWeek: 4, shiftPct: 10 });
  assert.ok(f.training > 1);
  assert.ok(f.rest < 1);
  assert.equal(f.neutral, false);
});

test('sans jour de repos, la répartition est refusée et expliquée', () => {
  // On ne peut pas retirer des calories d'un ensemble vide.
  const everyDay = dayTypeFactors({ trainingDaysPerWeek: 7, shiftPct: 10 });
  assert.equal(everyDay.neutral, true);
  assert.equal(everyDay.training, 1);
  assert.ok(everyDay.note.includes('impossible'));

  const noTraining = dayTypeFactors({ trainingDaysPerWeek: 0, shiftPct: 10 });
  assert.equal(noTraining.neutral, true);
});

test('un décalage nul laisse tous les jours identiques', () => {
  const f = dayTypeFactors({ trainingDaysPerWeek: 4, shiftPct: 0 });
  assert.equal(f.training, 1);
  assert.equal(f.rest, 1);
  assert.equal(f.neutral, true);
});

test('le décalage est borné', () => {
  const f = dayTypeFactors({ trainingDaysPerWeek: 4, shiftPct: 500 });
  // Au-delà de 30 %, les jours de repos descendraient sous un apport
  // raisonnable.
  assert.ok(f.training <= 1.3, `${f.training}`);
  assert.ok(f.rest > 0, `${f.rest}`);
});

test('la charge observée se ramène à la semaine', () => {
  const load = summarizeLoad(
    { sessions: 12, minutes: 540, training_days: 10, open_sessions: 0 },
    28,
  );
  assert.equal(load.sessions_per_week, 3);
  assert.equal(load.minutes_per_week, 135);
  assert.equal(load.minutes_per_session, 45);
  assert.equal(load.training_days_per_week, 2.5);
});

test('une charge vide ne divise pas par zéro', () => {
  const load = summarizeLoad({}, 28);
  assert.equal(load.sessions, 0);
  assert.equal(load.minutes_per_session, 0);
});

test('l’activité déclarée est confrontée à celle enregistrée', () => {
  const coherent = reviewActivity({
    declared: 'leger',
    load: { sessions_per_week: 2, window_days: 28, minutes_per_week: 120 },
  });
  assert.equal(coherent.ok, true);

  const drifting = reviewActivity({
    declared: 'leger',
    load: { sessions_per_week: 5.2, window_days: 28, minutes_per_week: 300 },
  });
  assert.equal(drifting.ok, false);
  assert.equal(drifting.observed, 'intense');
  assert.ok(drifting.multiplier_drift > 0);
});

test('l’écart de multiplicateur se traduit en kilocalories', () => {
  // « ×1,375 au lieu de ×1,55 » ne dit rien ; « environ 300 kcal » si.
  const drift = multiplierDriftKcal(1741, 'leger', 'modere');
  assert.ok(drift > 250 && drift < 350, `${drift}`);
  assert.equal(multiplierDriftKcal(0, 'leger', 'modere'), null);
  assert.equal(multiplierDriftKcal(1741, 'leger', 'inconnu'), null);
});
