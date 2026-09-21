import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mifflinStJeor, harrisBenedict, owen, katchMcArdle, cunningham,
  estimateBmr, compareBmrMethods, BMR_FORMULAS,
} from '../src/services/anthropometry.js';

const SUBJECT = {
  leanMassKg: 63.5, weightKg: 75, heightCm: 178, age: 30, sex: 'male',
};

const near = (a, b, tol = 0.1) => assert.ok(
  Math.abs(a - b) <= tol, `${a} attendu proche de ${b}`,
);

test('Katch-McArdle reproduit sa formule publiée', () => {
  near(katchMcArdle(63.5), 370 + 21.6 * 63.5);
});

test('Cunningham rend davantage que Katch-McArdle, à masse maigre égale', () => {
  assert.ok(cunningham(63.5) > katchMcArdle(63.5));
  near(cunningham(63.5) - katchMcArdle(63.5), 130 + 0.4 * 63.5);
});

test('Mifflin-St Jeor sépare les sexes de 166 kcal', () => {
  const male = mifflinStJeor({ ...SUBJECT, sex: 'male' });
  const female = mifflinStJeor({ ...SUBJECT, sex: 'female' });
  near(male - female, 166);
});

test('sexe non renseigné : moyenne des deux, jamais une supposition', () => {
  const male = mifflinStJeor({ ...SUBJECT, sex: 'male' });
  const female = mifflinStJeor({ ...SUBJECT, sex: 'female' });
  near(mifflinStJeor({ ...SUBJECT, sex: null }), (male + female) / 2);
  near(harrisBenedict({ ...SUBJECT, sex: null }), (
    harrisBenedict({ ...SUBJECT, sex: 'male' })
    + harrisBenedict({ ...SUBJECT, sex: 'female' })
  ) / 2);
});

test('Owen n’utilise ni la taille ni l’âge', () => {
  const a = owen({ weightKg: 75, sex: 'male' });
  const b = owen({ weightKg: 75, sex: 'male', heightCm: 200, age: 70 });
  assert.equal(a, b);
});

test('chaque formule refuse de deviner ce qui lui manque', () => {
  assert.equal(katchMcArdle(null), null);
  assert.equal(cunningham(0), null);
  assert.equal(mifflinStJeor({ weightKg: 75, heightCm: 178 }), null, 'âge absent');
  assert.equal(harrisBenedict({ weightKg: 75, age: 30 }), null, 'taille absente');
  assert.equal(owen({}), null);
});

test('le choix automatique prend la formule la mieux informée', () => {
  assert.equal(estimateBmr(SUBJECT).method, 'katch-mcardle');
  const { leanMassKg, ...noLean } = SUBJECT;
  assert.equal(estimateBmr(noLean).method, 'mifflin-st-jeor');
});

test('une formule demandée est respectée', () => {
  const r = estimateBmr({ ...SUBJECT, method: 'owen' });
  assert.equal(r.method, 'owen');
  assert.equal(r.fell_back, false);
});

test('une formule inapplicable retombe ET le dit', () => {
  const { leanMassKg, ...noLean } = SUBJECT;
  const r = estimateBmr({ ...noLean, method: 'cunningham' });
  assert.equal(r.method, 'mifflin-st-jeor');
  assert.equal(r.fell_back, true);
  assert.equal(r.requested, 'cunningham');
  assert.ok(r.note.includes('masse maigre'), 'la note nomme ce qui manque');
});

test('une mesure court-circuite toute formule', () => {
  const r = estimateBmr({ ...SUBJECT, method: 'owen', measuredBmr: 1830 });
  assert.equal(r.method, 'mesure');
  assert.equal(r.bmr, 1830);
  assert.equal(r.precision, 'mesurée');
});

test('sans aucune mesure, on nomme ce qu’il faut saisir', () => {
  const r = estimateBmr({ sex: 'male' });
  assert.equal(r.bmr, null);
  assert.deepEqual(r.missing, ['poids', 'taille', 'date de naissance']);
});

test('la comparaison expose l’écart entre formules', () => {
  const { methods, spread } = compareBmrMethods(SUBJECT);
  assert.equal(methods.length, Object.keys(BMR_FORMULAS).length);
  assert.ok(methods.every((m) => m.available));
  const values = methods.map((m) => m.bmr);
  assert.equal(spread.min, Math.min(...values));
  assert.equal(spread.max, Math.max(...values));
  // L'écart réel entre équations d'usage dépasse largement 100 kcal :
  // c'est précisément le fait que l'interface doit montrer.
  assert.ok(spread.delta > 100, `écart trouvé : ${spread.delta}`);
});

test('une formule non applicable est listée avec ce qui lui manque', () => {
  const rows = compareBmrMethods({ weightKg: 75 }).methods;
  const katch = rows.find((m) => m.key === 'katch-mcardle');
  assert.equal(katch.available, false);
  assert.equal(katch.bmr, null);
  assert.deepEqual(katch.missing, ['masse maigre']);

  // Owen ne demande que le poids : elle reste disponible.
  assert.equal(rows.find((m) => m.key === 'owen').available, true);
});
