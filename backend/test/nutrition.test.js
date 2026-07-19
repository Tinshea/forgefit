import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeTargets, scaleFood, validateFoodCoherence,
  ACTIVITY_MULTIPLIERS, GOAL_SETTINGS,
} from '../src/services/nutrition.js';
// Le métabolisme de base et la masse maigre vivent dans anthropometry :
// nutrition.js les redéfinissait, ce qui faisait deux implémentations de
// la même formule.
import { katchMcArdle, leanMass } from '../src/services/anthropometry.js';

const near = (a, b, eps = 0.05) =>
  assert.ok(Math.abs(a - b) < eps, `attendu ~${b}, obtenu ${a}`);

// Valeurs de reference : le tableur de l'utilisateur, masse maigre
// 63,5 kg, objectif perte, activite legere.
const SHEET = {
  leanMass: 63.5,
  bmr: 1741.6,
  tdee: 2394.7,
  kcal: 2035.495,
  proteinG: 139.7,
  fatG: 50.8,
  carbsG: 254.87375,
  proteinKcal: 558.8,
  fatKcal: 457.2,
  carbsKcal: 1019.495,
};

test('BMR : reproduit exactement la valeur du tableur', () => {
  near(katchMcArdle(SHEET.leanMass), SHEET.bmr);
});

test('TDEE : reproduit exactement la valeur du tableur', () => {
  // La dépense totale n'est pas exposée séparément : on la lit dans le
  // détail des cibles, qui est le seul chemin réellement utilisé.
  const { breakdown } = computeTargets({
    leanMassKg: SHEET.leanMass, goal: 'maintien', activity: 'leger',
  });
  near(breakdown.tdee, SHEET.tdee);
});

test('Cibles : reproduisent exactement le tableur (perte, léger)', () => {
  const { targets, breakdown } = computeTargets({
    leanMassKg: SHEET.leanMass, goal: 'perte', activity: 'leger',
  });
  near(targets.kcal, SHEET.kcal, 0.5);
  near(targets.protein_g, SHEET.proteinG);
  near(targets.fat_g, SHEET.fatG);
  near(targets.carbs_g, SHEET.carbsG, 0.5);
  near(breakdown.protein_kcal, SHEET.proteinKcal, 0.5);
  near(breakdown.fat_kcal, SHEET.fatKcal, 0.5);
  near(breakdown.carbs_kcal, SHEET.carbsKcal, 0.5);
});

test('Cibles : les calories se répartissent intégralement', () => {
  for (const goal of Object.keys(GOAL_SETTINGS)) {
    const { targets, breakdown } = computeTargets({
      leanMassKg: 63.5, goal, activity: 'modere',
    });
    const sum = breakdown.protein_kcal + breakdown.fat_kcal + breakdown.carbs_kcal;
    near(sum, targets.kcal, 1);
  }
});

test('Cibles : la perte est en déficit, la prise en surplus', () => {
  const base = { leanMassKg: 63.5, activity: 'leger' };
  const perte = computeTargets({ ...base, goal: 'perte' }).targets.kcal;
  const maintien = computeTargets({ ...base, goal: 'maintien' }).targets.kcal;
  const prise = computeTargets({ ...base, goal: 'prise' }).targets.kcal;
  assert.ok(perte < maintien, `${perte} >= ${maintien}`);
  assert.ok(prise > maintien, `${prise} <= ${maintien}`);
});

test('Cibles : chaque multiplicateur d’activité augmente la dépense', () => {
  const order = ['sedentaire', 'leger', 'modere', 'intense'];
  let prev = 0;
  for (const activity of order) {
    const { targets } = computeTargets({ leanMassKg: 63.5, goal: 'maintien', activity });
    assert.ok(targets.kcal > prev, `${activity} n'augmente pas la cible`);
    prev = targets.kcal;
  }
  assert.equal(ACTIVITY_MULTIPLIERS.sedentaire, 1.2);
  assert.equal(ACTIVITY_MULTIPLIERS.intense, 1.725);
});

test('Cibles : sans aucune mesure, on renvoie une consigne, pas un chiffre faux', () => {
  const r = computeTargets({ goal: 'perte', activity: 'leger' });
  assert.equal(r.targets, null);
  // Le message énumère précisément les mesures manquantes.
  assert.ok(/poids|taille|naissance/.test(r.note), r.note);
});

test('Cibles : taille et poids suffisent, sans masse grasse', () => {
  // Régression : auparavant, aucune cible n'était calculable sans
  // connaître son taux de masse grasse — soit la majorité des gens.
  const r = computeTargets({
    weightKg: 80, heightCm: 180, age: 30, sex: 'male',
    goal: 'maintien', activity: 'leger',
  });
  assert.ok(r.targets, 'aucune cible malgré taille, poids et âge connus');
  assert.equal(r.bmr_method.method, 'mifflin-st-jeor');
});

test('Cibles : les valeurs saisies à la main priment', () => {
  const { targets, inputs } = computeTargets({
    leanMassKg: 63.5, goal: 'perte', activity: 'leger',
    kcalOverride: 2500, proteinOverrideG: 180,
  });
  assert.equal(targets.kcal, 2500);
  assert.equal(targets.protein_g, 180);
  assert.equal(inputs.overridden.kcal, true);
  assert.equal(inputs.overridden.protein, true);
  assert.equal(inputs.overridden.fat, false);
});

test('Cibles : un reliquat négatif est signalé, pas affiché en négatif', () => {
  const r = computeTargets({
    leanMassKg: 63.5, goal: 'perte', activity: 'sedentaire',
    kcalOverride: 600, fatOverrideG: 80,
  });
  assert.ok(r.targets.carbs_g >= 0, `glucides négatifs : ${r.targets.carbs_g}`);
  assert.ok(r.warnings.length > 0, 'aucun avertissement sur un plan infaisable');
});

test('Masse maigre depuis poids et taux de masse grasse', () => {
  near(leanMass(80, 20), 64);
  near(leanMass(70.5, 10), 63.45);
  assert.equal(leanMass(0, 20), null);
  assert.equal(leanMass(80, null), null);
});

test('scaleFood : portion proportionnelle à la quantité', () => {
  // Flocons d'avoine du tableur : 379 kcal / 100 g, 30 g consommés.
  const oats = {
    reference_qty: 100, kcal: 379, fat_g: 6.9, carbs_g: 67,
    protein_g: 13, fiber_g: 10, price_eur: 0.35,
  };
  const p = scaleFood(oats, 30);
  near(p.kcal, 113.7, 0.05);
  near(p.fat_g, 2.07, 0.01);
  near(p.carbs_g, 20.1, 0.01);
  near(p.protein_g, 3.9, 0.01);
  near(p.fiber_g, 3, 0.01);
  near(p.price_eur, 0.105, 0.001);
});

test('scaleFood : gère une référence à la pièce', () => {
  // Oeuf entier : 78 kcal pour 50 g de reference.
  const egg = { reference_qty: 50, kcal: 78, fat_g: 5, carbs_g: 0.6, protein_g: 6, fiber_g: 0 };
  const p = scaleFood(egg, 110);
  near(p.kcal, 171.6, 0.05);
  near(p.protein_g, 13.2, 0.01);
});

test('scaleFood : prix absent reste absent', () => {
  const f = { reference_qty: 100, kcal: 100, price_eur: null };
  assert.equal(scaleFood(f, 50).price_eur, null);
});

test('validateFoodCoherence : accepte une fiche cohérente', () => {
  // Blanc de poulet : 23 g prot × 4 + 1,2 g lip × 9 = 102,8 vs 110 declarees.
  const r = validateFoodCoherence({ kcal: 110, protein_g: 23, fat_g: 1.2, carbs_g: 0 });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('validateFoodCoherence : rejette une saisie incohérente', () => {
  // Erreur classique : un gramme a la place d'un decigramme.
  const r = validateFoodCoherence({ kcal: 50, protein_g: 23, fat_g: 12, carbs_g: 30 });
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('écart'));
});

test('validateFoodCoherence : aliment sans énergie ni macro', () => {
  const r = validateFoodCoherence({ kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 });
  assert.equal(r.ok, true);
});
