import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEATHER_CODES, describeCode, trainingNotes, daypartOf, DAYPARTS,
} from '../src/services/weather.js';

test('chaque code météo porte un libellé, une icône et un verdict', () => {
  for (const [code, v] of Object.entries(WEATHER_CODES)) {
    assert.ok(v.label && v.icon && v.group, `code ${code} incomplet`);
    assert.equal(typeof v.outdoor, 'boolean', `code ${code} sans verdict`);
  }
});

test('un code inconnu ne casse rien et ne prétend rien', () => {
  const d = describeCode(1234);
  assert.equal(d.group, 'unknown');
  // Par défaut on n'interdit pas : l'application signale, elle ne décide pas.
  assert.equal(d.outdoor, true);
});

test('orage et grêle interdisent la séance dehors', () => {
  for (const code of [95, 96, 99]) {
    assert.equal(describeCode(code).outdoor, false, `code ${code}`);
  }
});

test('une bruine légère n’empêche pas de sortir, une pluie forte si', () => {
  assert.equal(describeCode(51).outdoor, true);
  assert.equal(describeCode(65).outdoor, false);
});

test('au-dessus de 30 °C ressentis, une alerte chaleur est levée', () => {
  const notes = trainingNotes({ apparent: 34, temperature: 31, code: 0 });
  const heat = notes.find((n) => n.level === 'alerte');
  assert.ok(heat, JSON.stringify(notes));
  assert.ok(heat.text.includes('34'));
  assert.ok(heat.source.includes('Racinais'), 'la note porte sa source');
});

test('la température RESSENTIE prime sur la température brute', () => {
  // 24 °C au thermomètre mais 31 ressentis : c'est le ressenti qui
  // décide, parce que c'est lui qui dit si le corps évacue sa chaleur.
  const notes = trainingNotes({ temperature: 24, apparent: 31, code: 0 });
  assert.equal(notes[0].level, 'alerte');

  // Et inversement : 31 au thermomètre, 24 ressentis (vent sec).
  const cooler = trainingNotes({ temperature: 31, apparent: 24, code: 0 });
  assert.ok(!cooler.some((n) => n.level === 'alerte'));
});

test('sans température ressentie, on retombe sur la brute', () => {
  const notes = trainingNotes({ temperature: 33, code: 0 });
  assert.equal(notes[0].level, 'alerte');
});

test('entre 25 et 30 °C, une simple attention sur l’hydratation', () => {
  const notes = trainingNotes({ apparent: 27, code: 0 });
  assert.equal(notes[0].level, 'attention');
  assert.ok(/boire|soif/i.test(notes[0].text));
});

test('le gel déclenche un avertissement d’échauffement', () => {
  const notes = trainingNotes({ apparent: -4, code: 0 });
  assert.ok(notes.some((n) => /échauffement/i.test(n.text)));
});

test('un temps tempéré et dégagé ne produit aucune note', () => {
  // Ne rien dire quand il n'y a rien à dire : une note permanente
  // devient un bruit qu'on cesse de lire.
  assert.deepEqual(trainingNotes({ apparent: 18, temperature: 18, code: 0, isDay: true }), []);
});

test('le vent fort est signalé pour le vélo', () => {
  const notes = trainingNotes({ apparent: 15, windKmh: 42, code: 0 });
  assert.ok(notes.some((n) => /vent/i.test(n.text) && /vélo/i.test(n.text)));
});

test('un vent modéré ne dit rien', () => {
  assert.ok(!trainingNotes({ apparent: 15, windKmh: 12, code: 0 })
    .some((n) => /vent/i.test(n.text)));
});

test('l’orage est plus catégorique que la pluie', () => {
  const storm = trainingNotes({ apparent: 18, code: 95 }).find((n) => n.level === 'alerte');
  assert.ok(storm, 'l’orage doit lever une alerte');
  assert.ok(/aucune séance dehors/i.test(storm.text));

  const rain = trainingNotes({ apparent: 18, code: 63 });
  assert.ok(!rain.some((n) => n.level === 'alerte'), 'la pluie n’est pas une alerte');
  assert.ok(rain.some((n) => /compromise/i.test(n.text)));
});

test('la nuit appelle à être visible', () => {
  const notes = trainingNotes({ apparent: 15, code: 0, isDay: false });
  assert.ok(notes.some((n) => /visible/i.test(n.text)));
});

test('quelques gouttes ne compromettent rien', () => {
  const notes = trainingNotes({ apparent: 16, code: 51, precipitationMm: 0.2 });
  assert.ok(notes.some((n) => /rien qui empêche/i.test(n.text)));
});

test('les phases du jour couvrent les 24 heures sans trou', () => {
  const seen = new Set();
  for (let h = 0; h < 24; h += 1) {
    const part = daypartOf(h);
    assert.ok(DAYPARTS[part], `heure ${h} → phase inconnue « ${part} »`);
    seen.add(part);
  }
  assert.deepEqual([...seen].sort(), Object.keys(DAYPARTS).sort());
});

test('les bornes des phases sont celles annoncées', () => {
  assert.equal(daypartOf(5), 'nuit');
  assert.equal(daypartOf(6), 'aube');
  assert.equal(daypartOf(9), 'aube');
  assert.equal(daypartOf(10), 'jour');
  assert.equal(daypartOf(17), 'jour');
  assert.equal(daypartOf(18), 'crepuscule');
  assert.equal(daypartOf(21), 'crepuscule');
  assert.equal(daypartOf(22), 'nuit');
});

test('une heure absurde retombe sur la journée', () => {
  assert.equal(daypartOf(null), 'jour');
  assert.equal(daypartOf('midi'), 'jour');
});

test('une heure hors plage retombe aussi sur la journée', () => {
  assert.equal(daypartOf(-3), 'jour');
  assert.equal(daypartOf(47), 'jour');
});
