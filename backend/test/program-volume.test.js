import test from 'node:test';
import assert from 'node:assert/strict';

import { programVolume, SECONDARY_WEIGHT } from '../src/services/program-volume.js';

const day = (id, items) => ({ id, items });
const lift = (target, sets, secondary = []) => ({
  target, target_sets: sets, secondary_muscles: secondary, discipline: 'musculation',
});

test('le muscle principal compte une série pleine', () => {
  const v = programVolume([day('a', [lift('pectorals', 4)])]);
  assert.equal(v.muscles[0].muscle, 'pectorals');
  assert.equal(v.muscles[0].weekly_sets, 4);
  assert.equal(v.muscles[0].secondary_sets, 0);
});

test('un muscle secondaire compte 0,4 série', () => {
  const v = programVolume([day('a', [lift('pectorals', 5, ['triceps'])])]);
  const triceps = v.muscles.find((m) => m.muscle === 'triceps');
  assert.equal(triceps.weekly_sets, 5 * SECONDARY_WEIGHT);
  assert.equal(triceps.primary_sets, 0);
});

test('un muscle listé à la fois principal et secondaire n’est pas compté deux fois', () => {
  // Le dataset se contredit parfois : `target` réapparaît dans
  // `secondary_muscles`. Sans garde, l'exercice vaudrait 1,4 série.
  const v = programVolume([day('a', [lift('lats', 3, ['lats', 'biceps'])])]);
  const lats = v.muscles.find((m) => m.muscle === 'lats');
  assert.equal(lats.weekly_sets, 3);
});

test('la fréquence se compte en jours, pas en exercices', () => {
  const v = programVolume([
    day('lundi', [lift('pectorals', 3), lift('pectorals', 3), lift('pectorals', 3)]),
  ]);
  const pecs = v.muscles.find((m) => m.muscle === 'pectorals');
  assert.equal(pecs.weekly_sets, 9);
  assert.equal(pecs.sessions_per_week, 1, 'trois exercices le même jour font une séance');
});

test('deux jours distincts font deux séances', () => {
  const v = programVolume([
    day('lundi', [lift('pectorals', 4)]),
    day('jeudi', [lift('pectorals', 4)]),
  ]);
  assert.equal(v.muscles[0].sessions_per_week, 2);
});

test('le cardio se compte en minutes, pas en séries', () => {
  const v = programVolume([day('a', [{
    target: 'cardiovascular system', discipline: 'cardio',
    target_sets: 1, target_seconds: 1800,
  }])]);
  assert.equal(v.total_sets, 0);
  assert.equal(v.aerobic_minutes, 30);
  assert.equal(v.muscles.length, 0);
});

test('le travail chronométré sans séries n’entre pas dans le volume', () => {
  const v = programVolume([day('a', [{
    target: 'hamstrings', discipline: 'souplesse', target_seconds: 40, target_sets: 0,
  }])]);
  assert.equal(v.total_sets, 0);
});

test('les verdicts suivent les seuils de dose-réponse', () => {
  const at = (sets) => programVolume([day('a', [lift('quads', sets)])]).muscles[0].level;
  assert.equal(at(4), 'sous-entretien');
  assert.equal(at(8), 'entretien');
  assert.equal(at(14), 'adaptation');
  assert.equal(at(21), 'haut');
  assert.equal(at(30), 'plafond');
});

test('un muscle sous l’entretien est signalé, mais seulement s’il est visé', () => {
  // Deux séries directes : trop peu, et c'est un avertissement.
  const direct = programVolume([day('a', [lift('calves', 2)])]);
  assert.ok(direct.warnings.some((w) => w.includes('calves')));

  // Le même volume obtenu UNIQUEMENT en accompagnement n'est pas une
  // erreur de dosage : personne n'a prétendu entraîner ce muscle.
  const incidental = programVolume([day('a', [lift('quads', 5, ['calves'])])]);
  assert.ok(!incidental.warnings.some((w) => w.includes('calves')));
});

test('tout le volume sur une seule séance est signalé', () => {
  const v = programVolume([day('lundi', [lift('lats', 16)])]);
  assert.ok(v.warnings.some((w) => w.includes('une seule séance')));
});

test('le volume réparti sur deux jours ne déclenche pas l’avertissement', () => {
  const v = programVolume([
    day('lundi', [lift('lats', 8)]),
    day('jeudi', [lift('lats', 8)]),
  ]);
  assert.ok(!v.warnings.some((w) => w.includes('une seule séance')));
});

test('un programme vide ne produit ni muscle ni avertissement', () => {
  const v = programVolume([]);
  assert.deepEqual(v.muscles, []);
  assert.deepEqual(v.warnings, []);
  assert.equal(v.total_sets, 0);
});
