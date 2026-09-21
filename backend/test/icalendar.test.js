import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCalendar, buildVTimezone, firstOccurrence, addMinutes, offsetMinutes,
} from '../src/services/icalendar.js';

const PROGRAM = { name: 'Haut / Bas — 4 jours', starts_on: '2026-09-14', weeks: 8 };

const day = (over = {}) => ({
  id: 'day-1',
  weekday: 1,
  title: 'Haut du corps A',
  focus: 'push',
  start_time: '18:30:00',
  duration_minutes: 75,
  items: [],
  ...over,
});

const lines = (ics) => ics.split('\r\n');

/**
 * Dépliage, tel que le fait un client conforme : une ligne de
 * continuation commence par une espace, qui ne fait PAS partie de la
 * valeur. Lire le fichier sans déplier introduirait des espaces
 * parasites au milieu des mots.
 */
const unfold = (ics) => ics.replace(/\r\n /g, '');
const find = (ics, prefix) => lines(ics).filter((l) => l.startsWith(prefix));

test('le fichier est un VCALENDAR complet et équilibré', () => {
  const ics = buildCalendar(PROGRAM, [day()], { timezone: 'Europe/Paris' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));

  for (const block of ['VCALENDAR', 'VEVENT', 'VALARM', 'VTIMEZONE']) {
    assert.equal(
      find(ics, `BEGIN:${block}`).length,
      find(ics, `END:${block}`).length,
      `${block} déséquilibré`,
    );
  }
});

test('les fins de ligne sont CRLF', () => {
  // Quelques clients refusent purement et simplement un fichier en LF.
  const ics = buildCalendar(PROGRAM, [day()], { timezone: 'UTC' });
  const strayLf = ics.replace(/\r\n/g, '').includes('\n');
  assert.equal(strayLf, false);
});

test('aucune ligne ne dépasse 75 octets', () => {
  const ics = buildCalendar(PROGRAM, [day({
    title: 'Séance très longuement intitulée pour forcer le pliage des lignes',
    items: Array.from({ length: 8 }, (_, i) => ({
      name_fr: `Développé couché à la barre, variante numéro ${i}`,
      target_sets: 4, target_reps: 6, target_reps_max: 8, suggested_kg: 87.5,
    })),
  })], { timezone: 'Europe/Paris' });

  for (const line of lines(ics)) {
    assert.ok(
      Buffer.byteLength(line, 'utf8') <= 75,
      `ligne de ${Buffer.byteLength(line, 'utf8')} octets : ${line.slice(0, 40)}`,
    );
  }
});

test('le pliage ne coupe pas un caractère multi-octets en deux', () => {
  const title = 'é'.repeat(65);
  const ics = buildCalendar(PROGRAM, [day({ title })], { timezone: 'UTC' });
  // Un découpage au milieu d'une séquence UTF-8 produirait U+FFFD.
  assert.equal(ics.includes('\uFFFD'), false);
  // Et le dépliage doit rendre la valeur d'origine, intacte.
  assert.ok(unfold(ics).includes(`SUMMARY:${title}`));
});

test('les caractères réservés sont échappés', () => {
  const ics = buildCalendar(PROGRAM, [day({ title: 'Séance A; variante, dure' })], {});
  const summary = find(ics, 'SUMMARY:')[0];
  // Une virgule ou un point-virgule non échappé couperait la valeur en
  // plusieurs paramètres et casserait le fichier pour le client.
  assert.ok(summary.includes('\;'), summary);
  assert.ok(summary.includes('\\,'), summary);
});

test('chaque séance produit un évènement récurrent hebdomadaire', () => {
  const ics = buildCalendar(PROGRAM, [day(), day({ id: 'day-2', weekday: 4 })], {});
  assert.equal(find(ics, 'BEGIN:VEVENT').length, 2);
  const rules = find(ics, 'RRULE:FREQ=WEEKLY');
  assert.deepEqual(rules, [
    'RRULE:FREQ=WEEKLY;COUNT=8;BYDAY=MO',
    'RRULE:FREQ=WEEKLY;COUNT=8;BYDAY=TH',
  ]);
});

test('l’identifiant d’évènement est stable entre deux exports', () => {
  // Sans UID stable, chaque resynchronisation créerait des doublons au
  // lieu de mettre à jour les évènements existants.
  const a = buildCalendar(PROGRAM, [day()], {});
  const b = buildCalendar(PROGRAM, [day()], {});
  assert.deepEqual(find(a, 'UID:'), find(b, 'UID:'));
  assert.equal(find(a, 'UID:')[0], 'UID:day-1@forgefit');
});

test('une séance sans jour attribué ne produit aucun évènement', () => {
  const ics = buildCalendar(PROGRAM, [day({ weekday: null })], {});
  assert.equal(find(ics, 'BEGIN:VEVENT').length, 0);
});

test('la première occurrence tombe sur le jour décrit par la règle', () => {
  // Si DTSTART ne tombe pas sur le jour de la RRULE, les clients
  // divergent : certains ignorent la première occurrence, d'autres
  // l'ajoutent en plus de la série.
  assert.equal(firstOccurrence('2026-09-14', 1), '2026-09-14'); // lundi → lundi
  assert.equal(firstOccurrence('2026-09-14', 4), '2026-09-17'); // lundi → jeudi
  assert.equal(firstOccurrence('2026-09-14', 7), '2026-09-20'); // lundi → dimanche
});

test('la fin de l’évènement suit la durée déclarée', () => {
  const ics = buildCalendar(PROGRAM, [day({ start_time: '18:30:00', duration_minutes: 75 })], {
    timezone: 'Europe/Paris',
  });
  assert.equal(find(ics, 'DTSTART;')[0], 'DTSTART;TZID=Europe/Paris:20260914T183000');
  assert.equal(find(ics, 'DTEND;')[0], 'DTEND;TZID=Europe/Paris:20260914T194500');
});

test('addMinutes reste dans la journée', () => {
  assert.equal(addMinutes('18:30', 75), '19:45:00');
  assert.equal(addMinutes('23:30', 60), '00:30:00');
  assert.equal(addMinutes('00:15', -30), '23:45:00');
});

test('le fuseau est défini dans le fichier, pas seulement référencé', () => {
  // Un TZID orphelin n'est pas conforme, même si les clients grand
  // public le tolèrent.
  const ics = buildCalendar(PROGRAM, [day()], { timezone: 'Europe/Paris' });
  assert.ok(ics.includes('BEGIN:VTIMEZONE'));
  assert.ok(ics.includes('TZID:Europe/Paris'));
});

test('le fuseau porte ses deux transitions annuelles', () => {
  const tz = buildVTimezone('Europe/Paris', 2026).join('\n');
  assert.ok(tz.includes('BEGIN:DAYLIGHT'));
  assert.ok(tz.includes('BEGIN:STANDARD'));
  // Dernier dimanche de mars et d'octobre.
  assert.ok(tz.includes('FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU'), tz);
  assert.ok(tz.includes('FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU'), tz);
  assert.ok(tz.includes('TZOFFSETTO:+0200'));
});

test('un fuseau sans heure d’été n’a qu’un composant standard', () => {
  const tz = buildVTimezone('Asia/Tokyo', 2026).join('\n');
  assert.equal(tz.includes('BEGIN:DAYLIGHT'), false);
  assert.ok(tz.includes('TZOFFSETTO:+0900'));
});

test('les transitions sont datées à la minute, pas à l’heure', () => {
  const tz = buildVTimezone('Europe/Paris', 2026);
  for (const line of tz.filter((l) => l.startsWith('DTSTART:'))) {
    assert.ok(/T\d{2}\d{2}00$/.test(line), `transition mal arrondie : ${line}`);
  }
});

test('un décalage sans heure d’été est lu correctement', () => {
  assert.equal(offsetMinutes('UTC', new Date('2026-01-15T12:00:00Z')), 0);
  assert.equal(offsetMinutes('Asia/Tokyo', new Date('2026-01-15T12:00:00Z')), 540);
  assert.equal(offsetMinutes('Europe/Paris', new Date('2026-01-15T12:00:00Z')), 60);
  assert.equal(offsetMinutes('Europe/Paris', new Date('2026-07-15T12:00:00Z')), 120);
});

test('un calendrier sans séance reste un fichier valide', () => {
  // Aucun programme actif est une situation NORMALE : renvoyer une
  // erreur ferait afficher un abonnement en échec dans l'agenda.
  const ics = buildCalendar({ name: 'ForgeFit', starts_on: '2026-09-14', weeks: 1 }, []);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(find(ics, 'BEGIN:VEVENT').length, 0);
});

test('la description reprend les exercices et leurs cibles', () => {
  const ics = buildCalendar(PROGRAM, [day({
    items: [{
      name_fr: 'Développé couché', target_sets: 4, target_reps: 6,
      target_reps_max: 8, suggested_kg: 87.5,
    }],
  })], {});
  const description = unfold(ics);
  assert.ok(description.includes('Développé couché'), description);
  assert.ok(description.includes('4 × 6-8'), description);
  assert.ok(description.includes('87.5 kg'), description);
});

test('un rappel est attaché à chaque évènement', () => {
  const ics = buildCalendar(PROGRAM, [day()], { reminderMinutes: 30 });
  assert.ok(ics.includes('TRIGGER:-PT30M'));
});
