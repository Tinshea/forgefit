import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sessionLoad, describeSessionLoad, dailySeries, monotonyOf,
  acuteChronicRatio, loadSummary, MONOTONY_CEILING,
} from '../src/services/session-load.js';

const iso = (i) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10);

test('la charge de Foster est RPE × minutes', () => {
  assert.equal(sessionLoad({ rpe: 7, minutes: 90 }), 630);
  assert.equal(sessionLoad({ rpe: 3, minutes: 60 }), 180);
});

test('une séance sans RPE ou sans durée n’a pas de charge', () => {
  // Null, pas zéro : une donnée manquante n’est pas un effort nul.
  assert.equal(sessionLoad({ minutes: 90 }), null);
  assert.equal(sessionLoad({ rpe: 7 }), null);
  assert.equal(sessionLoad({ rpe: 0, minutes: 90 }), null);
});

test('la charge est un PRODUIT : durée et intensité s’y échangent', () => {
  // 3 × 60 et 9 × 20 donnent tous deux 180. C'est une limite connue et
  // assumée de la méthode de Foster : elle ne distingue pas une heure
  // tranquille de vingt minutes très dures. Le test fige cette
  // propriété pour qu'un « correctif » bien intentionné ne la casse
  // pas en croyant réparer un bug.
  assert.equal(sessionLoad({ rpe: 3, minutes: 60 }), sessionLoad({ rpe: 9, minutes: 20 }));
  assert.equal(sessionLoad({ rpe: 3, minutes: 60 }), 180);
});

test('les paliers de lecture sont ordonnés', () => {
  const levels = [100, 200, 500, 800, 1200].map((l) => describeSessionLoad(l).level);
  assert.deepEqual(levels, ['legere', 'moderee', 'soutenue', 'lourde', 'tres-lourde']);
});

test('la série quotidienne inclut les jours de repos', () => {
  const days = dailySeries(
    [{ date: iso(0), load: 300 }, { date: iso(3), load: 400 }],
    { from: iso(0), to: iso(4) },
  );
  assert.equal(days.length, 5);
  assert.deepEqual(days.map((d) => d.load), [300, 0, 0, 400, 0]);
});

test('deux séances le même jour s’additionnent', () => {
  const days = dailySeries(
    [{ date: iso(0), load: 300 }, { date: iso(0), load: 200 }],
    { from: iso(0), to: iso(0) },
  );
  assert.equal(days[0].load, 500);
});

test('la monotonie monte quand la semaine s’uniformise', () => {
  const varied = monotonyOf([600, 0, 300, 0, 500, 0, 200]);
  const flat = monotonyOf([230, 230, 230, 230, 230, 230, 220]);
  assert.ok(flat.monotony > varied.monotony);
  assert.ok(flat.monotony > MONOTONY_CEILING, `monotonie ${flat.monotony}`);
});

test('la contrainte est le produit charge × monotonie', () => {
  const r = monotonyOf([400, 0, 400, 0, 400, 0, 400]);
  assert.equal(r.weekly_load, 1600);
  assert.equal(r.strain, Math.round(r.weekly_load * r.monotony));
});

test('une semaine parfaitement plate est signalée, pas divisée par zéro', () => {
  const r = monotonyOf([300, 300, 300, 300, 300, 300, 300]);
  assert.equal(r.monotony, null);
  assert.equal(r.uniform, true);
  assert.ok(r.note.includes('uniforme'));
});

test('une semaine vide ne produit ni monotonie ni contrainte', () => {
  const r = monotonyOf([0, 0, 0, 0, 0, 0, 0]);
  assert.equal(r.weekly_load, 0);
  assert.equal(r.monotony, 0);
});

test('le rapport aigu/chronique exige 28 jours d’historique', () => {
  const days = Array.from({ length: 20 }, (_, i) => ({ date: iso(i), load: 300 }));
  const r = acuteChronicRatio(days);
  assert.equal(r.ready, false);
  assert.ok(r.note.includes('28 jours'));
});

test('une charge stable donne un rapport proche de 1', () => {
  const days = Array.from({ length: 28 }, (_, i) => ({ date: iso(i), load: 300 }));
  const r = acuteChronicRatio(days);
  assert.equal(r.ratio, 1);
  assert.equal(r.trend, 'stable');
});

test('le rapport est DÉCOUPLÉ : la semaine récente sort de sa propre référence', () => {
  // 21 jours à 100, puis 7 jours à 300. Découplé : 300 / 100 = 3.
  // Couplé, la moyenne des 28 jours vaudrait 150 et donnerait 2 — la
  // hausse paraîtrait deux fois plus douce qu’elle ne l’est.
  const days = Array.from({ length: 28 }, (_, i) => ({
    date: iso(i), load: i < 21 ? 100 : 300,
  }));
  const r = acuteChronicRatio(days);
  assert.equal(r.chronic_mean, 100);
  assert.equal(r.acute_mean, 300);
  assert.equal(r.ratio, 3);
});

test('une base de comparaison trop mince refuse de conclure', () => {
  // Deux journées isolées sur trois semaines donnaient un rapport de 15 :
  // exact, et parfaitement inutile.
  const days = Array.from({ length: 28 }, (_, i) => ({
    date: iso(i), load: i === 2 ? 400 : i >= 21 ? 350 : 0,
  }));
  const r = acuteChronicRatio(days);
  assert.equal(r.ratio, null);
  assert.equal(r.ready, false);
  assert.equal(r.chronic_active_days, 1);
  assert.ok(r.note.includes('pas de base'));
});

test('une progression rapide est décrite comme telle, jamais comme un risque', () => {
  const days = Array.from({ length: 28 }, (_, i) => ({
    date: iso(i), load: i < 21 ? 200 : 500,
  }));
  const r = acuteChronicRatio(days);
  assert.ok(r.ratio > 1.5);
  assert.ok(r.note.includes('pas un pronostic'));
  assert.ok(!/danger|risque de blessure/i.test(r.note));
});

test('le bilan ventile la charge par catégorie et par sport', () => {
  const sessions = [
    { date: iso(0), load: 600, sport: 'course', category: 'endurance' },
    { date: iso(1), load: 400, sport: 'football', category: 'collectif' },
    { date: iso(2), load: 200, sport: 'course', category: 'endurance' },
  ];
  const s = loadSummary(sessions, { from: iso(0), to: iso(6) });
  assert.equal(s.total_load, 1200);
  assert.equal(s.by_category[0].category, 'endurance');
  assert.equal(s.by_category[0].load, 800);
  assert.equal(s.by_category[0].share, 66.7);
  assert.equal(s.by_sport[0].sport, 'course');
});

test('un bilan sans aucune séance ne casse pas', () => {
  const s = loadSummary([], { from: iso(0), to: iso(6) });
  assert.equal(s.total_load, 0);
  assert.equal(s.days.length, 7);
  assert.deepEqual(s.by_category, []);
});
