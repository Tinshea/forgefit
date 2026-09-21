// Charge d'entraînement, vue depuis la nutrition.
//
// ┌─ LE PIÈGE À ÉVITER ─────────────────────────────────────────────────┐
// │ Le multiplicateur d'activité (× 1,375 « léger », × 1,55 « modéré »)│
// │ INCLUT DÉJÀ l'entraînement. Ajouter les calories d'une séance      │
// │ par-dessus les compterait deux fois, et gonflerait l'objectif de   │
// │ plusieurs centaines de kilocalories par jour.                      │
// │                                                                     │
// │ Ce service ne crée donc aucune énergie. Il fait deux choses :       │
// │  1. comparer l'activité DÉCLARÉE à celle réellement enregistrée ;  │
// │  2. répartir le total hebdomadaire entre jours d'entraînement et   │
// │     jours de repos, à somme constante.                              │
// └─────────────────────────────────────────────────────────────────────┘

// Aucun accès base ici : ce module reste PUR, comme `evidence.js` ou
// `meal-planner.js`. Les requêtes vivent dans `body-profile.js`, qui est
// déjà le point d'entrée unique de l'état corporel. Mélanger les deux
// rendrait le calcul intestable sans Postgres.
import { ACTIVITY_MULTIPLIERS, ACTIVITY_LABELS } from './nutrition.js';

/**
 * Séances hebdomadaires correspondant à chaque niveau déclaré.
 *
 * Ce sont les définitions affichées à l'utilisateur au moment du choix :
 * on le confronte à ce qu'il a coché, pas à un barème inventé après coup.
 */
export const ACTIVITY_SESSIONS = {
  sedentaire: [0, 0.5],
  leger: [1, 3],
  modere: [3, 5],
  intense: [6, 14],
};

/**
 * Niveau d'activité correspondant à un nombre de séances observé.
 *
 * Les seuils sont CONTIGUS, sans trou. Chercher la fourchette qui
 * contient la valeur laissait 5,2 séances sans réponse — entre « modéré »
 * (3 à 5) et « intense » (6 ou plus) — et le repli la classait
 * sédentaire, soit l'inverse de la vérité.
 */
export function levelForSessions(sessionsPerWeek) {
  const n = Math.max(0, Number(sessionsPerWeek) || 0);
  if (n < 1) return 'sedentaire';
  if (n <= 3) return 'leger';
  if (n <= 5) return 'modere';
  return 'intense';
}

/**
 * Répartition entraînement / repos, à TOTAL HEBDOMADAIRE CONSTANT.
 *
 * Manger davantage les jours où l'on s'entraîne est une pratique
 * courante et commode. Elle ne crée pas d'énergie : ce qui est ajouté
 * les jours de séance est retiré les jours de repos, exactement.
 *
 * @param {object} p
 * @param {number} p.trainingDaysPerWeek jours d'entraînement, 0 à 7
 * @param {number} p.shiftPct            surplus appliqué les jours de séance
 * @returns {{training, rest, neutral, note}} multiplicateurs
 */
export function dayTypeFactors({ trainingDaysPerWeek = 0, shiftPct = 0 } = {}) {
  const t = Math.min(7, Math.max(0, Math.round(trainingDaysPerWeek)));
  const rest = 7 - t;
  const shift = Math.max(0, Math.min(30, Number(shiftPct) || 0)) / 100;

  // Sans jour de repos — ou sans jour d'entraînement — il n'y a rien à
  // répartir : on ne peut pas retirer d'un ensemble vide.
  if (!shift || t === 0 || rest === 0) {
    return {
      training: 1,
      rest: 1,
      neutral: true,
      note: shift && (t === 0 || rest === 0)
        ? 'Répartition impossible : il faut au moins un jour d’entraînement ET un jour '
          + 'de repos dans la semaine pour déplacer des calories de l’un vers l’autre.'
        : 'Même objectif tous les jours.',
    };
  }

  const trainingFactor = 1 + shift;
  // Compensation exacte : ce qui est ajouté sur t jours est retiré sur
  // les (7 − t) autres.
  const restFactor = 1 - (shift * t) / rest;

  return {
    training: Math.round(trainingFactor * 1000) / 1000,
    rest: Math.round(restFactor * 1000) / 1000,
    neutral: false,
    note: `+${Math.round(shift * 100)} % les ${t} jours d’entraînement, `
      + `−${Math.round((1 - restFactor) * 100)} % les ${rest} jours de repos. `
      + 'Le total de la semaine est inchangé.',
  };
}

/**
 * Met en forme une charge d'entraînement brute.
 *
 * La durée vient de la SÉANCE, pas de la somme des durées de séries :
 * une série de développé couché n'a pas de durée, seuls les étirements
 * en ont. Compter les secondes de séries ramenait une séance de
 * musculation de 75 minutes à zéro.
 *
 * @param {object} row    {sessions, minutes, training_days, open_sessions}
 * @param {number} days   largeur de la fenêtre
 */
export function summarizeLoad(row, days = 28) {
  const weeks = Math.max(1, days / 7);
  const sessions = Number(row?.sessions ?? 0);
  const minutes = Number(row?.minutes ?? 0);
  const trainingDays = Number(row?.training_days ?? 0);

  return {
    window_days: days,
    sessions,
    sessions_per_week: Math.round((sessions / weeks) * 10) / 10,
    training_days_per_week: Math.min(7, Math.round((trainingDays / weeks) * 10) / 10),
    minutes_total: Math.round(minutes),
    minutes_per_week: Math.round(minutes / weeks),
    minutes_per_session: sessions ? Math.round(minutes / sessions) : 0,
    open_sessions: Number(row?.open_sessions ?? 0),
  };
}

/**
 * Confronte l'activité déclarée à celle enregistrée.
 *
 * Le multiplicateur d'activité est l'entrée la plus lourde du calcul :
 * passer de « léger » à « modéré » déplace l'objectif de ≈ 300 kcal.
 * C'est aussi la seule que l'utilisateur choisit une fois et ne revoit
 * jamais.
 */
export function reviewActivity({ declared, load } = {}) {
  const level = declared ?? 'leger';
  const observed = levelForSessions(load?.sessions_per_week ?? 0);
  const range = ACTIVITY_SESSIONS[level] ?? ACTIVITY_SESSIONS.leger;
  const sessions = load?.sessions_per_week ?? 0;

  const inRange = sessions >= range[0] && sessions <= range[1];
  const multipliers = { declared: ACTIVITY_MULTIPLIERS[level], observed: ACTIVITY_MULTIPLIERS[observed] };
  const drift = multipliers.observed - multipliers.declared;

  return {
    declared: level,
    declared_label: ACTIVITY_LABELS[level],
    declared_range: range,
    observed,
    observed_label: ACTIVITY_LABELS[observed],
    sessions_per_week: sessions,
    minutes_per_week: load?.minutes_per_week ?? 0,
    ok: inRange,
    multiplier_drift: Math.round(drift * 1000) / 1000,
    note: inRange
      ? `${sessions} séance(s) par semaine sur ${load?.window_days ?? 28} jours : `
        + `cohérent avec « ${level} » (${range[0]}–${range[1]}).`
      : `${sessions} séance(s) par semaine enregistrées, alors que « ${level} » suppose `
        + `${range[0]} à ${range[1]}. Le niveau « ${observed} » correspondrait mieux, `
        + `soit ${drift > 0 ? '+' : ''}${Math.round(drift * 100) / 100} sur le `
        + 'multiplicateur de dépense.',
  };
}

/**
 * Écart calorique impliqué par un changement de multiplicateur.
 *
 * « ×1,375 au lieu de ×1,55 » ne dit rien à personne ; « environ
 * 300 kcal par jour » si.
 */
export function multiplierDriftKcal(bmr, from, to) {
  if (!(bmr > 0)) return null;
  const a = ACTIVITY_MULTIPLIERS[from];
  const b = ACTIVITY_MULTIPLIERS[to];
  if (!a || !b) return null;
  return Math.round(bmr * (b - a));
}
