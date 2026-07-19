import test from 'node:test';
import assert from 'node:assert/strict';

import { erf, normalCdf, normalInv, interpolate, clamp } from '../src/services/stats-math.js';
import {
  matchLift, standardsFor, estimateOneRepMax, percentileFor,
  loadForPercentile, levelFor,
} from '../src/services/strength-standards.js';
import { rankFor, scoreToRank } from '../src/services/scoring.js';

const near = (a, b, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) < eps, `attendu ~${b}, obtenu ${a}`);

test('erf: valeurs de reference', () => {
  near(erf(0), 0);
  near(erf(1), 0.8427008, 1e-6);
  near(erf(-1), -0.8427008, 1e-6);
  near(erf(2), 0.9953223, 1e-6);
});

test('normalCdf: symetrie et queues', () => {
  near(normalCdf(0), 0.5);
  near(normalCdf(1.96), 0.975, 1e-4);
  near(normalCdf(-1.96), 0.025, 1e-4);
  near(normalCdf(1.6448536), 0.95, 1e-5);
});

test('normalInv: inverse de normalCdf', () => {
  near(normalInv(0.5), 0);
  near(normalInv(0.975), 1.959964, 1e-5);
  near(normalInv(0.05), -1.644854, 1e-5);
  // Aller-retour sur toute la plage utile
  for (const p of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
    near(normalCdf(normalInv(p)), p, 1e-6);
  }
});

test('interpolate: bornes et milieu', () => {
  const pts = [[0, 0], [10, 100]];
  assert.equal(interpolate(-5, pts), 0);
  assert.equal(interpolate(15, pts), 100);
  near(interpolate(5, pts), 50);
});

test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('matchLift: noms francais issus de l ingestion', () => {
  assert.equal(matchLift('Développé couché à la barre'), 'bench_press');
  assert.equal(matchLift('Squat à la barre'), 'squat');
  assert.equal(matchLift('Soulevé de terre à la barre'), 'deadlift');
  assert.equal(matchLift('Traction supination'), 'pull_up');
  assert.equal(matchLift('Rowing buste penché aux haltères'), 'barbell_row');
  assert.equal(matchLift('Étirement assis ischio-jambiers'), null);
});

test('estimateOneRepMax: Epley, borne a 12 reps', () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  near(estimateOneRepMax(100, 5), 116.667, 1e-3);
  // Au-dela de 12 reps l'extrapolation est gelee.
  assert.equal(estimateOneRepMax(100, 20), estimateOneRepMax(100, 12));
  assert.equal(estimateOneRepMax(0, 5), null);
  assert.equal(estimateOneRepMax(100, 0), null);
});

test('standardsFor: les standards feminins sont inferieurs', () => {
  const m = standardsFor('bench_press', 'male');
  const f = standardsFor('bench_press', 'female');
  assert.ok(f.every((v, i) => v < m[i]));
  assert.equal(standardsFor('mouvement_inconnu', 'male'), null);
});

test('percentileFor: un intermediaire tombe au 50e percentile', () => {
  // Standard homme "intermediaire" au developpe couche = 1.25 x PDC.
  const r = percentileFor({
    lift: 'bench_press', sex: 'male', bodyweightKg: 80, oneRepMaxKg: 100,
  });
  near(r.percentile, 50, 0.5);
  near(r.z, 0, 0.01);
  near(r.ratio, 1.25);
  assert.equal(r.level, 'Intermediaire');
});

test('percentileFor: un avance tombe au 80e percentile', () => {
  const r = percentileFor({
    lift: 'bench_press', sex: 'male', bodyweightKg: 80, oneRepMaxKg: 140,
  });
  near(r.percentile, 80, 0.5);
  assert.equal(r.level, 'Avance');
});

test('percentileFor: la progression est monotone', () => {
  let prev = -1;
  for (const oneRm of [40, 60, 80, 100, 120, 140, 180, 220]) {
    const r = percentileFor({
      lift: 'bench_press', sex: 'male', bodyweightKg: 80, oneRepMaxKg: oneRm,
    });
    assert.ok(r.percentile > prev, `percentile non monotone a ${oneRm}kg`);
    prev = r.percentile;
  }
});

test('percentileFor: mouvement au poids de corps, charge totale', () => {
  // Traction lestee : 80 kg de corps + 20 kg = ratio 1.25.
  const r = percentileFor({
    lift: 'pull_up', sex: 'male', bodyweightKg: 80,
    oneRepMaxKg: 0, addedWeightKg: 20,
  });
  near(r.ratio, 1.25);
  assert.ok(r.percentile > 0 && r.percentile < 100);
});

test('percentileFor: a performance egale, une femme est mieux classee', () => {
  const common = { lift: 'bench_press', bodyweightKg: 70, oneRepMaxKg: 70 };
  const male = percentileFor({ ...common, sex: 'male' });
  const female = percentileFor({ ...common, sex: 'female' });
  assert.ok(female.percentile > male.percentile);
});

test('loadForPercentile: reciproque de percentileFor', () => {
  const bodyweightKg = 82;
  for (const target of [10, 25, 50, 75, 90]) {
    const load = loadForPercentile({
      lift: 'squat', sex: 'male', bodyweightKg, percentile: target,
    });
    const back = percentileFor({
      lift: 'squat', sex: 'male', bodyweightKg, oneRepMaxKg: load,
    });
    near(back.percentile, target, 0.1);
  }
});

test('levelFor: paliers nommes', () => {
  const s = standardsFor('squat', 'male');
  assert.equal(levelFor(0.1, s), 'Non classe');
  assert.equal(levelFor(0.8, s), 'Debutant');
  assert.equal(levelFor(1.8, s), 'Intermediaire');
  assert.equal(levelFor(5.0, s), 'Elite');
});

test('scoreToRank: bornes des rangs', () => {
  assert.equal(scoreToRank(95).rank, 'S');
  assert.equal(scoreToRank(90).rank, 'S');
  assert.equal(scoreToRank(89.9).rank, 'A');
  assert.equal(scoreToRank(80).rank, 'A');
  assert.equal(scoreToRank(70).rank, 'B');
  assert.equal(scoreToRank(60).rank, 'C');
  assert.equal(scoreToRank(50).rank, 'D');
  assert.equal(scoreToRank(40).rank, 'E');
  assert.equal(scoreToRank(0).rank, 'F');
});

test('rankFor: moyenne des six axes', () => {
  const axes = {
    push: 90, pull: 90, legs: 90, endurance: 90, mobility: 90, explosive: 90,
  };
  const r = rankFor(axes);
  near(r.overall, 90);
  assert.equal(r.rank, 'S');
});
