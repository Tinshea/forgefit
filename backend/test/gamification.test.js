import test from 'node:test';
import assert from 'node:assert/strict';

import {
  xpForDay, xpForLevel, levelFor, titleFor, progression,
  BADGES, DAILY_SOFT_CAP, LEVEL_FACTOR,
} from '../src/services/gamification.js';

test('sous le plafond, un point de charge vaut un XP', () => {
  assert.equal(xpForDay(300), 300);
  assert.equal(xpForDay(DAILY_SOFT_CAP), DAILY_SOFT_CAP);
});

test('la courbe ne fait pas de marche au plafond', () => {
  assert.equal(xpForDay(DAILY_SOFT_CAP + 1) - xpForDay(DAILY_SOFT_CAP), 1);
});

test('au-delà du plafond, chaque unité rapporte STRICTEMENT moins', () => {
  // Le piège de la version naïve (`C + √(excès × C)`) : sa pente était
  // INFINIE juste après le plafond, si bien que les premières unités
  // au-dessus rapportaient plus que celles d'en dessous — l'inverse
  // exact de l'effet recherché.
  // Pas de 100 : sur 10 unités, l'arrondi à l'entier masque le
  // freinage juste après le plafond, où il est encore très doux.
  const marginal = (x) => xpForDay(x + 100) - xpForDay(x);
  const below = marginal(400);
  const just = marginal(DAILY_SOFT_CAP + 100);
  const far = marginal(2400);
  assert.ok(just < below, `${just} devrait être sous ${below}`);
  assert.ok(far < just, `${far} devrait être sous ${just}`);
});

test('la courbe reste croissante : plus de travail n’enlève jamais d’XP', () => {
  let prev = 0;
  for (let load = 0; load <= 5000; load += 25) {
    const xp = xpForDay(load);
    assert.ok(xp >= prev, `décroissance à ${load}`);
    prev = xp;
  }
});

test('doubler une journée déjà lourde n’achète pas le double', () => {
  assert.ok(xpForDay(2400) < 2 * xpForDay(1200));
});

test('une journée de repos ne rapporte rien, et ne coûte rien', () => {
  assert.equal(xpForDay(0), 0);
  assert.equal(xpForDay(-500), 0);
});

test('la courbe de niveau est quadratique et commence à zéro', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), LEVEL_FACTOR);
  assert.equal(xpForLevel(5), LEVEL_FACTOR * 16);
});

test('chaque niveau coûte plus cher que le précédent', () => {
  for (let l = 2; l < 40; l += 1) {
    const cost = xpForLevel(l + 1) - xpForLevel(l);
    const prev = xpForLevel(l) - xpForLevel(l - 1);
    assert.ok(cost > prev, `niveau ${l + 1} pas plus cher que ${l}`);
  }
});

test('levelFor est la réciproque de xpForLevel', () => {
  for (let l = 1; l < 50; l += 1) {
    assert.equal(levelFor(xpForLevel(l)).level, l);
    assert.equal(levelFor(xpForLevel(l + 1) - 1).level, l, `juste sous ${l + 1}`);
  }
});

test('la progression dans un niveau va de 0 à 1', () => {
  const start = levelFor(xpForLevel(6));
  assert.equal(start.progress, 0);
  assert.equal(start.into_level, 0);
  const almost = levelFor(xpForLevel(7) - 1);
  assert.ok(almost.progress > 0.99);
  assert.equal(almost.to_next, 1);
});

test('une XP nulle ou absurde retombe au niveau 1', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(-5000).level, 1);
  assert.equal(levelFor(undefined).level, 1);
});

test('les titres montent avec le niveau, sans jamais redescendre', () => {
  let seen = titleFor(1);
  const order = [seen];
  for (let l = 2; l <= 70; l += 1) {
    const t = titleFor(l);
    if (t !== seen) { order.push(t); seen = t; }
  }
  assert.equal(order[0], 'Débutant');
  assert.equal(new Set(order).size, order.length, 'un titre est réapparu');
});

test('l’XP se compte par JOUR, pas par séance', () => {
  // Trois séances de 400 dans la journée font 1 200 de charge : elles
  // doivent subir le plafond, comme 1 200 d'un seul tenant. Compter
  // séance par séance les y ferait échapper.
  const oneDay = progression({ days: [{ date: 'j', load: 1200 }] });
  const split = progression({
    days: [{ date: 'j', load: 400 }, { date: 'j', load: 400 }, { date: 'j', load: 400 }],
  });
  assert.equal(oneDay.xp, xpForDay(1200));
  assert.ok(split.xp > oneDay.xp, 'la série de jours distincts est un autre cas');
  assert.ok(oneDay.xp < 1200, 'le plafond a bien mordu');
});

test('chaque distinction porte sa règle en clair', () => {
  for (const b of BADGES) {
    assert.ok(b.rule && b.rule.length > 20, `${b.id} : règle absente`);
    assert.ok(b.tiers.length >= 2, `${b.id} : paliers manquants`);
    // Paliers strictement croissants, sinon un palier serait inatteignable.
    for (let i = 1; i < b.tiers.length; i += 1) {
      assert.ok(b.tiers[i].at > b.tiers[i - 1].at, `${b.id} : paliers non ordonnés`);
    }
  }
});

test('aucune distinction ne récompense l’entraînement quotidien', () => {
  // Une distinction « 7 jours d'affilée » paierait quelqu'un pour ne
  // jamais récupérer. La règle est tenue par un test, pas par la
  // bonne volonté.
  const texts = BADGES.map((b) => `${b.label} ${b.rule}`.toLowerCase()).join(' ');
  assert.ok(!/jours cons|jours d.affil|chaque jour|quotidien/.test(texts), texts);
});

test('les distinctions rapportent leur avancement, pas seulement un verrou', () => {
  const stats = {
    days: [], sessions: [],
    sports_practised: 2, categories_recent: 1, best_streak: 0, who_weeks: 0,
    total_load: 3000, total_sessions: 10, top_sport_sessions: 8, comebacks: 0,
  };
  const p = progression(stats);
  const explorateur = p.badges.find((b) => b.id === 'explorateur');
  assert.equal(explorateur.earned, false);
  assert.equal(explorateur.value, 2);
  assert.equal(explorateur.next.at, 3);
  assert.ok(explorateur.progress > 0.6 && explorateur.progress < 0.7);
});

test('un palier atteint recense tous ceux d’en dessous', () => {
  const p = progression({
    days: [], sessions: [], sports_practised: 13,
    categories_recent: 0, best_streak: 0, who_weeks: 0,
    total_load: 0, total_sessions: 0, top_sport_sessions: 0, comebacks: 0,
  });
  const b = p.badges.find((x) => x.id === 'explorateur');
  assert.equal(b.tier, 'Touche-à-tout');
  assert.equal(b.tier_index, 3);
  assert.equal(b.next.name, 'Caméléon');
});

test('le dernier palier atteint ne laisse plus de suivant', () => {
  const p = progression({
    days: [], sessions: [], sports_practised: 99,
    categories_recent: 0, best_streak: 0, who_weeks: 0,
    total_load: 0, total_sessions: 0, top_sport_sessions: 0, comebacks: 0,
  });
  const b = p.badges.find((x) => x.id === 'explorateur');
  assert.equal(b.next, null);
  assert.equal(b.progress, 1);
});

test('les niveaux par catégorie se calculent sur leur propre charge', () => {
  const p = progression({
    days: [{ date: 'a', load: 500 }],
    sessions: [
      { category: 'endurance', load: 4000 },
      { category: 'endurance', load: 2000 },
      { category: 'combat', load: 1000 },
    ],
  });
  const endurance = p.categories.find((c) => c.category === 'endurance');
  assert.equal(endurance.load, 6000);
  assert.equal(endurance.sessions, 2);
  assert.equal(endurance.level, levelFor(6000).level);
  assert.equal(p.categories[0].category, 'endurance', 'triées par charge');
});

test('une progression vide ne casse pas', () => {
  const p = progression({});
  assert.equal(p.level, 1);
  assert.equal(p.xp, 0);
  assert.deepEqual(p.categories, []);
  assert.equal(p.badges.length, BADGES.length);
  assert.ok(p.badges.every((b) => !b.earned));
});
