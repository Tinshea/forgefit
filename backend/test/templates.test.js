import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEMPLATES, TEMPLATE_CATEGORIES, EQUIPMENT_PROFILES,
  getTemplate, templateVolume, describeTemplate,
} from '../src/services/templates.js';
import { GOALS, WEEKLY_SETS, FREQUENCY } from '../src/services/evidence.js';
import {
  MOVEMENT_PATTERNS, REFERENCES, byPattern, SECONDARY_WEIGHT,
} from '../src/services/exercise-evidence.js';

const CATEGORY_KEYS = new Set(TEMPLATE_CATEGORIES.map((c) => c.key));

test('les clés de modèle sont uniques', () => {
  const keys = TEMPLATES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('chaque modèle déclare une catégorie, un objectif et un matériel connus', () => {
  for (const t of TEMPLATES) {
    assert.ok(CATEGORY_KEYS.has(t.category), `catégorie inconnue : ${t.category} (${t.key})`);
    assert.ok(GOALS[t.goal], `objectif inconnu : ${t.goal} (${t.key})`);
    assert.ok(
      EQUIPMENT_PROFILES[t.equipment_profile],
      `profil de matériel inconnu : ${t.equipment_profile} (${t.key})`,
    );
  }
});

test('days_per_week correspond au nombre de séances décrites', () => {
  // Un écart ferait afficher « 4 jours/semaine » sur un programme qui en
  // compte trois : le volume hebdomadaire annoncé serait faux.
  for (const t of TEMPLATES) {
    assert.equal(t.days.length, t.days_per_week, `incohérence sur ${t.key}`);
  }
});

test('chaque créneau vise un patron connu et porte une dose', () => {
  for (const t of TEMPLATES) {
    for (const day of t.days) {
      assert.ok(day.title?.length, `séance sans titre dans ${t.key}`);
      assert.ok(day.slots.length > 0, `séance vide dans ${t.key} : ${day.title}`);
      for (const slot of day.slots) {
        assert.ok(
          MOVEMENT_PATTERNS[slot.pattern],
          `patron inconnu : ${slot.pattern} (${t.key})`,
        );
        assert.ok(slot.sets > 0, `séries invalides dans ${t.key}`);
        assert.ok(
          slot.reps != null || slot.seconds != null,
          `créneau sans dose : ${slot.pattern} dans ${t.key}`,
        );
        if (slot.reps_max != null) {
          assert.ok(
            slot.reps_max >= slot.reps,
            `fourchette inversée : ${slot.reps}–${slot.reps_max} dans ${t.key}`,
          );
        }
      }
    }
  }
});

test('chaque patron utilisé a au moins un exercice classé', () => {
  // Sans cela, la résolution laisse un créneau vide et le programme
  // instancié ne couvre pas ce qu'il annonce.
  for (const t of TEMPLATES) {
    for (const day of t.days) {
      for (const slot of day.slots) {
        assert.ok(
          byPattern(slot.pattern).length > 0,
          `aucun exercice pour ${slot.pattern} (${t.key})`,
        );
      }
    }
  }
});

test('chaque source citée existe', () => {
  for (const t of TEMPLATES) {
    assert.ok(t.sources.length > 0, `modèle sans source : ${t.key}`);
    for (const key of t.sources) {
      assert.ok(REFERENCES[key], `référence inconnue : ${key} (${t.key})`);
    }
    assert.ok(t.why.length >= 3, `justification trop courte : ${t.key}`);
  }
});

test('le volume compte le travail secondaire à sa pondération', () => {
  // Un modèle d'un seul créneau de développé couché : 4 séries pour les
  // pectoraux, 4 × 0,4 pour les triceps et les deltoïdes.
  const volume = templateVolume({
    days: [{ title: 'Test', slots: [{ pattern: 'horizontal_push', sets: 4, seconds: null }] }],
  });
  const find = (m) => volume.muscles.find((x) => x.muscle === m);

  assert.equal(find('pectoraux').weekly_sets, 4);
  assert.equal(find('triceps').weekly_sets, Math.round(4 * SECONDARY_WEIGHT * 10) / 10);
  // La fréquence ne compte que le travail direct.
  assert.equal(find('pectoraux').sessions_per_week, 1);
  assert.equal(find('triceps').sessions_per_week, 0);
  assert.equal(find('triceps').is_targeted, false);
});

test('le verdict de volume n’écrase pas le nom du muscle', () => {
  // Le libellé du verdict et celui du muscle ont vécu sous la même clé :
  // chaque ligne du tableau s'appelait alors « Volume d'entretien ».
  for (const t of TEMPLATES) {
    for (const m of templateVolume(t).muscles) {
      assert.ok(m.label?.length, `muscle sans libellé dans ${t.key}`);
      assert.ok(m.volume_label?.length, `verdict manquant dans ${t.key}`);
      assert.notEqual(m.label, m.volume_label);
    }
  }
});

test('un muscle au-dessus du plafond récupérable est signalé', () => {
  const volume = templateVolume({
    days: [
      { title: 'A', slots: [{ pattern: 'knee_extension', sets: 15, seconds: null }] },
      { title: 'B', slots: [{ pattern: 'knee_extension', sets: 15, seconds: null }] },
    ],
  });
  assert.ok(volume.muscles[0].weekly_sets > WEEKLY_SETS.maximumRecoverable);
  assert.ok(volume.warnings.some((w) => w.includes('plafond récupérable')));
});

test('un muscle ciblé une seule fois par semaine est signalé', () => {
  const volume = templateVolume({
    days: [{ title: 'A', slots: [{ pattern: 'knee_extension', sets: 8, seconds: null }] }],
  });
  assert.equal(volume.muscles[0].sessions_per_week, 1);
  assert.equal(volume.muscles[0].meets_frequency, FREQUENCY.minimumPerMuscle <= 1);
  assert.ok(volume.warnings.some((w) => w.includes('une seule séance')));
});

test('un muscle seulement travaillé en second ne déclenche pas d’alerte', () => {
  const volume = templateVolume({
    days: [
      { title: 'A', slots: [{ pattern: 'horizontal_push', sets: 4, seconds: null }] },
      { title: 'B', slots: [{ pattern: 'horizontal_push', sets: 4, seconds: null }] },
    ],
  });
  const triceps = volume.muscles.find((m) => m.muscle === 'triceps');
  assert.equal(triceps.is_targeted, false);
  assert.ok(
    !volume.warnings.some((w) => w.includes('Triceps')),
    'un muscle non ciblé ne doit pas être jugé contre les repères',
  );
});

test('le travail chronométré est compté en minutes, pas en séries', () => {
  const t = getTemplate('mobilite-sante-3');
  const volume = templateVolume(t);
  const flexibility = volume.timed.find((x) => x.pattern === 'flexibility');
  assert.ok(flexibility, 'la souplesse doit apparaître dans le dosage chronométré');
  assert.ok(flexibility.weekly_minutes > 0);
  // Aucun groupe musculaire ne doit avoir reçu de séries d'étirement.
  assert.ok(volume.muscles.every((m) => m.weekly_sets >= 0));
});

test('describeTemplate rend une fiche complète et sérialisable', () => {
  for (const t of TEMPLATES) {
    const d = describeTemplate(t);
    assert.equal(d.key, t.key);
    assert.ok(d.goal_label?.length);
    assert.ok(d.equipment_label?.length);
    assert.equal(d.days.length, t.days_per_week);
    for (const day of d.days) {
      for (const slot of day.slots) {
        assert.ok(slot.pattern_label?.length);
        assert.ok(slot.axis?.length);
      }
    }
    // L'API renvoie cet objet tel quel : il doit passer par JSON sans
    // perdre de Set ni de Map.
    assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
  }
});

test('getTemplate rend null sur une clé inconnue', () => {
  assert.equal(getTemplate('nexiste-pas'), null);
  assert.ok(getTemplate('haut-bas-4'));
});
