import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mifflinStJeor, katchMcArdle, estimateBmr, bmi, bmiCategory,
  ffmi, ffmiCategory, leanMass, hydrationTarget, ageFrom, deriveMetrics,
} from '../src/services/anthropometry.js';
import { computeTargets } from '../src/services/nutrition.js';

const near = (a, b, eps = 0.5) =>
  assert.ok(Math.abs(a - b) < eps, `attendu ~${b}, obtenu ${a}`);

test('Mifflin-St Jeor : valeurs de référence', () => {
  // Homme 80 kg, 180 cm, 30 ans : 10×80 + 6,25×180 − 5×30 + 5 = 1780
  near(mifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }), 1780);
  // Femme mêmes mesures : 1780 − 5 − 161 = 1614
  near(mifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: 'female' }), 1614);
});

test('Mifflin-St Jeor : la taille change réellement le résultat', () => {
  const petit = mifflinStJeor({ weightKg: 80, heightCm: 160, age: 30, sex: 'male' });
  const grand = mifflinStJeor({ weightKg: 80, heightCm: 190, age: 30, sex: 'male' });
  assert.ok(grand > petit, 'la taille n’influence pas la dépense');
  // 30 cm × 6,25 = 187,5 kcal d'écart
  near(grand - petit, 187.5);
});

test('Mifflin-St Jeor : refuse une entrée incomplète', () => {
  assert.equal(mifflinStJeor({ weightKg: 80, heightCm: 180, sex: 'male' }), null);
  assert.equal(mifflinStJeor({ heightCm: 180, age: 30, sex: 'male' }), null);
  assert.equal(mifflinStJeor({ weightKg: 80, age: 30, sex: 'male' }), null);
});

test('estimateBmr : Katch-McArdle dès que la masse maigre est connue', () => {
  const r = estimateBmr({
    leanMassKg: 63.5, weightKg: 70.5, heightCm: 180, age: 30, sex: 'male',
  });
  assert.equal(r.method, 'katch-mcardle');
  near(r.bmr, 1741.6);
  assert.equal(r.precision, 'haute');
});

test('estimateBmr : repli sur Mifflin-St Jeor sans masse maigre', () => {
  const r = estimateBmr({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' });
  assert.equal(r.method, 'mifflin-st-jeor');
  near(r.bmr, 1780);
  assert.ok(r.note.includes('masse grasse'), r.note);
});

test('estimateBmr : dit ce qui manque quand rien n’est calculable', () => {
  const r = estimateBmr({ sex: 'male' });
  assert.equal(r.bmr, null);
  assert.deepEqual(r.missing.sort(), ['date de naissance', 'poids', 'taille'].sort());
});

test('IMC : calcul et catégories', () => {
  near(bmi(80, 180), 24.7, 0.05);
  assert.equal(bmiCategory(bmi(80, 180)).label, 'Corpulence normale');
  assert.equal(bmiCategory(17).label, 'Insuffisance pondérale');
  assert.equal(bmiCategory(27).label, 'Surpoids');
  assert.equal(bmiCategory(32).label, 'Obésité');
  assert.equal(bmi(80, 0), null);
});

test('IMC : la limite est signalée chez une personne musclée', () => {
  const sans = bmiCategory(27, { muscular: false });
  const avec = bmiCategory(27, { muscular: true });
  assert.equal(sans.caveat, null);
  assert.ok(avec.caveat.includes('muscle'), avec.caveat);
});

test('FFMI : calcul brut', () => {
  // 63,5 kg de masse maigre pour 1,80 m : 63,5 / 3,24 = 19,6
  const r = ffmi(63.5, 180);
  near(r.raw, 19.6, 0.05);
  // La normalisation est l'identité à 1,80 m, par construction.
  near(r.normalized, r.raw, 0.05);

  // À masse maigre égale, un gabarit plus petit sort un FFMI brut plus
  // élevé : c'est l'arithmétique de la division par le carré de la taille.
  assert.ok(ffmi(63.5, 165).raw > r.raw);
});

test('FFMI : la normalisation ramène à 1,80 m', () => {
  // Normalisation de Kouri : FFMI + 6,1 × (1,80 − taille).
  // Elle corrige une tendance de POPULATION — les personnes grandes
  // portent assez de masse maigre pour avoir un FFMI plus élevé — et
  // non une comparaison à masse maigre égale. Elle ajoute donc en
  // dessous d'1,80 m et retranche au-dessus.
  const petit = ffmi(63.5, 165);
  near(petit.normalized - petit.raw, 6.1 * 0.15, 0.05);
  assert.ok(petit.normalized > petit.raw, 'devrait majorer sous 1,80 m');

  const grand = ffmi(80, 195);
  near(grand.normalized - grand.raw, 6.1 * -0.15, 0.05);
  assert.ok(grand.normalized < grand.raw, 'devrait minorer au-dessus de 1,80 m');
});

test('FFMI : catégories différenciées par sexe', () => {
  assert.equal(ffmiCategory(19.6, 'male'), 'Moyen');
  assert.equal(ffmiCategory(19.6, 'female'), 'Exceptionnelle');
  assert.equal(ffmiCategory(26, 'male'), 'Exceptionnel');
});

test('Masse maigre depuis poids et masse grasse', () => {
  near(leanMass(70.5, 10), 63.45, 0.01);
  near(leanMass(80, 25), 60);
  assert.equal(leanMass(80, null), null);
});

test('Hydratation : proportionnelle au poids', () => {
  const leger = hydrationTarget(60);
  const lourd = hydrationTarget(95);
  assert.ok(lourd.ml > leger.ml, `${lourd.ml} <= ${leger.ml}`);
  // 35 ml/kg, arrondi au palier de 50
  near(leger.ml, 2100, 50);
  near(lourd.ml, 3325, 50);
});

test('Hydratation : l’entraînement majore l’objectif', () => {
  const repos = hydrationTarget(80);
  const seance = hydrationTarget(80, { trainingMinutes: 60 });
  near(seance.ml - repos.ml, 600, 50);
  assert.ok(seance.basis.includes('entraînement'));
});

test('Hydratation : valeur de repli si le poids est inconnu', () => {
  const r = hydrationTarget(null);
  assert.equal(r.ml, 2500);
  assert.ok(r.basis.includes('poids inconnu'));
});

test('ageFrom : calcul et rejet des dates absurdes', () => {
  const y = new Date().getFullYear();
  assert.equal(ageFrom(`${y - 30}-01-01`), 30);
  assert.equal(ageFrom(null), null);
  assert.equal(ageFrom('pas une date'), null);
  assert.equal(ageFrom(`${y + 5}-01-01`), null);
});

test('deriveMetrics : ensemble cohérent', () => {
  const m = deriveMetrics({
    weightKg: 70.5, heightCm: 180, bodyFatPct: 10,
    birthDate: '1995-06-15', sex: 'male',
  });
  near(m.lean_mass_kg, 63.45, 0.01);
  near(m.fat_mass_kg, 7.05, 0.01);
  assert.equal(m.bmr.method, 'katch-mcardle');
  assert.ok(m.ffmi.normalized > 0);
  assert.ok(m.bmi.value > 0);
  assert.ok(m.hydration.ml > 2000);
});

test('computeTargets : fonctionne sans masse grasse, grâce à la taille', () => {
  // Regression : avant, aucune cible n'etait calculable sans masse maigre.
  const r = computeTargets({
    weightKg: 80, heightCm: 180, age: 30, sex: 'male',
    goal: 'maintien', activity: 'leger',
  });
  assert.ok(r.targets, 'aucune cible calculée alors que taille et poids sont connus');
  assert.equal(r.bmr_method.method, 'mifflin-st-jeor');
  near(r.breakdown.bmr, 1780);
  // Les macros retombent sur le poids total ajusté.
  assert.equal(r.breakdown.macro_basis, 'poids total ajusté');
  near(r.breakdown.macro_base_kg, 68);
});

test('computeTargets : la masse maigre reste prioritaire', () => {
  const r = computeTargets({
    leanMassKg: 63.5, weightKg: 70.5, heightCm: 180, age: 30, sex: 'male',
    goal: 'perte', activity: 'leger',
  });
  assert.equal(r.bmr_method.method, 'katch-mcardle');
  assert.equal(r.breakdown.macro_basis, 'masse maigre');
  near(r.targets.kcal, 2035.5);
});

test('computeTargets : sans aucune mesure, on explique ce qui manque', () => {
  const r = computeTargets({ goal: 'perte', activity: 'leger' });
  assert.equal(r.targets, null);
  assert.ok(r.note.length > 0);
});
