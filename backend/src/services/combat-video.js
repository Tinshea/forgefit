/**
 * Liens vidéo — voir le mouvement, pas seulement le lire.
 *
 * ┌─ POURQUOI DES RECHERCHES ET NON DES VIDÉOS PRÉCISES ──────────────┐
 * │ Une URL de vidéo YouTube est un identifiant opaque. Je ne peux    │
 * │ pas en inventer un — ce serait fabriquer une source, exactement   │
 * │ ce qu'on cherche à éviter ici — et je n'ai pas pu en VÉRIFIER :   │
 * │ YouTube répond par un mur de consentement, et une chaîne          │
 * │ inexistante renvoie le même code qu'une chaîne réelle. La méthode │
 * │ ne distingue rien, donc elle ne prouve rien.                      │
 * │                                                                    │
 * │ Une URL de RECHERCHE, elle, est construite et non devinée : elle  │
 * │ ne peut pas pointer sur une vidéo supprimée, ne rote jamais, et   │
 * │ conduit exactement là où l'on veut aller. C'est moins flatteur    │
 * │ qu'une liste de lectures choisies, et c'est vérifiablement vrai.  │
 * │                                                                    │
 * │ Les chaînes de fédération ci-dessous sont des liens de RECHERCHE  │
 * │ eux aussi, pour la même raison.                                   │
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Le contexte qui désambiguïse la recherche. */
const CONTEXTE = {
  boxe: 'boxe anglaise technique',
  boxe_thai: 'muay thai technique',
  mma: 'mma technique',
  judo: 'judo technique',
  bjj: 'bjj jiu jitsu technique',
  karate: 'karate shotokan technique',
  lutte: 'wrestling technique',
  escrime: 'escrime fencing technique',
};

/** L'instance de référence, dont on propose de chercher la chaîne. */
const FEDERATIONS = {
  boxe: 'World Boxing',
  boxe_thai: 'IFMA muay thai',
  mma: 'UFC',
  judo: 'International Judo Federation',
  bjj: 'IBJJF',
  karate: 'World Karate Federation',
  lutte: 'United World Wrestling',
  escrime: 'FIE fencing',
};

const url = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** Une recherche ciblée sur une technique précise. */
export function rechercheVideo(discipline, technique) {
  const ctx = CONTEXTE[discipline];
  if (!ctx || !technique) return null;
  return { libelle: 'Voir le mouvement', url: url(`${technique} ${ctx}`) };
}

/** Une recherche vers la chaîne de la fédération de référence. */
export function chaineDe(discipline) {
  const f = FEDERATIONS[discipline];
  if (!f) return null;
  return {
    federation: f,
    libelle: `Chercher la chaîne ${f}`,
    url: url(`${f} official channel`),
  };
}
