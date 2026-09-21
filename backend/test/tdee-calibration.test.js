import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calibrateTdee, linearFit, explainCalibration,
  KCAL_PER_KG, MIN_DAYS, MIN_WEIGHTS,
} from '../src/services/tdee-calibration.js';

const iso = (offset) => new Date(Date.UTC(2026, 7, 1 + offset))
  .toISOString().slice(0, 10);

/** Journal régulier sur `days` jours. */
const intakeFor = (days, kcal = 2100) => Array.from(
  { length: days }, (_, i) => ({ date: iso(i), kcal }),
);

/** Pesées tous les deux jours, avec une dérive linéaire exacte. */
const weightsFor = (days, startKg, kgPerWeek) => Array.from(
  { length: Math.floor(days / 2) },
  (_, i) => ({ date: iso(i * 2), weight_kg: startKg + (i * 2 * kgPerWeek) / 7 }),
);

test('la régression retrouve une pente exacte', () => {
  const fit = linearFit([{ x: 0, y: 10 }, { x: 1, y: 12 }, { x: 2, y: 14 }]);
  assert.equal(fit.slope, 2);
  assert.equal(fit.intercept, 10);
  assert.equal(fit.r2, 1);
});

test('la dépense se déduit du bilan énergétique', () => {
  // 2 100 kcal avalées, 0,4 kg perdus par semaine.
  // Déficit quotidien = 0,4 × 7700 / 7 = 440 kcal → dépense = 2 540.
  const r = calibrateTdee({
    intake: intakeFor(28, 2100),
    weights: weightsFor(28, 80, -0.4),
  });
  assert.equal(r.ok, true);
  assert.equal(r.tdee, 2100 + (0.4 * KCAL_PER_KG) / 7);
  assert.equal(r.trend_kg_per_week, -0.4);
});

test('un poids stable donne une dépense égale aux apports', () => {
  const r = calibrateTdee({
    intake: intakeFor(28, 2400),
    weights: weightsFor(28, 80, 0),
  });
  assert.equal(r.tdee, 2400);
});

test('une prise de poids abaisse la dépense estimée', () => {
  const r = calibrateTdee({
    intake: intakeFor(28, 3000),
    weights: weightsFor(28, 80, +0.25),
  });
  assert.ok(r.tdee < 3000);
});

test('trop peu de pesées : refus chiffré, pas un chiffre bancal', () => {
  const r = calibrateTdee({
    intake: intakeFor(28),
    weights: weightsFor(28, 80, -0.4).slice(0, 3),
  });
  assert.equal(r.ok, false);
  assert.equal(r.tdee, null);
  assert.equal(r.needed.weights, MIN_WEIGHTS - 3);
});

test('trop peu de jours de journal : refus', () => {
  const r = calibrateTdee({
    intake: intakeFor(9),
    weights: weightsFor(28, 80, -0.4),
  });
  assert.equal(r.ok, false);
  assert.equal(r.needed.logged_days, MIN_DAYS - 9);
});

test('une fenêtre de pesées trop courte est refusée', () => {
  const r = calibrateTdee({
    intake: intakeFor(28),
    weights: Array.from({ length: 8 }, (_, i) => ({ date: iso(i), weight_kg: 80 })),
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('7 jours'));
});

test('un journal troué est refusé plutôt que sous-estimé', () => {
  // Un jour sur deux journalisé : 50 % de couverture. Compter les jours
  // manquants à zéro ferait paraître la dépense bien plus basse.
  const sparse = intakeFor(28).filter((_, i) => i % 2 === 0);
  const r = calibrateTdee({ intake: sparse, weights: weightsFor(28, 80, -0.4) });
  assert.equal(r.ok, false);
  assert.ok(r.reasons[0].includes('%'));
  assert.ok(r.coverage < 0.8);
});

test('les apports hors de la fenêtre de pesée sont ignorés', () => {
  // Trente jours à 3 000 kcal AVANT la période pesée ne doivent pas
  // tirer la moyenne : ils relèvent d'un autre régime.
  const before = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10),
    kcal: 3000,
  }));
  const r = calibrateTdee({
    intake: [...before, ...intakeFor(28, 2100)],
    weights: weightsFor(28, 80, 0),
  });
  assert.equal(r.mean_intake_kcal, 2100);
});

test('une pesée aberrante ne renverse pas la tendance', () => {
  const weights = weightsFor(28, 80, -0.4);
  // Deux kilos d'eau un matin : sur un calcul premier/dernier, cela
  // suffirait à inverser le signe de la pente.
  weights[weights.length - 1].weight_kg += 2;

  const r = calibrateTdee({ intake: intakeFor(28, 2100), weights });
  assert.ok(r.trend_kg_per_week < 0, 'la tendance reste à la baisse');
  assert.ok(r.trend_quality < 1, 'la qualité de tendance chute');
  assert.ok(r.margin_kcal > 0, 'la marge d’incertitude s’ouvre');
});

test('l’écart à la prédiction est rapporté dans les deux sens', () => {
  const r = calibrateTdee({
    intake: intakeFor(28, 2100),
    weights: weightsFor(28, 80, -0.4),
    predictedTdee: 2400,
    bmr: 1740,
  });
  assert.equal(r.prediction_error_kcal, 140);
  assert.ok(r.prediction_error_pct > 5 && r.prediction_error_pct < 6);
  assert.equal(r.activity_multiplier, Math.round((2540 / 1740) * 1000) / 1000);
});

test('les explications sont en français, virgule comprise', () => {
  const r = calibrateTdee({
    intake: intakeFor(28, 2100),
    weights: weightsFor(28, 80, -0.4),
    predictedTdee: 2400,
    bmr: 1740,
  });
  const lines = explainCalibration(r, { declaredMultiplier: 1.375 }).join(' ');
  assert.ok(lines.includes('0,4 kg par semaine'));
  assert.ok(lines.includes('sous-estime'));
  assert.ok(!/\d\.\d/.test(lines), `point décimal résiduel : ${lines}`);
});

test('une calibration refusée n’explique que son refus', () => {
  const r = calibrateTdee({ intake: [], weights: [] });
  assert.deepEqual(explainCalibration(r), r.reasons);
});
