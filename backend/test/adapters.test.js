import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePayload, detectSource, canonicalType, normalizePercent,
} from '../src/services/adapters.js';
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

test('normalizePercent: Apple exprime les pourcentages en fraction', () => {
  // Regression sur donnees REELLES : un export Apple donnait un taux de
  // masse grasse de 0.175 pour 17,5 %. Repris tel quel, la masse maigre
  // deduite valait 99,8 % du poids — et la depense energetique avec.
  assert.equal(normalizePercent('body_fat', 0.175), 17.5);
  assert.equal(normalizePercent('spo2', 0.98), 98);
  assert.equal(normalizePercent('body_water', 0.582), 58.2);

  // Deja en pourcentage : ne pas retoucher.
  assert.equal(normalizePercent('body_fat', 17.5), 17.5);
  assert.equal(normalizePercent('spo2', 98), 98);

  // Le seuil est sur : aucune de ces grandeurs n'est sous 1 %.
  assert.equal(normalizePercent('body_fat', 1), 100);

  // Les autres types ne sont pas concernes.
  assert.equal(normalizePercent('weight', 0.5), 0.5);
  assert.equal(normalizePercent('hrv', 0.9), 0.9);

  // Entrees inexploitables : laissees telles quelles.
  assert.equal(normalizePercent('body_fat', null), null);
  assert.ok(Number.isNaN(normalizePercent('body_fat', NaN)));
});

test('normalizePayload: conversion appliquee au webhook Apple Health', () => {
  const { metrics } = normalizePayload({
    data: {
      metrics: [{
        name: 'HKQuantityTypeIdentifierBodyFatPercentage',
        units: '%',
        data: [{ date: '2026-07-19T07:00:00Z', qty: 0.151, uuid: 'bf-1' }],
      }],
    },
  }, 'apple_health');

  assert.equal(metrics[0].metricType, 'body_fat');
  assert.deepEqual(metrics[0].value, { value: 15.1 });
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

test('objet plat : la forme que Raccourcis sait produire', () => {
  const { source, metrics } = normalizePayload({
    hrv: '68', resting_hr: '52', weight: '78.2', lean_mass: '62.1', steps: '9430',
  });
  assert.equal(source, 'plat');
  assert.equal(metrics.length, 5);
  // Raccourcis envoie tout en texte : la conversion doit etre faite.
  const vfc = metrics.find((m) => m.metricType === 'hrv');
  assert.equal(vfc.value.value, 68);
  assert.equal(typeof vfc.value.value, 'number');
  assert.equal(metrics.find((m) => m.metricType === 'weight').value.value, 78.2);
});

test('objet plat : une cle inconnue fait renoncer a la forme entiere', () => {
  // Sinon n'importe quel objet mal forme ressortirait en metriques
  // inventees. Mieux vaut retomber sur le generique.
  assert.equal(detectSource({ hrv: 68, temperature_du_salon: 21.5 }), 'generic');
  assert.equal(detectSource({ hrv: 68, bidule: 3 }), 'generic');
});

test('objet plat : une valeur non scalaire fait renoncer aussi', () => {
  assert.equal(detectSource({ hrv: { value: 68 } }), 'generic');
  assert.equal(detectSource({ hrv: 'pas un nombre' }), 'generic');
  assert.equal(detectSource({}), 'generic');
});

test('objet plat : ne detourne pas une charge utile Apple Health', () => {
  assert.equal(detectSource({ data: { metrics: [{ name: 'step_count', data: [] }] } }), 'apple_health');
  assert.equal(detectSource({ metrics: [{ type: 'hrv', value: 68 }] }), 'generic');
});

test('etiquette juste mais adaptateur inadapte : la forme reprend la main', () => {
  // Le raccourci iOS annonce `apple_health` — c'est vrai — mais envoie
  // un objet plat. Sans secours, l'adaptateur Apple rendait zero
  // metrique et le webhook repondait 202 : une panne muette.
  const { source, metrics } = normalizePayload(
    { hrv: '68', resting_hr: '52' }, 'apple_health',
  );
  assert.equal(source, 'plat');
  assert.equal(metrics.length, 2);
});

test('le secours ne se declenche PAS quand l etiquette a produit des mesures', () => {
  const { source, metrics } = normalizePayload(
    { data: { metrics: [{ name: 'step_count', units: 'count', data: [{ qty: 9430, date: '2026-09-25' }] }] } },
    'apple_health',
  );
  assert.equal(source, 'apple_health');
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].metricType, 'steps');
});

test('une charge utile incomprise ne devient pas une mesure fantome', () => {
  // Raccourci iOS dont les variables sont vides : ni la forme plate ni
  // le generique ne doivent inventer de mesure.
  const { metrics } = normalizePayload({ hrv: '', resting_hr: '' }, 'apple_health');
  assert.equal(metrics.length, 0, 'aucune mesure ne doit etre fabriquee');
});

test('un type inconnu mais NOMME reste accepte', () => {
  // Le contraire du test precedent : ici l'emetteur dit ce qu'il mesure.
  const { metrics } = normalizePayload({ metrics: [{ type: 'glycemie_capteur_x', value: 5.4 }] });
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].metricType, 'glycemie_capteur_x');
  assert.equal(metrics[0].value.value, 5.4);
});
