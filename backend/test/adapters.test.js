import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePayload, detectSource, canonicalType } from '../src/services/adapters.js';
import { computeReadiness } from '../src/services/scoring.js';

test('canonicalType: vocabulaire HealthKit', () => {
  assert.equal(canonicalType('HKQuantityTypeIdentifierDietaryWater'), 'hydration');
  assert.equal(canonicalType('HKQuantityTypeIdentifierHeartRateVariabilitySDNN'), 'hrv');
  assert.equal(canonicalType('resting_heart_rate'), 'resting_hr');
  assert.equal(canonicalType('Sleep Analysis'), 'sleep');
  assert.equal(canonicalType('hydration'), 'hydration');
  // Type inconnu conserve : le modele JSONB doit l'accepter.
  assert.equal(canonicalType('glycemie_capteur_x'), 'glycemie_capteur_x');
});

test('detectSource: reconnaissance par la forme', () => {
  assert.equal(detectSource({ data: { metrics: [] } }), 'apple_health');
  assert.equal(detectSource({ device: 'withings', readings: [] }), 'iot');
  assert.equal(detectSource({ metrics: [{ type: 'sleep', value: 7 }] }), 'generic');
});

test('normalizePayload: export Apple Health', () => {
  const payload = {
    data: {
      metrics: [{
        name: 'HKQuantityTypeIdentifierDietaryWater',
        units: 'mL',
        data: [
          { date: '2026-07-18 08:00:00 +0000', qty: 250, uuid: 'a1' },
          { date: '2026-07-18 12:00:00 +0000', qty: 500, uuid: 'a2' },
        ],
      }],
    },
  };

  const { source, metrics } = normalizePayload(payload, 'apple_health');
  assert.equal(source, 'apple_health');
  assert.equal(metrics.length, 2);
  assert.equal(metrics[0].metricType, 'hydration');
  assert.deepEqual(metrics[0].value, { value: 250 });
  assert.equal(metrics[0].unit, 'mL');
  assert.equal(metrics[0].externalId, 'a1');
  // La date doit etre normalisee en ISO exploitable.
  assert.ok(!Number.isNaN(Date.parse(metrics[0].recordedAt)));
});

test('normalizePayload: capteur IoT / balance', () => {
  const payload = {
    device: 'withings-body+',
    readings: [
      { type: 'body_mass', value: 78.4, unit: 'kg', timestamp: '2026-07-19T06:30:00Z', id: 'w1' },
      { type: 'body_fat', value: 14.2, unit: '%', timestamp: '2026-07-19T06:30:00Z', id: 'w2' },
    ],
  };

  const { source, metrics } = normalizePayload(payload, 'iot');
  assert.equal(source, 'iot');
  assert.equal(metrics.length, 2);
  assert.equal(metrics[0].metricType, 'weight');
  assert.deepEqual(metrics[0].value, { value: 78.4 });
  assert.equal(metrics[0].externalId, 'withings-body+:w1');
  assert.equal(metrics[0].meta.device, 'withings-body+');
});

test('normalizePayload: forme generique et tableau nu', () => {
  const a = normalizePayload({
    metrics: [{ type: 'sleep', value: 7.5, unit: 'h', recorded_at: '2026-07-19T05:00:00Z' }],
  });
  assert.equal(a.metrics[0].metricType, 'sleep');
  assert.deepEqual(a.metrics[0].value, { value: 7.5 });

  const b = normalizePayload([{ type: 'hrv', value: 62, unit: 'ms' }]);
  assert.equal(b.metrics[0].metricType, 'hrv');
});

test('normalizePayload: charge utile imbriquee conservee telle quelle', () => {
  // Le sommeil arrive en phases : la structure native ne doit pas etre
  // aplatie, c'est tout l'interet du JSONB.
  const { metrics } = normalizePayload({
    metrics: [{
      type: 'sleep',
      value: { deep: 1.5, rem: 2.0, core: 4.0, awake: 0.3 },
      recorded_at: '2026-07-19T05:00:00Z',
    }],
  });
  assert.deepEqual(metrics[0].value, { deep: 1.5, rem: 2.0, core: 4.0, awake: 0.3 });
});

test('normalizePayload: etiquette de source inconnue -> detection par la forme', () => {
  // Regression : l'endpoint universel enregistre source='auto' quand
  // l'emetteur ne declare rien. 'auto' ne correspondant a aucun
  // adaptateur, on retombait sur le generique, qui faisait un .filter
  // sur payload.data -- un OBJET chez Apple Health -> exception, et
  // l'evenement finissait en 'failed'.
  const apple = {
    data: {
      metrics: [{
        name: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        units: 'ms',
        data: [{ date: '2026-07-19T06:00:00Z', qty: 68, uuid: 'hrv-1' }],
      }],
    },
  };

  const r = normalizePayload(apple, 'auto');
  assert.equal(r.metrics.length, 1);
  assert.equal(r.metrics[0].metricType, 'hrv');
  assert.deepEqual(r.metrics[0].value, { value: 68 });
  assert.equal(r.source, 'apple_health');

  // Une etiquette tierce inconnue suit le meme chemin, mais reste
  // conservee telle quelle pour la tracabilite.
  const g = normalizePayload(apple, 'garmin');
  assert.equal(g.metrics.length, 1);
  assert.equal(g.source, 'garmin');
});

test('normalizePayload: un payload absurde ne fait pas tomber l ingestion', () => {
  assert.doesNotThrow(() => normalizePayload({}, 'apple_health'));
  assert.doesNotThrow(() => normalizePayload({ data: null }, 'apple_health'));
  assert.doesNotThrow(() => normalizePayload([], 'generic'));
});

test('computeReadiness: sans aucun signal', () => {
  const r = computeReadiness({});
  assert.equal(r.score, null);
  assert.equal(r.contributions.length, 0);
});

test('computeReadiness: un capteur absent ne penalise pas', () => {
  // Seul le sommeil est connu, et il est optimal : le score doit rester
  // haut malgre l'absence de VFC et de FC de repos.
  const r = computeReadiness({ sleepHours: 8 });
  assert.ok(r.score > 95, `attendu > 95, obtenu ${r.score}`);
  assert.equal(r.contributions.length, 1);
  // Le poids est renormalise sur les seuls signaux disponibles.
  assert.equal(r.contributions[0].weight, 1);
});

test('computeReadiness: la fatigue fait chuter le score', () => {
  const frais = computeReadiness({ fatigueIndex: 0, sleepHours: 8 });
  const cuit = computeReadiness({ fatigueIndex: 1, sleepHours: 8 });
  assert.ok(cuit.score < frais.score);
});

test('computeReadiness: VFC lue en ecart a la ligne de base', () => {
  const haute = computeReadiness({ hrvMs: 80, hrvBaselineMs: 60 });
  const basse = computeReadiness({ hrvMs: 40, hrvBaselineMs: 60 });
  assert.ok(haute.score > basse.score);
  // Une VFC brute sans ligne de base n'est pas exploitable.
  const orpheline = computeReadiness({ hrvMs: 80 });
  assert.equal(orpheline.score, null);
});

test('computeReadiness: score borne sur 0-100', () => {
  const extreme = computeReadiness({
    fatigueIndex: 0, sleepHours: 8, hrvMs: 500, hrvBaselineMs: 50,
    restingHr: 30, restingHrBaseline: 60, hydrationRatio: 3,
  });
  assert.ok(extreme.score >= 0 && extreme.score <= 100, `hors bornes : ${extreme.score}`);
});
