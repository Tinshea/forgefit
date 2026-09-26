import test from 'node:test';
import assert from 'node:assert/strict';
import { natureDe } from '../src/services/session-nature.js';
import { TEMPLATES } from '../src/services/templates.js';
import { SPORTS } from '../src/services/sports.js';

test('le focus du programme prime sur tout le reste', () => {
  assert.equal(natureDe({ focus: 'push', title: 'yoga du soir' }), 'physique');
  assert.equal(natureDe({ focus: 'mobility', title: 'squat lourd' }), 'souplesse');
});

test('LES DIX-HUIT titres des modèles sont désormais reconnus', () => {
  // C'est le défaut qui a motivé ce fichier : l'ancienne règle n'en
  // reconnaissait aucun, et comptait toute la musculation comme du
  // temps technique.
  const modeles = Array.isArray(TEMPLATES) ? TEMPLATES : Object.values(TEMPLATES);
  const jours = modeles.flatMap((t) => t.days ?? []);
  assert.ok(jours.length > 0, 'aucun jour de modèle à tester');
  for (const d of jours) {
    const n = natureDe({ focus: d.focus, title: d.title });
    assert.notEqual(n, 'technique',
      `« ${d.title} » (focus ${d.focus ?? '—'}) classé technique`);
  }
});

test('une discipline se compte en temps TECHNIQUE', () => {
  assert.equal(natureDe({ sport_key: 'judo' }), 'technique');
  assert.equal(natureDe({ sport_key: 'escalade_voie' }), 'technique');
  assert.equal(natureDe({ sport_key: 'tennis' }), 'technique');
});

test('l’endurance et la force se comptent en temps PHYSIQUE', () => {
  assert.equal(natureDe({ sport_key: 'course' }), 'physique');
  assert.equal(natureDe({ sport_key: 'musculation' }), 'physique');
  assert.equal(natureDe({ sport_key: 'rameur' }), 'physique');
});

test('le yoga et les étirements comptent en SOUPLESSE', () => {
  assert.equal(natureDe({ sport_key: 'yoga' }), 'souplesse');
  assert.equal(natureDe({ sport_key: 'etirements' }), 'souplesse');
  assert.equal(natureDe({ sport_key: 'pilates' }), 'souplesse');
});

test('chaque sport du catalogue reçoit une nature', () => {
  for (const k of Object.keys(SPORTS)) {
    const n = natureDe({ sport_key: k });
    assert.ok(['technique', 'physique', 'souplesse'].includes(n), `${k} → ${n}`);
  }
});

test('le titre ne sert QU’EN dernier recours', () => {
  // Un sport connu l'emporte sur un titre trompeur.
  assert.equal(natureDe({ sport_key: 'judo', title: 'musculation' }), 'technique');
  // Sans focus ni sport, le titre décide.
  assert.equal(natureDe({ title: 'Étirements du soir' }), 'souplesse');
  assert.equal(natureDe({ title: 'Squat lourd' }), 'physique');
});

test('une séance sans rien de reconnaissable est comptée comme physique', () => {
  // Se tromper de ce côté fausse moins le plan que d'attribuer du temps
  // technique à quelqu'un qui n'en a pas fait.
  assert.equal(natureDe({}), 'physique');
  assert.equal(natureDe({ title: 'Séance du mardi' }), 'physique');
});

test('un sport inconnu ne fait rien planter', () => {
  assert.ok(['technique', 'physique', 'souplesse'].includes(natureDe({ sport_key: 'curling' })));
});

test('les marqueurs de travail technique sont reconnus dans un titre', () => {
  // « Kata du soir » tombait sur le repli « physique » : c'est pourtant
  // exactement le temps technique qui compte pour un objectif de
  // discipline.
  for (const t of ['Kata du soir', 'Kumité libre', 'Randori', 'Sparring léger',
                   'Cours de judo', 'Uchi komi', 'Technique au sac', 'Assaut']) {
    assert.equal(natureDe({ title: t }), 'technique', t);
  }
});

test('le focus l’emporte encore sur un titre technique', () => {
  // L'ordre de fiabilité ne change pas : la donnée structurée décide.
  assert.equal(natureDe({ title: 'Kata du soir', focus: 'push' }), 'physique');
  assert.equal(natureDe({ title: 'Kata du soir', focus: 'mobility' }), 'souplesse');
});

test('la souplesse reste prioritaire sur le technique', () => {
  // Un « cours de yoga » est de la souplesse, pas du technique : le
  // premier motif de la liste gagne, et c'est voulu.
  assert.equal(natureDe({ title: 'Cours de yoga' }), 'souplesse');
});
