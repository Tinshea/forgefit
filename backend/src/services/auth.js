import crypto from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Authentification — le cœur, sans base ni HTTP.
 *
 * ┌─ CE QUI EXISTAIT AVANT ───────────────────────────────────────────┐
 * │   const userOf = (req) => req.header('x-user-id') || defaultUser; │
 * │                                                                    │
 * │ L'utilisateur était LU DANS UN EN-TÊTE, sans la moindre            │
 * │ vérification. Sur un réseau privé c'est cohérent — un seul         │
 * │ habitant, pas de mot de passe à gérer. Dès que l'adresse devient   │
 * │ publique, n'importe qui lit et écrit le poids, les mesures et le   │
 * │ journal alimentaire, et se fait passer pour qui il veut en         │
 * │ changeant une ligne d'en-tête.                                     │
 * └────────────────────────────────────────────────────────────────────┘
 */

const scrypt = promisify(crypto.scrypt);

/**
 * Paramètres de dérivation.
 *
 * ┌─ POURQUOI SCRYPT ET PAS UNE BIBLIOTHÈQUE ─────────────────────────┐
 * │ Argon2id est le premier choix de l'OWASP, mais il demande une     │
 * │ dépendance native — donc une chaîne de compilation dans l'image,  │
 * │ et une pièce de plus à maintenir pour une application que son     │
 * │ auteur héberge seul.                                              │
 * │                                                                    │
 * │ scrypt est le SECOND choix de la même recommandation, et il est   │
 * │ dans Node lui-même. Avec N = 2^15 il coûte 32 Mo de mémoire par   │
 * │ calcul, ce qui est précisément le but : la mémoire est ce qu'un   │
 * │ attaquant ne peut pas paralléliser à bon compte sur carte         │
 * │ graphique.                                                        │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 };

/** Au-delà, scrypt refuse de travailler : N × r × 128 × 2, avec marge. */
const MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;

/**
 * Longueur minimale.
 *
 * Douze, et aucune exigence de « une majuscule, un chiffre, un
 * symbole ». Ces règles produisent `Password1!` — court, prévisible, et
 * présent dans toutes les listes. La longueur est la seule contrainte
 * qui augmente vraiment le coût d'une attaque (NIST SP 800-63B, qui
 * déconseille explicitement les règles de composition).
 */
export const MIN_LENGTH = 12;

/** Les mots de passe qu'on trouve en tête de toutes les fuites. */
const TROP_COURANTS = new Set([
  'motdepasse', 'password', 'azertyuiop', 'qwertyuiop', '123456789012',
  'motdepasse123', 'password123', 'administrateur', 'jenesaispas',
]);

/**
 * Ce qui cloche dans un mot de passe, en clair.
 *
 * Renvoie une LISTE : annoncer les problèmes un par un oblige à
 * soumettre plusieurs fois pour les découvrir tous.
 */
export function passwordProblems(password, { email = '', displayName = '' } = {}) {
  const problems = [];
  const value = String(password ?? '');

  if (value.length < MIN_LENGTH) {
    problems.push(`Il faut au moins ${MIN_LENGTH} caractères (il y en a ${value.length}).`);
  }
  // Une limite haute existe pour une raison technique, pas de sécurité :
  // sans elle, un mot de passe d'un mégaoctet ferait travailler scrypt
  // indéfiniment. C'est un déni de service à une ligne.
  if (value.length > 200) problems.push('Il est trop long (200 caractères au maximum).');

  const nu = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  if (TROP_COURANTS.has(nu)) problems.push('Celui-ci figure dans toutes les listes de mots de passe éventés.');

  // Un mot de passe qui reprend l'adresse ou le nom est deviné du
  // premier coup par quiconque connaît la personne.
  const locale = String(email).split('@')[0].toLowerCase();
  if (locale.length >= 4 && nu.includes(locale.replace(/[^a-z0-9]/g, ''))) {
    problems.push('Il contient ton adresse : c’est la première chose qu’on essaie.');
  }
  const nom = String(displayName).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (nom.length >= 4 && nu.includes(nom)) {
    problems.push('Il contient ton nom : c’est la deuxième chose qu’on essaie.');
  }

  // Un seul caractère répété franchit la longueur sans rien apporter.
  if (value.length >= MIN_LENGTH && new Set(value).size <= 3) {
    problems.push('Il ne compte que trois caractères distincts.');
  }
  return problems;
}

/**
 * Empreinte d'un mot de passe, au format `scrypt$N$r$p$sel$empreinte`.
 *
 * Les paramètres voyagent AVEC l'empreinte : le jour où on durcit `N`,
 * les anciennes empreintes restent vérifiables, et on peut les
 * recalculer à la volée à la prochaine connexion réussie.
 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password).normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAXMEM,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p,
    salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Vérifie un mot de passe contre son empreinte.
 *
 * La comparaison est à TEMPS CONSTANT : un `===` s'arrête au premier
 * octet différent, et la durée de l'échec révèle combien d'octets
 * étaient bons. C'est suffisant pour reconstituer une empreinte octet
 * par octet.
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algo, N, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64');
  let key;
  try {
    key = await scrypt(String(password).normalize('NFKC'), Buffer.from(salt, 'base64'),
      expected.length, {
        N: Number(N), r: Number(r), p: Number(p),
        maxmem: 128 * Number(N) * Number(r) * 2,
      });
  } catch {
    // Paramètres illisibles ou déraisonnables : l'empreinte est
    // corrompue, pas le mot de passe. On refuse sans divulguer.
    return false;
  }
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** L'empreinte a-t-elle été calculée avec des paramètres dépassés ? */
export function needsRehash(stored) {
  if (typeof stored !== 'string') return true;
  const [algo, N, r, p] = stored.split('$');
  return algo !== 'scrypt'
    || Number(N) < SCRYPT.N || Number(r) < SCRYPT.r || Number(p) < SCRYPT.p;
}

/* ─── Sessions ────────────────────────────────────────────────────── */

/** Durée de vie d'une session, et seuil de prolongation glissante. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Un jeton de session : 32 octets tirés au sort.
 *
 * 256 bits d'entropie, donc rien à deviner. C'est aussi pourquoi le
 * jeton n'est PAS passé à scrypt côté stockage : un secret déjà
 * imprévisible n'a rien à gagner d'une dérivation lente, et SHA-256
 * suffit à ce qu'une fuite de la table ne livre aucune session.
 */
export const newSessionToken = () => crypto.randomBytes(32).toString('base64url');

export const hashToken = (token) => crypto
  .createHash('sha256').update(String(token)).digest('base64');

/**
 * Attente imposée après N échecs consécutifs, en millisecondes.
 *
 * Croissance exponentielle plafonnée : les fautes de frappe (un ou deux
 * échecs) ne coûtent rien, et une attaque par dictionnaire se heurte
 * très vite à un mur. Le plafond existe pour qu'un attaquant ne puisse
 * pas verrouiller un compte indéfiniment en échouant exprès — le
 * verrouillage définitif est lui-même un déni de service.
 */
export const LOCK_MAX_MS = 15 * 60 * 1000;

export function throttleDelay(failures) {
  const n = Math.max(0, Math.floor(Number(failures) || 0));
  if (n < 3) return 0;
  return Math.min(LOCK_MAX_MS, 1000 * 2 ** (n - 3));
}

/**
 * Normalisation d'une adresse, pour que `A@B.fr` et `a@b.fr` soient le
 * même compte. On ne touche PAS à la partie locale au-delà de la
 * casse : `a.b@` et `ab@` sont des adresses différentes partout sauf
 * chez un fournisseur particulier, et supposer le contraire fusionne
 * deux comptes distincts.
 */
export function normalizeEmail(email) {
  const value = String(email ?? '').trim();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (!/^[^\s@]+$/.test(local) || !/^[^\s@.]+(\.[^\s@.]+)+$/.test(domain)) return null;
  return `${local.toLowerCase()}@${domain}`;
}
