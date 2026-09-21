import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEEKDAYS, WEEKDAY_SPREAD, defaultWeekdays, weekdayLabel,
  programWeek, dateRange, isoDate,
} from '../src/services/scheduling.js';

test('les sept jours sont déclarés en ordre ISO', () => {
  assert.equal(WEEKDAYS.length, 7);
  assert.deepEqual(WEEKDAYS.map((d) => d.value), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(weekdayLabel(1), 'Lundi');
  assert.equal(weekdayLabel(7), 'Dimanche');
  assert.equal(weekdayLabel(9), null);
});

test('chaque répartition place exactement le bon nombre de séances', () => {
  for (let n = 1; n <= 7; n += 1) {
    const days = defaultWeekdays(n);
    assert.equal(days.length, n, `${n} séances`);
    assert.equal(new Set(days).size, n, `jours en double pour ${n} séances`);
    assert.ok(days.every((d) => d >= 1 && d <= 7), `jour hors bornes pour ${n}`);
    // L'ordre est celui des séances : il doit rester croissant, sinon la
    // séance 2 tomberait avant la séance 1 dans la semaine.
    assert.deepEqual(days, [...days].sort((a, b) => a - b), `désordre pour ${n}`);
  }
});

test('une répartition laisse des jours de repos tant qu’il en reste', () => {
  // Quatre séances sur sept jours : trois jours doivent rester libres.
  assert.equal(7 - defaultWeekdays(4).length, 3);
  // Et elles ne s'empilent pas sur quatre jours consécutifs.
  const four = defaultWeekdays(4);
  const consecutive = four.every((d, i) => i === 0 || d === four[i - 1] + 1);
  assert.equal(consecutive, false, 'quatre séances d’affilée concentrent la charge');
});

test('un nombre de séances hors bornes est ramené dans la semaine', () => {
  assert.equal(defaultWeekdays(0).length, 1);
  assert.equal(defaultWeekdays(99).length, 7);
  assert.equal(defaultWeekdays(undefined).length, 1);
});

test('la table de répartition exposée couvre 1 à 7', () => {
  // C'est elle qui alimente le rattrapage SQL : une entrée manquante
  // laisserait des séances non planifiées après migration.
  for (let n = 1; n <= 7; n += 1) {
    assert.ok(Array.isArray(WEEKDAY_SPREAD[n]), `répartition manquante pour ${n}`);
  }
});

test('la semaine du programme démarre à 1 le jour du départ', () => {
  assert.equal(programWeek('2026-09-14', '2026-09-14'), 1);
  assert.equal(programWeek('2026-09-20', '2026-09-14'), 1);  // dimanche, même semaine
  assert.equal(programWeek('2026-09-21', '2026-09-14'), 2);
  assert.equal(programWeek('2026-10-12', '2026-09-14'), 5);
});

test('avant le départ, la semaine est nulle ou négative', () => {
  // C'est ce qui permet au calendrier de dire « hors programme » plutôt
  // que d'afficher une semaine 0 qui ne veut rien dire.
  assert.ok(programWeek('2026-09-13', '2026-09-14') < 1);
  assert.ok(programWeek('2026-09-01', '2026-09-14') < 1);
});

test('la plage de dates rend les jours ISO, dimanche compris', () => {
  const days = dateRange('2026-09-21', '2026-09-27');
  assert.equal(days.length, 7);
  assert.equal(days[0].weekday, 1, 'le 21 septembre 2026 est un lundi');
  // getUTCDay() rend 0 pour dimanche ; la norme ISO veut 7.
  assert.equal(days[6].weekday, 7, 'dimanche doit valoir 7, pas 0');
});

test('une plage inversée est vide plutôt qu’infinie', () => {
  assert.deepEqual(dateRange('2026-09-27', '2026-09-21'), []);
});

test('une plage aberrante est bornée', () => {
  const days = dateRange('2000-01-01', '2030-01-01');
  assert.equal(days.length, 400);
});

test('isoDate normalise sans décaler d’un jour', () => {
  // Les dates du calendrier sont des JOURS : une heure résiduelle ne
  // doit pas faire basculer sur la veille selon le fuseau.
  assert.equal(isoDate('2026-09-21'), '2026-09-21');
  assert.equal(isoDate(new Date('2026-09-21T23:45:00Z')), '2026-09-21');
  assert.equal(isoDate(new Date('2026-09-21T00:15:00Z')), '2026-09-21');
});
