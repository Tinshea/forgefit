import test from 'node:test';
import assert from 'node:assert/strict';
import { MANUEL, manuelProblems } from '../src/services/combat-manual.js';
import {
  MANUELS, DETAILS, manuelDe, DISCIPLINES_DOCUMENTEES, collisions,
} from '../src/services/manuals/index.js';
import { DISCIPLINES, SOURCES } from '../src/services/disciplines.js';
import { SPORTS } from '../src/services/sports.js';

test('toute la catégorie combat est documentée', () => {
  const combat = Object.keys(SPORTS).filter((k) => SPORTS[k].category === 'combat');
  for (const k of combat) {
    assert.ok(MANUEL[k], `discipline de combat non documentée : ${k}`);
  }
});

test('chaque catégorie annoncée couverte l’est INTÉGRALEMENT', () => {
  // Une catégorie à moitié documentée serait pire qu'une catégorie
  // absente : on croirait la discipline manquante alors qu'elle a été
  // oubliée.
  const COUVERTES = ['combat', 'endurance', 'force', 'grimpe', 'mobilite'];
  for (const cat of COUVERTES) {
    const sports = Object.keys(SPORTS).filter((k) => SPORTS[k].category === cat);
    assert.ok(sports.length > 0, `catégorie inconnue au catalogue : ${cat}`);
    for (const k of sports) {
      assert.ok(MANUELS[k], `${cat} : ${k} non documenté`);
      assert.ok(DETAILS[k], `${cat} : détail manquant pour ${k}`);
    }
  }
});

test('deux catégories ne documentent jamais la même discipline', () => {
  // La seconde écraserait silencieusement la première à la fusion.
  assert.deepEqual(collisions(), []);
});

test('toute discipline documentée existe au catalogue', () => {
  for (const k of DISCIPLINES_DOCUMENTEES) {
    assert.ok(SPORTS[k], `manuel pour un sport inexistant : ${k}`);
  }
});

test('chaque fiche est complète', () => {
  const problemes = manuelProblems();
  assert.deepEqual(problemes, [], problemes.join(' | '));
});

test('chaque discipline documentée a AUSSI un profil d’exigence', () => {
  // Une fiche sans profil afficherait « ce que ça exige : non documenté »
  // juste sous un manuel détaillé — incohérent pour le lecteur.
  for (const k of DISCIPLINES_DOCUMENTEES) {
    assert.ok(DISCIPLINES.some((d) => d.key === k), `pas de profil pour ${k}`);
  }
});

test('toutes les sources citées existent réellement', () => {
  // Une clé morte afficherait une référence vide : le lecteur croirait
  // à une source alors qu'il n'y a rien derrière.
  for (const [key, m] of Object.entries(MANUEL)) {
    for (const s of m.sources) {
      assert.ok(SOURCES[s], `${key} cite une source inconnue : ${s}`);
    }
  }
  for (const d of DISCIPLINES) {
    for (const s of d.sources) {
      assert.ok(SOURCES[s], `${d.key} cite une source inconnue : ${s}`);
    }
  }
});

test('un esprit annoncé CODIFIÉ cite ses principes', () => {
  // C'est l'engagement du fichier : ne pas prêter de doctrine à une
  // discipline qui n'en revendique pas.
  for (const [key, m] of Object.entries(MANUEL)) {
    if (m.esprit.codifie) {
      assert.ok(m.esprit.principes.length > 0, `${key} : codifié sans principes`);
      for (const p of m.esprit.principes) {
        assert.ok(p.nom && p.texte, `${key} : principe incomplet`);
      }
    }
  }
});

test('les disciplines SANS doctrine le disent explicitement', () => {
  // Boxe, MMA et lutte n'ont pas de corpus écrit. Le fichier doit le
  // dire, pas rester muet — le silence laisserait croire à un oubli.
  for (const k of ['boxe', 'mma', 'lutte']) {
    assert.equal(MANUEL[k].esprit.codifie, false, k);
    assert.ok(MANUEL[k].esprit.texte.length > 60, `${k} : l’absence de doctrine doit être expliquée`);
  }
});

test('judo, karaté, boxe thaï et escrime citent une doctrine réelle', () => {
  for (const k of ['judo', 'karate', 'boxe_thai', 'escrime']) {
    assert.equal(MANUEL[k].esprit.codifie, true, k);
  }
  // Les deux principes de Kano sont nommés : c'est vérifiable.
  const noms = MANUEL.judo.esprit.principes.map((p) => p.nom.toLowerCase());
  assert.ok(noms.some((n) => n.includes('seiryoku')));
  assert.ok(noms.some((n) => n.includes('jita')));
});

test('chaque fiche propose de quoi démarrer concrètement', () => {
  for (const [key, m] of Object.entries(MANUEL)) {
    assert.ok(m.demarrer.materiel.length > 0, `${key} : pas de matériel`);
    assert.ok(m.demarrer.premiere_seance.length > 40, `${key} : première séance trop vague`);
    assert.ok(m.demarrer.reperes.length > 0, `${key} : pas de repères`);
  }
});

test('le répertoire technique est groupé par famille et non vide', () => {
  for (const [key, m] of Object.entries(MANUEL)) {
    assert.ok(m.techniques.length > 0, key);
    for (const f of m.techniques) {
      assert.ok(f.famille, `${key} : famille sans nom`);
      assert.ok(f.items.length > 0, `${key} / ${f.famille} : famille vide`);
      for (const it of f.items) assert.ok(it.nom && it.gloss, `${key} : technique incomplète`);
    }
  }
});

test('chaque fiche expose au moins trois méthodes d’entraînement', () => {
  // Une discipline se pratique ; lister des techniques sans dire
  // COMMENT on les travaille laisse le lecteur au bord du tapis.
  for (const [key, m] of Object.entries(MANUEL)) {
    assert.ok(m.methodes.length >= 3, `${key} : ${m.methodes.length} méthode(s)`);
    for (const me of m.methodes) assert.ok(me.nom && me.role, `${key} : méthode incomplète`);
  }
});

test('une discipline inconnue renvoie null, sans lever', () => {
  assert.equal(manuelDe('curling'), null);
  assert.equal(manuelDe(undefined), null);
});

/* ─── La partie détaillée ─────────────────────────────────────────── */

test('chaque discipline documentée a sa partie détaillée', async () => {
  // Par le REGISTRE, pas par le fichier de combat : la liste couvre
  // désormais plusieurs catégories, chacune avec son propre fichier.
  const { detailDe } = await import('../src/services/manuals/index.js');
  for (const k of DISCIPLINES_DOCUMENTEES) {
    assert.ok(DETAILS[k], `pas de détail pour ${k}`);
  }
  assert.equal(detailDe('curling'), null);
});

test('chaque partie détaillée est complète', async () => {
  const { detailProblems } = await import('../src/services/combat-manual-detail.js');
  const p = detailProblems();
  assert.deepEqual(p, [], p.join(' | '));
});

test('une faute listée dit TOUJOURS comment la corriger', async () => {
  // Signaler une faute sans sa correction est un reproche, pas un
  // enseignement — et c'est exactement ce qu'on veut éviter.
  const { DETAIL } = await import('../src/services/combat-manual-detail.js');
  for (const [k, d] of Object.entries(DETAIL)) {
    assert.ok(d.erreurs.length >= 4, `${k} : seulement ${d.erreurs.length} erreurs`);
    for (const e of d.erreurs) {
      assert.ok(e.correction.length > 20, `${k} : correction trop vague pour « ${e.faute} »`);
    }
  }
});

test('la séance type couvre une durée plausible', async () => {
  const { DETAIL } = await import('../src/services/combat-manual-detail.js');
  for (const [k, d] of Object.entries(DETAIL)) {
    const total = d.seance_type.reduce((a, p) => a + p.minutes, 0);
    assert.ok(total >= 60 && total <= 130, `${k} : séance de ${total} min`);
  }
});

test('chaque discipline dit comment on y gagne', async () => {
  const { DETAIL } = await import('../src/services/combat-manual-detail.js');
  for (const [k, d] of Object.entries(DETAIL)) {
    assert.ok(d.format.victoire.length >= 2, `${k}`);
    assert.ok(d.format.duree.length > 15, `${k}`);
    assert.ok(d.format.instance.length > 3, `${k}`);
  }
});

test('la sécurité ne se contente pas de lister des blessures', async () => {
  // Nommer un risque sans dire quoi faire n'aide personne.
  const { DETAIL } = await import('../src/services/combat-manual-detail.js');
  for (const [k, d] of Object.entries(DETAIL)) {
    assert.ok(d.securite.frequentes.length > 0, k);
    assert.ok(d.securite.prevention.length >= 2, `${k} : prévention trop courte`);
  }
});

/* ─── Les mêmes exigences pour TOUTES les catégories ──────────────── */

test('chaque fiche de chaque catégorie est complète', async () => {
  // Le contrôle vit dans le registre : une catégorie ajoutée est
  // vérifiée d'office, sans que personne ait à y penser.
  const { problemes } = await import('../src/services/manuals/index.js');
  const p = problemes();
  assert.deepEqual(p, [], p.join(' | '));
});

test('chaque discipline documentée a un profil d’exigence sourcé', async () => {
  const { DISCIPLINES: D, SOURCES: S } = await import('../src/services/disciplines.js');
  for (const k of DISCIPLINES_DOCUMENTEES) {
    const d = D.find((x) => x.key === k);
    assert.ok(d, `pas de profil pour ${k}`);
    assert.ok(d.sources.length > 0, `${k} : profil sans source`);
    for (const src of d.sources) assert.ok(S[src], `${k} cite une source inconnue : ${src}`);
  }
});

test('les priorités d’un profil renvoient à des qualités déclarées', async () => {
  const { DISCIPLINES: D, QUALITES } = await import('../src/services/disciplines.js');
  for (const d of D) {
    for (const p of d.priorites) {
      assert.ok(QUALITES[p], `${d.key} : qualité inconnue « ${p} »`);
      assert.ok(d.exigences[p] != null, `${d.key} : priorité « ${p} » sans pondération`);
    }
    for (const q of Object.keys(d.exigences)) {
      assert.ok(QUALITES[q], `${d.key} : pondération pour une qualité inconnue « ${q} »`);
    }
  }
});

test('les manuels d’endurance citent la répartition polarisée', async () => {
  // C'est le résultat le mieux établi de la littérature d'endurance
  // (Seiler 2010), et l'erreur la plus répandue chez le pratiquant.
  const { MANUEL: E } = await import('../src/services/manuals/endurance.js');
  const concernes = ['course', 'trail', 'velo_route', 'natation', 'aviron', 'ski_fond'];
  for (const k of concernes) {
    const noms = E[k].methodes.map((m) => m.nom);
    assert.ok(noms.some((n) => /polaris/i.test(n)), `${k} ne mentionne pas la répartition`);
  }
});
