import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPORTS, CATEGORIES, CATEGORY_ORDER, catalogue, getSport,
  sessionKcal, distributeLoad, SECONDARY_WEIGHT,
} from '../src/services/sports.js';
import { MUSCLE_KEYS } from './helpers/muscle-keys.js';

test('chaque sport appartient à une catégorie déclarée', () => {
  for (const [key, sport] of Object.entries(SPORTS)) {
    assert.ok(CATEGORIES[sport.category], `${key} → catégorie ${sport.category} inconnue`);
  }
});

test('toutes les catégories sont ordonnées, et l’ordre ne contient rien d’autre', () => {
  assert.deepEqual([...CATEGORY_ORDER].sort(), Object.keys(CATEGORIES).sort());
});

test('aucune catégorie n’est vide', () => {
  for (const cat of catalogue()) {
    assert.ok(cat.sports.length > 0, `${cat.key} n’a aucun sport`);
  }
});

test('les MET restent dans une plage physiologiquement plausible', () => {
  for (const [key, sport] of Object.entries(SPORTS)) {
    // 2 MET = à peine plus que le repos ; 20 MET = record du monde de
    // course. Hors de cette plage, c’est une faute de frappe.
    assert.ok(sport.met >= 2 && sport.met <= 20, `${key} : ${sport.met} MET`);
  }
});

test('le RPE par défaut est une valeur d’échelle valide', () => {
  for (const [key, sport] of Object.entries(SPORTS)) {
    assert.ok(sport.rpe >= 1 && sport.rpe <= 10, `${key} : RPE ${sport.rpe}`);
  }
});

test('les profils musculaires n’emploient que des muscles connus du mannequin', () => {
  // Un muscle mal orthographié ne provoque aucune erreur : il n’allume
  // simplement jamais la silhouette. C’est exactement le genre de bug
  // qu’on ne voit pas.
  for (const [key, sport] of Object.entries(SPORTS)) {
    for (const role of ['primary', 'secondary']) {
      for (const muscle of sport.muscles?.[role] ?? []) {
        assert.ok(MUSCLE_KEYS.has(muscle), `${key}.${role} : « ${muscle} » inconnu`);
      }
    }
  }
});

test('un muscle n’est jamais à la fois principal et secondaire', () => {
  for (const [key, sport] of Object.entries(SPORTS)) {
    const primary = new Set(sport.muscles?.primary ?? []);
    for (const m of sport.muscles?.secondary ?? []) {
      assert.ok(!primary.has(m), `${key} : « ${m} » listé deux fois`);
    }
  }
});

test('la musculation n’a pas de profil figé', () => {
  // Son profil vient des exercices réellement enregistrés : une
  // attribution moyenne serait moins juste que la donnée réelle.
  assert.equal(SPORTS.musculation.muscles, null);
  assert.deepEqual(distributeLoad('musculation', 500), []);
});

test('getSport enrichit de la catégorie, et refuse l’inconnu', () => {
  const s = getSport('bloc');
  assert.equal(s.category, 'grimpe');
  assert.equal(s.category_meta.label, 'Escalade et grimpe');
  assert.equal(getSport('quidditch'), null);
});

test('la dépense suit MET × poids × heures', () => {
  // Football à 10 MET, 75 kg, 1 h → 750 kcal.
  assert.equal(sessionKcal({ sportKey: 'football', minutes: 60, weightKg: 75 }), 750);
  assert.equal(sessionKcal({ sportKey: 'football', minutes: 30, weightKg: 75 }), 375);
});

test('la dépense refuse de deviner ce qu’elle ignore', () => {
  assert.equal(sessionKcal({ sportKey: 'football', minutes: 60 }), null);
  assert.equal(sessionKcal({ sportKey: 'football', weightKg: 75 }), null);
  assert.equal(sessionKcal({ sportKey: 'quidditch', minutes: 60, weightKg: 75 }), null);
});

test('la charge répartie sur les muscles somme à la charge de séance', () => {
  for (const key of Object.keys(SPORTS)) {
    const parts = distributeLoad(key, 1000);
    if (!parts.length) continue;
    const total = parts.reduce((n, p) => n + p.load, 0);
    // Tolérance d'arrondi : chaque part est arrondie au centième.
    assert.ok(Math.abs(total - 1000) < 1, `${key} : somme ${total}`);
  }
});

test('un sport listant beaucoup de muscles ne pèse pas plus lourd', () => {
  // Sans normalisation, le MMA (11 muscles) aurait écrasé le
  // home-trainer (6) à effort identique.
  const mma = distributeLoad('mma', 600).reduce((n, p) => n + p.load, 0);
  const velo = distributeLoad('home_trainer', 600).reduce((n, p) => n + p.load, 0);
  assert.ok(Math.abs(mma - velo) < 1);
});

test('un muscle secondaire reçoit 0,4 fois la part d’un principal', () => {
  const parts = distributeLoad('natation', 1000);
  const primary = parts.find((p) => p.role === 'principal');
  const secondary = parts.find((p) => p.role === 'secondaire');
  const ratio = secondary.load / primary.load;
  assert.ok(Math.abs(ratio - SECONDARY_WEIGHT) < 0.01, `rapport ${ratio}`);
});

test('une charge nulle ne répartit rien', () => {
  assert.deepEqual(distributeLoad('football', 0), []);
});

test('la liste de muscles du backend reste synchronisée avec le mannequin', async () => {
  // La duplication est assumée (cf. helpers/muscle-keys.js), mais une
  // duplication non vérifiée finit toujours par diverger : un muscle
  // renommé côté front, et les profils de sport cessent silencieusement
  // d'allumer la silhouette.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = fileURLToPath(
    new URL('../../frontend/src/lib/anatomy.js', import.meta.url),
  );

  const source = readFileSync(path, 'utf8');
  const block = source.slice(
    source.indexOf('export const MUSCLE_LABELS = {'),
    source.indexOf('};', source.indexOf('export const MUSCLE_LABELS = {')),
  );
  const front = new Set([...block.matchAll(/^\s*'?([a-z ]+?)'?:\s*'/gm)].map((m) => m[1]));

  assert.ok(front.size > 15, `extraction douteuse : ${front.size} muscles trouvés`);
  for (const key of front) {
    assert.ok(MUSCLE_KEYS.has(key), `« ${key} » existe côté front mais pas ici`);
  }
  for (const key of MUSCLE_KEYS) {
    assert.ok(front.has(key), `« ${key} » listé ici mais absent du mannequin`);
  }
});

// --- Lieux de pratique ---------------------------------------------------

test('chaque lieu ne référence que des sports du catalogue', async () => {
  const { LOCATIONS, SPORTS: CAT } = await import('../src/services/sports.js');
  for (const [key, l] of Object.entries(LOCATIONS)) {
    for (const sport of l.sports) {
      // Une clé morte ne provoque aucune erreur : le sport disparaît
      // simplement de la liste. C'est exactement le genre de bug qu'on
      // ne voit pas.
      assert.ok(CAT[sport], `${key} → sport inconnu « ${sport} »`);
    }
  }
});

test('tous les lieux sont ordonnés, et l’ordre ne contient rien d’autre', async () => {
  const { LOCATIONS, LOCATION_ORDER } = await import('../src/services/sports.js');
  assert.deepEqual([...LOCATION_ORDER].sort(), Object.keys(LOCATIONS).sort());
});

test('aucun lieu n’est vide, et chacun annonce sa fenêtre de temps', async () => {
  const { locations: places } = await import('../src/services/sports.js');
  for (const l of places()) {
    assert.ok(l.sports.length > 0, `${l.key} n’a aucun sport praticable`);
    assert.ok(l.equipment.length > 0, `${l.key} n’a aucun matériel listé`);
    const [min, max] = l.typical_minutes;
    assert.ok(min > 0 && max > min, `${l.key} : fenêtre ${min}–${max} incohérente`);
    assert.ok(l.note && l.note.length > 30, `${l.key} : note absente`);
  }
});

test('les lieux résolvent le libellé des sports, pas seulement leur clé', async () => {
  const { locations: places } = await import('../src/services/sports.js');
  const maison = places().find((l) => l.key === 'maison');
  assert.ok(maison.sports.every((s) => s.label && s.category));
  assert.ok(maison.sports.some((s) => s.label === 'Yoga'));
});

test('un lieu sans matériel ne propose rien qui en exige', async () => {
  const { locations: places } = await import('../src/services/sports.js');
  // Le transport ne permet que ce qui se fait debout, sans rien.
  const transport = places().find((l) => l.key === 'transport');
  assert.deepEqual(transport.equipment, ['aucun']);
  assert.ok(transport.sports.every((s) => ['mobilite', 'endurance'].includes(s.category)),
    JSON.stringify(transport.sports.map((s) => [s.label, s.category])));
});
