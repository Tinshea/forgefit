// Formatage partagé.
//
// Ces trois helpers étaient recopiés dans quatre à six composants. Le
// risque n'est pas la duplication en soi, mais la divergence : deux
// écrans arrondissant différemment affichent deux totaux différents
// pour la même donnée.

/** Arrondi à une décimale, tolérant aux valeurs nulles. */
export const round1 = (v) => Math.round(Number(v ?? 0) * 10) / 10;

/** Arrondi à deux décimales — prix, ratios. */
export const round2 = (v) => Math.round(Number(v ?? 0) * 100) / 100;

/** Date courte pour les axes de graphique : 04/07. */
export const shortDay = (iso) => new Date(iso).toLocaleDateString('fr-FR', {
  day: '2-digit', month: '2-digit',
});

/** Date longue, pour les titres. */
export const longDay = (iso) => new Date(iso).toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long',
});

/** Montant en euros, ou tiret cadratin si le prix est inconnu. */
export const euros = (v) => (v == null ? '—' : `${round2(v)} €`);

/** Nombre avec séparateur de milliers français. */
export const thousands = (v) => Math.round(Number(v ?? 0)).toLocaleString('fr-FR');

/**
 * Nombre en écriture française : virgule décimale, pas de zéro inutile.
 *
 * `toLocaleString('fr-FR')` insère aussi une espace fine de millier, que
 * l'on ne veut PAS sur un décompte de séries : « 1 2,5 » se lit mal.
 */
export const dec = (v) => {
  const n = Number(v ?? 0);
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
};
