import test from 'node:test';
import assert from 'node:assert/strict';

import { computeAdherence } from '../src/services/adherence.js';

const PROGRAM = { name: 'Haut / Bas', starts_on: '2026-09-14', weeks: 4 };
const DAYS = [
  { id: 'lun', weekday: 1, title: 'Haut du corps A' },
  { id: 'jeu', weekday: 4, title: 'Haut du corps B' },
];

const run = (sessions, over = {}) => computeAdherence({
  program: PROGRAM,
  days: DAYS,
  sessions,
  from: '2026-09-14',
  to: '2026-09-27',
  today: '2026-09-27',
  ...over,
});

test('sans programme actif, il n’y a rien à comparer', () => {
  const result = computeAdherence({ program: null });
  assert.equal(result.summary, null);
  assert.ok(result.note.includes('rien à comparer'));
});

test('une séance rattachée au bon jour compte comme faite', () => {
  const result = run([{ local_date: '2026-09-14', program_day_id: 'lun' }]);
  assert.equal(result.summary.done, 1);
  assert.equal(result.summary.planned, 4); // 2 jours × 2 semaines
});

test('une séance libre ne coche pas une séance prévue', () => {
  // S'entraîner le lundi sans suivre le plan du lundi n'est pas suivre
  // le plan : le volume réel change, le suivi du programme non.
  const result = run([{ local_date: '2026-09-14', program_day_id: null }]);
  assert.equal(result.summary.done, 0);
  assert.equal(result.summary.extra, 1);
});

test('une séance hors plan est comptée à part, pas ignorée', () => {
  // Les ignorer ferait croire à une semaine vide alors qu'on s'est
  // entraîné.
  const result = run([{ local_date: '2026-09-16', program_day_id: null }]);
  assert.equal(result.summary.extra, 1);
  assert.equal(result.summary.done, 0);
});

test('les séances prévues mais non faites sont nommées', () => {
  const result = run([{ local_date: '2026-09-14', program_day_id: 'lun' }]);
  const titles = result.summary.missed.map((m) => m.title);
  assert.ok(titles.includes('Haut du corps B'), JSON.stringify(titles));
  assert.equal(result.summary.missed.length, 3);
});

test('l’avenir n’est pas un manquement', () => {
  // Compter les séances à venir ferait chuter le taux à mesure qu'on
  // regarde loin devant.
  const early = computeAdherence({
    program: PROGRAM,
    days: DAYS,
    sessions: [{ local_date: '2026-09-14', program_day_id: 'lun' }],
    from: '2026-09-14',
    to: '2026-09-27',
    today: '2026-09-15',
  });
  assert.equal(early.summary.planned, 1);
  assert.equal(early.summary.rate, 100);
});

test('les jours hors cycle ne comptent nulle part', () => {
  const before = computeAdherence({
    program: PROGRAM,
    days: DAYS,
    sessions: [],
    from: '2026-08-01',
    to: '2026-09-13',
    today: '2026-09-13',
  });
  assert.equal(before.summary.planned, 0);
  assert.equal(before.weeks.length, 0);

  const after = computeAdherence({
    program: { ...PROGRAM, weeks: 1 },
    days: DAYS,
    sessions: [],
    from: '2026-09-14',
    to: '2026-09-27',
    today: '2026-09-27',
  });
  // Une seule semaine de cycle : la seconde n'est pas comptée.
  assert.equal(after.summary.planned, 2);
});

test('le taux hebdomadaire est calculé par semaine de programme', () => {
  const result = run([
    { local_date: '2026-09-14', program_day_id: 'lun' },
    { local_date: '2026-09-17', program_day_id: 'jeu' },
  ]);
  assert.equal(result.weeks[0].rate, 100);
  assert.equal(result.weeks[1].rate, 0);
});

test('la série compte les semaines pleines consécutives', () => {
  const complete = run([
    { local_date: '2026-09-14', program_day_id: 'lun' },
    { local_date: '2026-09-17', program_day_id: 'jeu' },
    { local_date: '2026-09-21', program_day_id: 'lun' },
    { local_date: '2026-09-24', program_day_id: 'jeu' },
  ]);
  assert.equal(complete.summary.streak, 2);

  // Une semaine incomplète casse la série, même si la précédente
  // était pleine.
  const broken = run([
    { local_date: '2026-09-14', program_day_id: 'lun' },
    { local_date: '2026-09-17', program_day_id: 'jeu' },
    { local_date: '2026-09-21', program_day_id: 'lun' },
  ]);
  assert.equal(broken.summary.streak, 0);
});

test('le verdict suit le taux et reste explicite', () => {
  const perfect = run([
    { local_date: '2026-09-14', program_day_id: 'lun' },
    { local_date: '2026-09-17', program_day_id: 'jeu' },
    { local_date: '2026-09-21', program_day_id: 'lun' },
    { local_date: '2026-09-24', program_day_id: 'jeu' },
  ]);
  assert.equal(perfect.summary.rate, 100);
  assert.equal(perfect.summary.verdict.label, 'Programme suivi');

  const none = run([]);
  assert.equal(none.summary.rate, 0);
  assert.ok(none.summary.verdict.note.includes('Réduire le nombre de jours'));
});

test('un programme sans jour placé ne produit aucun taux', () => {
  const result = computeAdherence({
    program: PROGRAM, days: [], sessions: [],
    from: '2026-09-14', to: '2026-09-20', today: '2026-09-20',
  });
  assert.equal(result.summary.rate, null);
  assert.equal(result.summary.verdict.label, 'Rien de prévu');
});
