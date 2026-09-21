import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CURATED, CURATED_BY_ID, MOVEMENT_PATTERNS, MUSCLE_GROUPS, REFERENCES,
  TIERS, byPattern, isCompound, resolveRefs, curationStats,
} from '../src/services/exercise-evidence.js';

// Le catalogue curé est une donnée éditoriale écrite à la main : c'est
// exactement le genre de fichier où une faute de frappe passe inaperçue
// jusqu'à ce qu'un programme se retrouve avec un créneau vide.

test('aucun exercice n’est classé deux fois', () => {
  const ids = CURATED.map((x) => x.id);
  const seen = new Set();
  const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  assert.deepEqual(duplicates, [], 'identifiants en double');
  assert.equal(CURATED_BY_ID.size, CURATED.length);
});

test('chaque entrée vise un patron et un palier connus', () => {
  for (const x of CURATED) {
    assert.ok(MOVEMENT_PATTERNS[x.pattern], `patron inconnu : ${x.pattern} (${x.id})`);
    assert.ok(TIERS[x.tier], `palier inconnu : ${x.tier} (${x.id})`);
    assert.ok(x.rank > 0, `rang invalide pour ${x.id}`);
  }
});

test('chaque référence citée existe', () => {
  for (const x of CURATED) {
    for (const key of x.refs) {
      assert.ok(REFERENCES[key], `référence inconnue : ${key} (${x.id})`);
    }
  }
});

test('chaque référence porte une citation et une affirmation', () => {
  for (const [key, ref] of Object.entries(REFERENCES)) {
    assert.ok(ref.citation?.length > 20, `citation trop courte : ${key}`);
    assert.ok(ref.claim?.length > 20, `affirmation manquante : ${key}`);
  }
});

test('les rangs d’un patron sont uniques et se suivent depuis 1', () => {
  for (const pattern of Object.keys(MOVEMENT_PATTERNS)) {
    const ranks = byPattern(pattern).map((x) => x.rank);
    if (!ranks.length) continue;
    assert.deepEqual(
      ranks,
      Array.from({ length: ranks.length }, (_, i) => i + 1),
      `rangs non consécutifs pour ${pattern} : ${ranks.join(',')}`,
    );
  }
});

test('les paliers sont ordonnés à l’intérieur d’un patron', () => {
  // Un accessoire mieux classé qu'un fondamental ferait remonter le
  // mauvais exercice en tête de liste, et les modèles piochent en tête.
  const order = { fondamental: 1, complement: 2, accessoire: 3 };
  for (const pattern of Object.keys(MOVEMENT_PATTERNS)) {
    const tiers = byPattern(pattern).map((x) => order[x.tier]);
    const sorted = [...tiers].sort((a, b) => a - b);
    assert.deepEqual(tiers, sorted, `paliers désordonnés pour ${pattern}`);
  }
});

test('un fondamental est toujours polyarticulaire', () => {
  for (const x of CURATED.filter((e) => e.tier === 'fondamental')) {
    assert.ok(
      isCompound(x.pattern),
      `${x.id} est classé fondamental sur un patron mono-articulaire (${x.pattern})`,
    );
  }
});

test('chaque patron structurant a au moins un exercice', () => {
  // Un modèle qui demande un patron vide produit un créneau non résolu.
  for (const pattern of Object.keys(MOVEMENT_PATTERNS)) {
    assert.ok(byPattern(pattern).length > 0, `patron sans exercice : ${pattern}`);
  }
});

test('les groupes musculaires des patrons existent', () => {
  for (const [key, p] of Object.entries(MOVEMENT_PATTERNS)) {
    for (const m of [...p.primary, ...p.secondary]) {
      assert.ok(MUSCLE_GROUPS[m], `groupe inconnu : ${m} (${key})`);
    }
    // Un muscle compté deux fois pour le même mouvement doublerait son
    // volume hebdomadaire.
    const all = [...p.primary, ...p.secondary];
    assert.equal(new Set(all).size, all.length, `muscle répété dans ${key}`);
  }
});

test('les patrons d’amplitude et d’endurance ne portent aucun muscle', () => {
  // Ils ne relèvent pas de la dose-réponse en séries : les compter
  // gonflerait le volume hebdomadaire d'un programme de mobilité.
  for (const key of ['mobility', 'flexibility', 'cardio']) {
    assert.deepEqual(MOVEMENT_PATTERNS[key].primary, []);
    assert.deepEqual(MOVEMENT_PATTERNS[key].secondary, []);
  }
});

test('resolveRefs rend des références complètes', () => {
  const resolved = resolveRefs(['maeo2023triceps', 'inexistante']);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].key, 'maeo2023triceps');
  assert.ok(resolved[0].citation.includes('Maeo'));
});

test('le catalogue couvre les trois paliers', () => {
  const stats = curationStats();
  assert.ok(stats.byTier.fondamental > 0);
  assert.ok(stats.byTier.complement > 0);
  assert.ok(stats.byTier.accessoire > 0);
  assert.equal(
    stats.byTier.fondamental + stats.byTier.complement + stats.byTier.accessoire,
    stats.total,
  );
});
