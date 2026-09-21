// Placement des séances dans la semaine.
//
// `day_index` dit l'ORDRE des séances d'un programme ; il ne dit pas
// QUAND elles tombent. Coller un programme de quatre jours sur
// lundi-mardi-mercredi-jeudi reviendrait à concentrer toute la charge
// sur la première moitié de semaine et à laisser trois jours vides : à
// volume égal, c'est la répartition qui fait la différence, et la
// récupération est le facteur limitant.
//
// Ces répartitions sont un point de DÉPART, pas une contrainte :
// chaque séance peut être déplacée à la main.

/** 1 = lundi … 7 = dimanche, comme EXTRACT(ISODOW) en SQL. */
export const WEEKDAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 7, label: 'Dimanche', short: 'Dim' },
];

export const weekdayLabel = (n) => WEEKDAYS.find((d) => d.value === n)?.label ?? null;

/**
 * Répartition par défaut de N séances sur la semaine.
 *
 * Les jours de repos sont placés là où ils servent le plus : après deux
 * séances consécutives plutôt qu'en fin de semaine. Au-delà de 6, il n'y
 * a plus de choix à faire.
 */
const SPREAD = {
  1: [1],
  2: [1, 4],           // lundi, jeudi — trois jours d'écart de part et d'autre
  3: [1, 3, 5],        // un jour de repos entre chaque
  4: [1, 2, 4, 5],     // deux blocs de deux, repos mercredi et week-end
  5: [1, 2, 3, 5, 6],  // repos jeudi et dimanche
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

/** La table de répartition, exposée pour le rattrapage SQL. */
export const WEEKDAY_SPREAD = SPREAD;

/**
 * @param {number} count nombre de séances à placer
 * @returns {number[]} jours ISO, dans l'ordre des séances
 */
export function defaultWeekdays(count) {
  const n = Math.max(1, Math.min(7, Math.round(count || 0)));
  return SPREAD[n];
}

/**
 * Numéro de semaine du programme pour une date donnée.
 *
 * @returns {number} 1 pour la première semaine ; ≤ 0 avant le départ.
 */
export function programWeek(date, startsOn) {
  const days = Math.floor((toUtcMidnight(date) - toUtcMidnight(startsOn)) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

/**
 * Normalise en minuit UTC.
 *
 * Les dates du calendrier sont des JOURS, pas des instants : comparer
 * deux `Date` porteuses d'une heure ferait basculer d'un jour selon
 * l'heure à laquelle la requête tombe.
 */
function toUtcMidnight(value) {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `YYYY-MM-DD` d'une date, en UTC. */
export const isoDate = (d) => new Date(toUtcMidnight(d)).toISOString().slice(0, 10);

/**
 * Suite de jours entre deux dates, bornes comprises.
 *
 * Bornée à 400 jours : au-delà, la réponse pèse plus que ce qu'un
 * calendrier affiche, et une plage aberrante signale plutôt un bug
 * d'appel qu'une intention.
 */
export function dateRange(from, to, max = 400) {
  const start = toUtcMidnight(from);
  const end = toUtcMidnight(to);
  if (end < start) return [];

  const out = [];
  for (let t = start; t <= end && out.length < max; t += 86_400_000) {
    const d = new Date(t);
    out.push({
      date: d.toISOString().slice(0, 10),
      // getUTCDay() rend 0 pour dimanche ; la norme ISO veut 7.
      weekday: d.getUTCDay() === 0 ? 7 : d.getUTCDay(),
    });
  }
  return out;
}
