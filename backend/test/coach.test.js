import test from 'node:test';
import assert from 'node:assert/strict';
import { seanceDuJour, SEUILS, NATURES } from '../src/services/coach.js';
import {
  disciplineOf, prioritesPhysiques, semaineType, DISCIPLINES,
} from '../src/services/disciplines.js';
import {
  programmeDuGrade, prochainGrade, GRADES, KATA, KUMITE, TECHNIQUES,
} from '../src/services/karate-syllabus.js';

/* ─── Le syllabus ─────────────────────────────────────────────────── */

test('chaque grade ne renvoie qu’à des techniques et kata qui existent', () => {
  // Une clé morte ne lèverait aucune erreur : la séance afficherait un
  // tiret à la place d'un contenu, et personne ne saurait pourquoi.
  for (const g of GRADES) {
    for (const t of g.techniques) {
      assert.ok(TECHNIQUES[t], `technique inconnue au ${g.kyu}e kyu : ${t}`);
    }
    for (const k of g.kata) {
      assert.ok(KATA.some((x) => x.key === k), `kata inconnu au ${g.kyu}e kyu : ${k}`);
    }
    for (const k of g.kumite) {
      assert.ok(KUMITE.some((x) => x.key === k), `kumité inconnu au ${g.kyu}e kyu : ${k}`);
    }
  }
});

test('les grades vont du 9e au 1er kyu, sans trou', () => {
  const kyus = GRADES.map((g) => g.kyu);
  assert.deepEqual(kyus, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test('le programme d’un grade CUMULE ce qui précède', () => {
  // Un 5e kyu doit encore savoir faire son oi-zuki de 9e kyu : un
  // programme qui n'afficherait que le dernier grade laisserait croire
  // que le reste s'oublie.
  const p = programmeDuGrade(5);
  assert.ok(p.techniques.includes('oi-zuki'), 'les bases du 9e kyu restent au programme');
  assert.ok(p.techniques.includes('mawashi-geri'), 'et celles du grade courant aussi');
  assert.ok(p.kata.includes('heian-shodan'));
  assert.ok(p.kata.includes('heian-yondan'));
});

test('le kumité ne s’empile PAS : on garde la forme la plus avancée', () => {
  // Contrairement aux techniques, travailler les cinq formes de kumité
  // à la fois n'a pas de sens : c'est une progression, pas une liste.
  assert.equal(programmeDuGrade(5).kumite, 'kihon-ippon');
  assert.equal(programmeDuGrade(8).kumite, 'gohon');
  assert.equal(programmeDuGrade(1).kumite, 'jiyu');
});

test('le grade suivant n’expose QUE ce qui reste à apprendre', () => {
  const suivant = prochainGrade(5);
  assert.equal(suivant.kyu, 4);
  assert.deepEqual(suivant.kata, ['heian-godan']);
  assert.ok(!suivant.techniques.includes('mawashi-geri'), 'déjà acquis au grade courant');
});

test('il n’y a rien après le 1er kyu', () => {
  // Le passage au dan sort du cadre de ce fichier : il ne s'obtient pas
  // en cochant des cases.
  assert.equal(prochainGrade(1), null);
});

/* ─── Les exigences de la discipline ──────────────────────────────── */

test('chaque discipline renvoie à des qualités et des sources réelles', () => {
  for (const d of DISCIPLINES) {
    for (const s of d.sources) {
      assert.ok(typeof s === 'string' && s.length > 0);
    }
    assert.ok(d.priorites.every((p) => d.exigences[p] != null));
  }
});

test('les priorités du karaté sont la puissance et l’anaérobie, pas la force maximale', () => {
  // C'est le résultat de Chaabene 2012 et de Zehr & Sale : une frappe
  // dure moins longtemps que le temps d'atteindre sa force maximale.
  const p = prioritesPhysiques('karate').map((x) => x.quality);
  assert.equal(p[0], 'puissance');
  assert.ok(p.includes('anaerobie'));
  assert.ok(!p.includes('force_max'), 'la force max entretient, elle ne décide pas');
});

test('une discipline inconnue ne fait rien planter', () => {
  assert.equal(disciplineOf('curling'), null);
  assert.deepEqual(prioritesPhysiques('curling'), []);
  assert.equal(semaineType('curling', 3), null);
});

/* ─── La semaine type ─────────────────────────────────────────────── */

test('la semaine type respecte le nombre de séances demandé', () => {
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const plan = semaineType('karate', n);
    const total = Object.values(plan).reduce((a, b) => a + b, 0);
    assert.equal(total, n, `${n} séances demandées`);
  }
});

test('sur un multiple exact du rapport, la répartition tombe juste', () => {
  // Le rapport est 3 technique / 2 physique / 1 souplesse, soit six
  // parts : à six séances, aucun arrondi n'intervient.
  assert.deepEqual(semaineType('karate', 6), { technique: 3, physique: 2, souplesse: 1 });
  assert.deepEqual(semaineType('karate', 12), { technique: 6, physique: 4, souplesse: 2 });
});

test('ailleurs, l’écart au rapport idéal reste sous une séance', () => {
  // Avec des séances entières, doubler le volume ne double PAS chaque
  // part : 3 séances donnent 2/1/0, et 6 donnent 3/2/1. Ce qui doit
  // tenir, c'est que personne ne s'éloigne de son dû de plus d'une
  // séance — au-delà, la nature de l'entraînement changerait avec le
  // volume, ce qui n'a pas de sens.
  const parts = { technique: 3, physique: 2, souplesse: 1 };
  const total = 6;
  for (let n = 1; n <= 10; n += 1) {
    const plan = semaineType('karate', n);
    for (const [nature, part] of Object.entries(parts)) {
      const ideal = (n * part) / total;
      assert.ok(Math.abs(plan[nature] - ideal) < 1,
        `${n} séances, ${nature} : ${plan[nature]} contre ${ideal.toFixed(2)} attendu`);
    }
  }
});

test('la technique n’est jamais rognée par l’arrondi', () => {
  // Avec peu de séances, l'arrondi doit favoriser ce qui fait progresser
  // le plus vite dans une discipline technique.
  assert.ok(semaineType('karate', 1).technique >= 1);
  assert.ok(semaineType('karate', 2).technique >= 1);
});

test('zéro séance ne produit pas un plan vide mais pas de plan du tout', () => {
  assert.equal(semaineType('karate', 0), null);
});

/* ─── Le coach ────────────────────────────────────────────────────── */

const base = {
  discipline: 'karate', kyu: 5, seancesParSemaine: 4,
  maintenant: new Date('2026-09-22T10:00:00Z'),
};

test('une charge trop haute impose la récupération, quoi que prévoie le plan', () => {
  const s = seanceDuJour({ ...base, charge: { acwr: 1.8 } });
  assert.equal(s.nature, 'recuperation');
  assert.equal(s.prioritaire, true);
  assert.ok(s.raisons.some((r) => r.source === 'gabbett-2016'));
  assert.ok(s.raisons[0].texte.includes('1.80'), 'le chiffre est dit, pas seulement le verdict');
});

test('une monotonie trop haute renvoie vers la souplesse', () => {
  const s = seanceDuJour({ ...base, charge: { monotonie: 2.4 } });
  assert.equal(s.nature, 'souplesse');
  assert.ok(s.raisons.some((r) => r.source === 'foster-1998'));
});

test('la fatigue passe AVANT le plan de la semaine', () => {
  // Rien n'a encore été fait cette semaine : le plan réclamerait de la
  // technique. La charge doit primer.
  const s = seanceDuJour({ ...base, charge: { acwr: 1.9 }, faitCetteSemaine: {} });
  assert.equal(s.nature, 'recuperation');
});

test('sans rien de fait, on commence par ce que la semaine prévoit le plus', () => {
  const s = seanceDuJour({ ...base, charge: { acwr: 1.0 } });
  assert.equal(s.nature, 'technique');
  assert.ok(s.contenu.blocs.length >= 3);
});

test('une séance physique récente interdit d’en reprendre une', () => {
  const s = seanceDuJour({
    ...base,
    charge: { acwr: 1.0 },
    faitCetteSemaine: { technique: 2, souplesse: 1 },
    derniere: { physique: '2026-09-22T00:00:00Z' }, // il y a 10 h
  });
  assert.notEqual(s.nature, 'physique');
  assert.ok(s.raisons.some((r) => r.source === 'zehr-sale-1994'));
});

test('passé le délai, la séance physique redevient possible', () => {
  const s = seanceDuJour({
    ...base,
    charge: { acwr: 1.0 },
    faitCetteSemaine: { technique: 2, souplesse: 1 },
    derniere: { physique: '2026-09-19T10:00:00Z' }, // il y a 72 h
  });
  assert.equal(s.nature, 'physique');
});

test('une semaine accomplie donne du repos, pas une séance de plus', () => {
  const plan = semaineType('karate', 4);
  const s = seanceDuJour({ ...base, charge: { acwr: 1.0 }, faitCetteSemaine: plan });
  assert.equal(s.nature, 'repos');
  assert.equal(s.minutes, 0);
  assert.ok(s.raisons[0].texte.includes('adaptation'));
});

test('la séance technique porte sur le grade visé, et pas sur tout à la fois', () => {
  const s = seanceDuJour({ ...base, charge: { acwr: 1.0 } });
  const kihon = s.contenu.blocs.find((b) => b.label === 'Kihon');
  // Trois éléments au plus : une séance qui en liste douze n'en fait
  // travailler aucun.
  assert.ok(kihon.detail.split('·').length <= 3);
});

test('ce qui est acquis sort de la séance', () => {
  const sans = seanceDuJour({ ...base, charge: { acwr: 1.0 } });
  const avec = seanceDuJour({
    ...base, charge: { acwr: 1.0 },
    acquis: ['mawashi-geri', 'kizami-zuki', 'uraken-uchi', 'ashi-barai'],
  });
  const kihonSans = sans.contenu.blocs.find((b) => b.label === 'Kihon').detail;
  const kihonAvec = avec.contenu.blocs.find((b) => b.label === 'Kihon').detail;
  assert.notEqual(kihonSans, kihonAvec);
  assert.ok(!kihonAvec.includes('Mawashi-geri'));
});

test('toute recommandation porte au moins une raison', () => {
  for (const charge of [{ acwr: 1.8 }, { monotonie: 2.4 }, { acwr: 1.0 }, { acwr: 0.5 }]) {
    const s = seanceDuJour({ ...base, charge });
    assert.ok(s.raisons.length > 0, JSON.stringify(charge));
    assert.ok(s.raisons.every((r) => typeof r.texte === 'string' && r.texte.length > 10));
  }
});

test('la séance physique cite ce que la discipline exige', () => {
  const s = seanceDuJour({
    ...base, charge: { acwr: 1.0 },
    faitCetteSemaine: { technique: 2, souplesse: 1 },
  });
  assert.equal(s.nature, 'physique');
  assert.ok(s.raisons.some((r) => r.texte.includes('/10')));
  assert.ok(s.raisons.some((r) => r.source === 'chaabene-2012'));
});

test('la séance technique rappelle qu’elle ne remplace pas un professeur', () => {
  const s = seanceDuJour({ ...base, charge: { acwr: 1.0 } });
  assert.match(s.contenu.avertissement, /œil extérieur/);
});

test('le coach est DÉTERMINISTE : mêmes entrées, même sortie', () => {
  // C'est la propriété qui permet de contester une décision : sans
  // elle, « pourquoi ça aujourd'hui » n'a pas de réponse stable.
  const a = seanceDuJour({ ...base, charge: { acwr: 1.1 } });
  const b = seanceDuJour({ ...base, charge: { acwr: 1.1 } });
  assert.deepEqual(a, b);
});

test('une discipline inconnue ne produit pas de séance', () => {
  assert.equal(seanceDuJour({ ...base, discipline: 'curling' }), null);
  assert.equal(seanceDuJour({}), null);
});

test('une charge inconnue n’empêche pas de décider', () => {
  // Les premiers jours, il n'y a pas d'historique : le coach doit
  // quand même proposer quelque chose plutôt que de se taire.
  const s = seanceDuJour({ ...base, charge: {} });
  assert.ok(s != null);
  assert.ok(NATURES[s.nature]);
});

/* ─── Ce qui est prévu passe avant ce que le coach proposerait ─────── */

test('une séance au programme EST la séance du jour', () => {
  const s = seanceDuJour({
    ...base,
    charge: { acwr: 1.0 },
    prevu: { titre: 'Haut du corps A', minutes: 75, origine: 'programme' },
  });
  assert.equal(s.nature, 'prevue');
  assert.equal(s.label, 'Haut du corps A');
  assert.equal(s.minutes, 75);
  assert.equal(s.propose, false, 'ce n’est pas une proposition, c’est le plan');
});

test('la charge AVERTIT sur une séance prévue, elle ne la remplace pas', () => {
  // C'est la règle demandée : on suit le programme. La charge donne de
  // quoi décider de repousser, elle ne repousse pas à la place.
  const s = seanceDuJour({
    ...base,
    charge: { acwr: 1.9 },
    prevu: { titre: 'Jambes', minutes: 60, origine: 'programme' },
  });
  assert.equal(s.nature, 'prevue');
  assert.equal(s.label, 'Jambes');
  assert.equal(s.alertes.length, 1);
  assert.equal(s.alertes[0].gravite, 'haute');
  assert.equal(s.alertes[0].source, 'gabbett-2016');
});

test('sans plan du jour, le coach propose — et le dit', () => {
  const s = seanceDuJour({ ...base, charge: { acwr: 1.0 } });
  assert.equal(s.propose, true);
});

test('une séance prévue vaut pour n’importe quelle discipline, même inconnue', () => {
  // Le plan fait foi : muscu, sport, ou autre. Le coach n'a pas besoin
  // de connaître la discipline pour respecter ce qui est écrit.
  const s = seanceDuJour({
    discipline: null,
    prevu: { titre: 'Sortie vélo', minutes: 90, origine: 'calendrier' },
  });
  assert.equal(s.nature, 'prevue');
  assert.equal(s.label, 'Sortie vélo');
  assert.match(s.raisons[0].texte, /prévu/);
});

test('sans plan ET sans objectif, on ne propose RIEN plutôt que n’importe quoi', () => {
  assert.equal(seanceDuJour({ discipline: null }), null);
});

test('la séance prévue porte l’origine du plan', () => {
  const prog = seanceDuJour({ ...base, prevu: { titre: 'A', origine: 'programme' } });
  const cal = seanceDuJour({ ...base, prevu: { titre: 'B', origine: 'calendrier' } });
  assert.equal(prog.source_plan, 'programme');
  assert.equal(cal.source_plan, 'calendrier');
  assert.match(prog.raisons[0].texte, /à ton programme/);
  assert.match(cal.raisons[0].texte, /Tu avais prévu/);
});
