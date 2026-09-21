import test from 'node:test';
import assert from 'node:assert/strict';

import { weeklyStreak, weekStart } from '../src/services/streak.js';

// 2026-09-20 est un DIMANCHE : la semaine ISO commence le lundi 14.
const TODAY = '2026-09-20';

/** `n` séances dans la semaine commençant le lundi `monday`. */
const week = (monday, n) => Array.from({ length: n }, () => monday);

test('la semaine commence lundi, dimanche compris', () => {
  assert.equal(weekStart('2026-09-20'), '2026-09-14', 'dimanche appartient à sa semaine');
  assert.equal(weekStart('2026-09-14'), '2026-09-14');
  assert.equal(weekStart('2026-09-21'), '2026-09-21', 'lundi ouvre la suivante');
});

test('sans programme actif, il n’y a pas d’objectif à tenir', () => {
  const r = weeklyStreak({ sessionDates: ['2026-09-15'], perWeek: 0, today: TODAY });
  assert.equal(r.current, 0);
  assert.equal(r.target_per_week, 0);
  assert.ok(r.note.includes('Aucun programme actif'));
});

test('l’objectif tenu cette semaine ouvre une série', () => {
  const r = weeklyStreak({
    sessionDates: week('2026-09-14', 4), perWeek: 4, today: TODAY,
  });
  assert.equal(r.current, 1);
  assert.equal(r.this_week, 4);
  assert.equal(r.remaining_this_week, 0);
});

test('les semaines consécutives s’additionnent', () => {
  const r = weeklyStreak({
    sessionDates: [
      ...week('2026-08-31', 4), ...week('2026-09-07', 5), ...week('2026-09-14', 4),
    ],
    perWeek: 4,
    today: TODAY,
  });
  assert.equal(r.current, 3);
});

test('une semaine manquée rompt la série', () => {
  const r = weeklyStreak({
    sessionDates: [
      ...week('2026-08-31', 4),
      ...week('2026-09-07', 1), // ratée
      ...week('2026-09-14', 4),
    ],
    perWeek: 4,
    today: TODAY,
  });
  assert.equal(r.current, 1, 'seule la semaine en cours subsiste');
  assert.equal(r.best, 1);
});

test('la semaine en cours, incomplète, ne casse pas la série', () => {
  // Deux séances sur quatre un dimanche : la semaine est finie côté
  // calendrier, mais la série des semaines PRÉCÉDENTES doit tenir.
  const r = weeklyStreak({
    sessionDates: [
      ...week('2026-08-31', 4), ...week('2026-09-07', 4), ...week('2026-09-14', 2),
    ],
    perWeek: 4,
    today: TODAY,
  });
  assert.equal(r.current, 2, 'les deux semaines pleines restent acquises');
  assert.equal(r.remaining_this_week, 2);
  assert.ok(r.note.includes('2 semaines'));
});

test('le record retient la meilleure série passée', () => {
  const r = weeklyStreak({
    sessionDates: [
      ...week('2026-07-06', 4), ...week('2026-07-13', 4),
      ...week('2026-07-20', 4), ...week('2026-07-27', 4),
      // trou
      ...week('2026-09-14', 4),
    ],
    perWeek: 4,
    today: TODAY,
  });
  assert.equal(r.best, 4);
  assert.equal(r.current, 1);
});

test('huit semaines sont renvoyées, la dernière marquée en cours', () => {
  const r = weeklyStreak({
    sessionDates: week('2026-09-14', 4), perWeek: 4, today: TODAY,
  });
  assert.equal(r.weeks.length, 8);
  assert.equal(r.weeks.at(-1).week_start, '2026-09-14');
  assert.equal(r.weeks.at(-1).in_progress, true);
  assert.equal(r.weeks.at(0).in_progress, false);
  assert.ok(r.weeks.slice(0, -1).every((w) => !w.met), 'semaines vides non atteintes');
});

test('dépasser l’objectif ne compte pas double', () => {
  const r = weeklyStreak({
    sessionDates: week('2026-09-14', 12), perWeek: 4, today: TODAY,
  });
  assert.equal(r.current, 1);
  assert.equal(r.this_week, 12);
});

test('aucune séance : série nulle, invitation plutôt que reproche', () => {
  const r = weeklyStreak({ sessionDates: [], perWeek: 4, today: TODAY });
  assert.equal(r.current, 0);
  assert.equal(r.best, 0);
  assert.ok(r.note.includes('démarrer'));
});
