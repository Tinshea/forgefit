import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, needsRehash, passwordProblems,
  newSessionToken, hashToken, throttleDelay, normalizeEmail,
  MIN_LENGTH, LOCK_MAX_MS, SCRYPT,
} from '../src/services/auth.js';

test('une empreinte se vérifie contre son propre mot de passe', async () => {
  const stored = await hashPassword('un cheval correct agrafe pile');
  assert.equal(await verifyPassword('un cheval correct agrafe pile', stored), true);
  assert.equal(await verifyPassword('un cheval correct agrafe pil', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('deux empreintes du MÊME mot de passe diffèrent', async () => {
  // Sans sel aléatoire, deux comptes partageant un mot de passe se
  // reconnaîtraient à l'œil dans la table, et une table précalculée
  // les casserait tous les deux d'un coup.
  const a = await hashPassword('un cheval correct agrafe pile');
  const b = await hashPassword('un cheval correct agrafe pile');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('un cheval correct agrafe pile', b), true);
});

test('l’empreinte transporte ses paramètres', async () => {
  const stored = await hashPassword('un cheval correct agrafe pile');
  const [algo, N, r, p] = stored.split('$');
  assert.equal(algo, 'scrypt');
  assert.equal(Number(N), SCRYPT.N);
  assert.equal(Number(r), SCRYPT.r);
  assert.equal(Number(p), SCRYPT.p);
  assert.equal(needsRehash(stored), false);
});

test('une empreinte aux paramètres dépassés demande un recalcul', () => {
  assert.equal(needsRehash('scrypt$1024$8$1$c2VsCg==$aGFzaAo='), true);
  assert.equal(needsRehash('md5$deadbeef'), true);
  assert.equal(needsRehash(null), true);
});

test('une empreinte corrompue refuse sans lever', async () => {
  // Une exception ici passerait pour une panne serveur et révélerait
  // que le compte existe. Un refus franc ne dit rien.
  assert.equal(await verifyPassword('peu importe', 'n’importe quoi'), false);
  assert.equal(await verifyPassword('peu importe', 'scrypt$$$$$'), false);
  assert.equal(await verifyPassword('peu importe', undefined), false);
});

test('la longueur prime sur les règles de composition', () => {
  // `Aa1!` satisfait « majuscule, chiffre, symbole » en quatre
  // caractères. C'est exactement ce que ces règles produisent, et
  // c'est ce qu'on refuse.
  assert.ok(passwordProblems('Aa1!').length > 0);
  assert.equal(passwordProblems('quatre mots tiennent ici').length, 0);
});

test('un mot de passe trop court est refusé, et on dit de combien', () => {
  const [message] = passwordProblems('court');
  assert.match(message, new RegExp(String(MIN_LENGTH)));
  assert.match(message, /il y en a 5/);
});

test('les mots de passe éventés sont refusés', () => {
  assert.ok(passwordProblems('motdepasse123').some((p) => /éventés/.test(p)));
  assert.ok(passwordProblems('azertyuiop').length > 0);
});

test('un mot de passe qui reprend l’adresse ou le nom est refusé', () => {
  const ctx = { email: 'malek@exemple.fr', displayName: 'Malek' };
  assert.ok(passwordProblems('malek mon mot de passe', ctx).some((p) => /adresse/.test(p)));
  assert.ok(passwordProblems('zzzz malek zzzzzzzz', ctx).some((p) => /nom/.test(p)));
});

test('la répétition ne remplace pas la longueur', () => {
  assert.ok(passwordProblems('aaaaaaaaaaaaaaaa').some((p) => /distincts/.test(p)));
});

test('tous les problèmes sont signalés d’un coup', () => {
  // Les annoncer un par un oblige à soumettre plusieurs fois pour les
  // découvrir tous. « motdepasse » en cumule deux : trop court, et
  // présent dans toutes les listes.
  const problemes = passwordProblems('motdepasse');
  assert.equal(problemes.length, 2);
  assert.ok(problemes.some((p) => /caractères/.test(p)));
  assert.ok(problemes.some((p) => /éventés/.test(p)));
});

test('on ne reproche pas deux fois la même chose', () => {
  // « abc » n'a qu'un défaut — sa longueur. Lui signaler en plus qu'il
  // compte peu de caractères distincts serait du bruit, et c'est
  // pourquoi ce contrôle ne s'applique qu'au-delà du minimum.
  assert.equal(passwordProblems('abc').length, 1);
});

test('un mot de passe démesuré est refusé avant d’atteindre scrypt', () => {
  // Sans limite haute, un mégaoctet ferait travailler la dérivation
  // indéfiniment : un déni de service en une requête.
  assert.ok(passwordProblems('a'.repeat(5000)).some((p) => /trop long/.test(p)));
});

test('un jeton de session est imprévisible et de longueur stable', () => {
  const jetons = new Set(Array.from({ length: 200 }, newSessionToken));
  assert.equal(jetons.size, 200);
  const [premier] = jetons;
  // 32 octets en base64url, sans remplissage.
  assert.equal(premier.length, 43);
  assert.match(premier, /^[A-Za-z0-9_-]+$/);
});

test('le jeton est stocké haché, jamais en clair', () => {
  const jeton = newSessionToken();
  const empreinte = hashToken(jeton);
  assert.notEqual(empreinte, jeton);
  assert.equal(hashToken(jeton), empreinte);
  assert.notEqual(hashToken(newSessionToken()), empreinte);
});

test('la temporisation laisse passer les fautes de frappe', () => {
  assert.equal(throttleDelay(0), 0);
  assert.equal(throttleDelay(1), 0);
  assert.equal(throttleDelay(2), 0);
});

test('la temporisation croît puis plafonne', () => {
  assert.equal(throttleDelay(3), 1000);
  assert.equal(throttleDelay(4), 2000);
  assert.ok(throttleDelay(10) > throttleDelay(8));
  // Le plafond existe pour qu'un tiers ne puisse pas verrouiller un
  // compte à vie en échouant exprès : le verrouillage définitif est
  // lui-même un déni de service.
  assert.equal(throttleDelay(100), LOCK_MAX_MS);
  assert.equal(throttleDelay(1e9), LOCK_MAX_MS);
});

test('la temporisation ignore les entrées absurdes', () => {
  assert.equal(throttleDelay(-5), 0);
  assert.equal(throttleDelay(null), 0);
  assert.equal(throttleDelay('bof'), 0);
});

test('une adresse est normalisée en casse, domaine compris', () => {
  assert.equal(normalizeEmail('  Malek@Exemple.FR '), 'malek@exemple.fr');
});

test('les points de la partie locale sont CONSERVÉS', () => {
  // Les retirer fusionnerait deux comptes distincts partout sauf chez
  // un fournisseur particulier.
  assert.equal(normalizeEmail('a.b@exemple.fr'), 'a.b@exemple.fr');
  assert.notEqual(normalizeEmail('a.b@exemple.fr'), normalizeEmail('ab@exemple.fr'));
});

test('une adresse mal formée est refusée', () => {
  for (const mauvaise of ['', 'sansarobase', '@exemple.fr', 'a@', 'a@b', 'a b@exemple.fr', null]) {
    assert.equal(normalizeEmail(mauvaise), null, `devrait refuser : ${mauvaise}`);
  }
});

test('une adresse à sous-domaine est acceptée', () => {
  assert.equal(normalizeEmail('a@mail.exemple.co.uk'), 'a@mail.exemple.co.uk');
});
