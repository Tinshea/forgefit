import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProgram, weeklySetsFor, volumeVerdict, suggestLoad, GOAL_PRESETS,
} from '../src/services/program-builder.js';
import { WEEKLY_SETS, FREQUENCY } from '../src/services/evidence.js';

const SCORES = {
  push: 63, pull: 67, legs: 66, mobility: 33,
  flexibility: 75, explosive: 17, endurance: 0, core: 0,
};

test('weeklySetsFor: toujours dans les bornes de la littérature', () => {
  for (const goal of Object.values(GOAL_PRESETS)) {
    for (let score = 0; score <= 100; score += 5) {
      const sets = weeklySetsFor(score, goal);
      assert.ok(sets >= WEEKLY_SETS.maintenance,
        `${sets} sous le volume d'entretien à score=${score}`);
      assert.ok(sets <= WEEKLY_SETS.maximumRecoverable,
        `${sets} au-dessus du plafond récupérable à score=${score}`);
    }
  }
});

test('weeklySetsFor: un point faible reçoit plus de volume qu’un point fort', () => {
  const preset = GOAL_PRESETS.hypertrophie;
  const faible = weeklySetsFor(10, preset);
  const moyen = weeklySetsFor(50, preset);
  const fort = weeklySetsFor(90, preset);
  assert.ok(faible > moyen, `faible=${faible} moyen=${moyen}`);
  assert.ok(moyen > fort, `moyen=${moyen} fort=${fort}`);
});

test('weeklySetsFor: décroissance monotone avec le score', () => {
  const preset = GOAL_PRESETS.equilibre;
  let prev = Infinity;
  for (let score = 0; score <= 100; score += 5) {
    const sets = weeklySetsFor(score, preset);
    assert.ok(sets <= prev, `non monotone à score=${score} (${sets} > ${prev})`);
    prev = sets;
  }
});

test('weeklySetsFor: un score médian reste proche de la cible de l’objectif', () => {
  for (const preset of Object.values(GOAL_PRESETS)) {
    const sets = weeklySetsFor(50, preset);
    const expected = clampToLandmarks(preset.weeklySetsTarget);
    assert.equal(sets, expected, `${preset.label}: ${sets} ≠ ${expected}`);
  }
});

const clampToLandmarks = (v) => Math.round(
  Math.min(WEEKLY_SETS.maximumRecoverable, Math.max(WEEKLY_SETS.maintenance, v)),
);

test('volumeVerdict: paliers cohérents avec les repères', () => {
  assert.equal(volumeVerdict(WEEKLY_SETS.maintenance).label, 'Volume d’entretien');
  assert.equal(volumeVerdict(WEEKLY_SETS.minimumEffective).label, 'Volume de progression');
  assert.equal(volumeVerdict(WEEKLY_SETS.adaptiveRange[1]).label, 'Volume maximal');
});

test('buildProgram: le volume programmé respecte les repères', () => {
  for (const goal of Object.keys(GOAL_PRESETS)) {
    const { rationale } = buildProgram({ daysPerWeek: 4, goal, scores: SCORES });
    for (const row of rationale.volume_table) {
      if (row.timed) continue;
      assert.ok(row.weekly_sets >= WEEKLY_SETS.maintenance,
        `${goal}/${row.axis}: ${row.weekly_sets} sous l'entretien`);
      assert.ok(row.weekly_sets <= WEEKLY_SETS.maximumRecoverable,
        `${goal}/${row.axis}: ${row.weekly_sets} au-dessus du plafond`);
    }
  }
});

test('buildProgram: fréquence ≥ 2 sur les axes principaux dès 4 jours', () => {
  const { rationale } = buildProgram({ daysPerWeek: 4, goal: 'hypertrophie', scores: SCORES });
  for (const axis of ['push', 'pull', 'legs']) {
    const row = rationale.volume_table.find((r) => r.axis === axis);
    assert.ok(row.sessions_per_week >= FREQUENCY.minimumPerMuscle,
      `${axis}: ${row.sessions_per_week} séance(s) par semaine`);
    assert.equal(row.meets_frequency, true);
  }
});

test('buildProgram: un split 2 jours couvre quand même les axes principaux 2×', () => {
  const { rationale } = buildProgram({ daysPerWeek: 2, goal: 'equilibre', scores: SCORES });
  for (const axis of ['push', 'pull', 'legs']) {
    const row = rationale.volume_table.find((r) => r.axis === axis);
    assert.ok(row.sessions_per_week >= 2, `${axis}: ${row.sessions_per_week}`);
  }
});

test('buildProgram: un axe à fréquence 1 est signalé', () => {
  const { rationale } = buildProgram({ daysPerWeek: 3, goal: 'force', scores: SCORES });
  const single = rationale.volume_table.filter((r) => !r.timed && r.sessions_per_week < 2);
  if (single.length) {
    assert.ok(rationale.warnings.length > 0,
      'axes à une seule séance mais aucun avertissement');
  }
});

test('buildProgram: le volume réel colle au volume visé', () => {
  const { rationale } = buildProgram({ daysPerWeek: 4, goal: 'hypertrophie', scores: SCORES });
  for (const row of rationale.volume_table) {
    if (row.timed) continue;
    // L'arrondi en exercices entiers introduit un écart, borné ici.
    const gap = Math.abs(row.actual_weekly_sets - row.weekly_sets);
    assert.ok(gap <= row.sets_per_exercise * row.sessions_per_week,
      `${row.axis}: visé ${row.weekly_sets}, programmé ${row.actual_weekly_sets}`);
  }
});

test('buildProgram: chaque séance a au moins un exercice par axe', () => {
  for (const days of [2, 3, 4, 5, 6]) {
    const { days: plan } = buildProgram({ daysPerWeek: days, goal: 'equilibre', scores: SCORES });
    assert.equal(plan.length, days);
    for (const day of plan) {
      assert.ok(day.slots.length > 0, `jour ${day.day_index} sans axe`);
      for (const slot of day.slots) {
        assert.ok(slot.count >= 1, `${day.title}/${slot.axis}: ${slot.count} exercice`);
        assert.ok(slot.count <= 4, `${day.title}/${slot.axis}: ${slot.count} exercices, trop`);
      }
    }
  }
});

test('buildProgram: les axes chronométrés sortent en secondes, pas en reps', () => {
  const { days } = buildProgram({ daysPerWeek: 4, goal: 'equilibre', scores: SCORES });
  const timed = days.flatMap((d) => d.slots).filter((s) => ['mobility', 'flexibility'].includes(s.axis));
  assert.ok(timed.length > 0, 'aucun axe chronométré dans un split 4 jours');
  for (const slot of timed) {
    assert.ok(slot.seconds > 0, `${slot.axis}: pas de durée`);
    assert.equal(slot.reps, null, `${slot.axis}: des répétitions sur du chronométré`);
  }
});

test('buildProgram: la méthode et les sources sont exposées', () => {
  const { rationale } = buildProgram({ daysPerWeek: 4, goal: 'force', scores: SCORES });
  assert.ok(rationale.method.length >= 5);
  assert.ok(rationale.sources.length >= 4);
  for (const s of rationale.sources) {
    assert.ok(s.claim && s.source, JSON.stringify(s));
  }
  assert.ok(rationale.landmarks.minimum_effective === WEEKLY_SETS.minimumEffective);
});

test('buildProgram: la force programme moins de volume que l’hypertrophie', () => {
  const f = buildProgram({ daysPerWeek: 4, goal: 'force', scores: SCORES });
  const h = buildProgram({ daysPerWeek: 4, goal: 'hypertrophie', scores: SCORES });
  assert.ok(h.rationale.total_weekly_sets > f.rationale.total_weekly_sets,
    `hypertrophie=${h.rationale.total_weekly_sets} force=${f.rationale.total_weekly_sets}`);
  // ... mais avec des charges plus lourdes et moins de répétitions.
  assert.ok(f.preset.intensity > h.preset.intensity);
  assert.ok(f.preset.repsTarget < h.preset.repsTarget);
});

test('suggestLoad: arrondi au pas de 2,5 kg', () => {
  assert.equal(suggestLoad(100, 0.7), 70);
  assert.equal(suggestLoad(103, 0.7), 72.5);
  assert.equal(suggestLoad(0, 0.7), null);
  assert.ok(suggestLoad(1, 0.7) >= 2.5);
});
