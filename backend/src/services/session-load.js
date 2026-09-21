// Charge d'entraînement, tous sports confondus.
//
// ┌─ LE PROBLÈME QUE RÉSOUT LA CHARGE DE SÉANCE ──────────────────────┐
// │ Comment comparer 90 minutes de football, une sortie vélo de       │
// │ trois heures et 40 minutes de bloc ?                              │
// │                                                                    │
// │ Pas en durée : trois heures de vélo tranquille fatiguent moins    │
// │ qu'une heure de sparring. Pas en calories : elles ignorent la     │
// │ charge nerveuse et mécanique. Pas en tonnage : la plupart des     │
// │ sports n'en ont aucun.                                            │
// │                                                                    │
// │ Foster (2001) a proposé la réponse qui a tenu :                   │
// │                                                                    │
// │     charge = RPE (échelle 0-10) × durée en minutes                │
// │                                                                    │
// │ Une seule question posée après la séance, multipliée par une      │
// │ durée. Sa validité a été confirmée contre la fréquence cardiaque  │
// │ et le lactate, dans des sports aussi différents que le cyclisme,  │
// │ le basket et le judo. C'est ce qui en fait l'unité commune de ce  │
// │ module.                                                           │
// └────────────────────────────────────────────────────────────────────┘
//
// L'unité est arbitraire (« AU », arbitrary units). Elle ne vaut que
// COMPARÉE À SOI-MÊME dans le temps — jamais entre deux personnes.

/** Charge d'une séance. `rpe` sur 10, `minutes` en minutes. */
export function sessionLoad({ rpe, minutes }) {
  if (!(rpe > 0) || !(minutes > 0)) return null;
  return Math.round(rpe * minutes);
}

/**
 * Repères de lecture d'une charge de séance.
 *
 * Ces bornes ne sortent d'aucune étude : ce sont des repères de
 * LECTURE, calibrés sur des durées et intensités usuelles (une heure à
 * RPE 6 = 360). Le code le dit plutôt que de les faire passer pour des
 * seuils validés.
 */
export function describeSessionLoad(load) {
  if (!(load > 0)) return null;
  if (load < 150) return { level: 'legere', label: 'Séance légère' };
  if (load < 350) return { level: 'moderee', label: 'Séance modérée' };
  if (load < 600) return { level: 'soutenue', label: 'Séance soutenue' };
  if (load < 900) return { level: 'lourde', label: 'Séance lourde' };
  return { level: 'tres-lourde', label: 'Séance très lourde' };
}

const DAY_MS = 86_400_000;
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (iso) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Charge par jour sur une fenêtre, jours vides inclus.
 *
 * Les jours SANS séance valent 0 et doivent figurer : la monotonie se
 * calcule sur l'écart-type des charges quotidiennes, et retirer les
 * jours de repos la ferait chuter artificiellement — donnant une
 * semaine « bien variée » alors qu'elle est plate.
 */
export function dailySeries(sessions = [], { from, to }) {
  const totals = new Map();
  for (const s of sessions) {
    if (!s.date || !(s.load > 0)) continue;
    totals.set(s.date, (totals.get(s.date) ?? 0) + Number(s.load));
  }

  const days = [];
  for (let ms = parseDay(from); ms <= parseDay(to); ms += DAY_MS) {
    const date = isoOf(ms);
    days.push({ date, load: totals.get(date) ?? 0 });
  }
  return days;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const stdDev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  // Écart-type d'ÉCHANTILLON (n−1) : c'est celui qu'emploie Foster, et
  // le diviseur change la monotonie de plusieurs pour cent sur sept
  // jours.
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

/**
 * Monotonie et contrainte (Foster, 1998).
 *
 *   monotonie = charge quotidienne moyenne / écart-type
 *   contrainte = charge hebdomadaire × monotonie
 *
 * La monotonie mesure l'UNIFORMITÉ. Une semaine où l'on fait la même
 * chose tous les jours a une monotonie élevée, même à volume modeste —
 * et c'est cette uniformité, autant que le volume, que Foster a
 * associée aux maladies et aux blessures. Au-delà de 2,0, il
 * recommandait de varier : alterner jours durs et jours faciles plutôt
 * que de tout niveler.
 */
export const MONOTONY_CEILING = 2.0;

export function monotonyOf(dailyLoads = []) {
  const loads = dailyLoads.map((d) => (typeof d === 'number' ? d : d.load));
  if (loads.length < 2) return null;

  const total = loads.reduce((a, b) => a + b, 0);
  if (total === 0) return { monotony: 0, strain: 0, weekly_load: 0, note: null };

  const sd = stdDev(loads);
  // Écart-type nul : toutes les journées identiques. La monotonie
  // tendrait vers l'infini ; on borne et on le dit plutôt que de
  // renvoyer une division par zéro.
  const monotony = sd === 0 ? null : mean(loads) / sd;

  // La contrainte se calcule sur la monotonie ARRONDIE, celle qui est
  // affichée : sinon l'utilisateur qui multiplie les deux chiffres à
  // l'écran n'obtient pas le troisième, et doute des trois.
  const shown = monotony == null ? null : Math.round(monotony * 100) / 100;

  return {
    weekly_load: Math.round(total),
    monotony: shown,
    strain: shown == null ? null : Math.round(total * shown),
    uniform: sd === 0,
    note: sd === 0
      ? 'Charge identique tous les jours : la monotonie n’est pas calculable, '
        + 'mais c’est justement le cas le plus uniforme possible.'
      : null,
  };
}

/**
 * Rapport charge aiguë / charge chronique.
 *
 * ┌─ POURQUOI CE CHIFFRE EST AFFICHÉ AVEC DES PINCETTES ──────────────┐
 * │ L'ACWR a été popularisé par Gabbett (2016) avec une « zone sûre » │
 * │ entre 0,8 et 1,3 et un risque accru au-delà de 1,5.               │
 * │                                                                    │
 * │ Ces seuils sont CONTESTÉS. Impellizzeri et al. (2020) ont montré  │
 * │ que la formule usuelle souffre d'un couplage mathématique — la    │
 * │ charge aiguë est incluse dans la charge chronique, ce qui crée    │
 * │ une corrélation en partie artificielle — et que les seuils ronds  │
 * │ n'ont pas de fondement empirique solide.                          │
 * │                                                                    │
 * │ Deux décisions en découlent :                                     │
 * │   1. on calcule la version DÉCOUPLÉE (la charge chronique exclut  │
 * │      les 7 derniers jours), qui répond à la critique principale ; │
 * │   2. on ne parle jamais de « zone de danger ». Le rapport est     │
 * │      présenté comme ce qu'il est : une mesure de VITESSE DE       │
 * │      PROGRESSION, utile pour repérer un bond, pas un pronostic    │
 * │      de blessure.                                                 │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const ACWR = {
  acuteDays: 7,
  chronicDays: 28,
  reference: [0.8, 1.3],
  source: 'Gabbett (2016), Br J Sports Med — et ses limites, Impellizzeri '
    + 'et al. (2020), Int J Sports Physiol Perform.',
};

export function acuteChronicRatio(days = []) {
  if (days.length < ACWR.chronicDays) {
    return {
      ratio: null,
      ready: false,
      note: `Il faut ${ACWR.chronicDays} jours d’historique pour situer une `
        + `charge récente ; il y en a ${days.length}.`,
    };
  }

  const window = days.slice(-ACWR.chronicDays);
  const acute = window.slice(-ACWR.acuteDays).map((d) => d.load);
  // DÉCOUPLÉ : les 7 derniers jours sont exclus de la base de
  // comparaison, sans quoi la charge récente se comparerait en partie à
  // elle-même.
  const chronic = window.slice(0, ACWR.chronicDays - ACWR.acuteDays).map((d) => d.load);

  const acuteMean = mean(acute);
  const chronicMean = mean(chronic);
  const chronicActiveDays = chronic.filter((l) => l > 0).length;

  // ┌─ POURQUOI UNE BASE MINIMALE ────────────────────────────────────┐
  // │ Le rapport est une DIVISION : quand le dénominateur tend vers   │
  // │ zéro, il explose. Deux séances isolées sur trois semaines       │
  // │ produisaient un rapport de 15, chiffre mathématiquement exact   │
  // │ et parfaitement inutile — il ne décrit pas une progression      │
  // │ rapide, il décrit une absence de base.                          │
  // │                                                                  │
  // │ En dessous de trois journées actives sur les 21 jours de        │
  // │ référence, on refuse de conclure et on dit pourquoi.            │
  // └──────────────────────────────────────────────────────────────────┘
  const MIN_CHRONIC_DAYS = 3;

  if (chronicMean === 0 || chronicActiveDays < MIN_CHRONIC_DAYS) {
    return {
      ratio: null,
      ready: false,
      acute_mean: Math.round(acuteMean),
      chronic_mean: Math.round(chronicMean),
      chronic_active_days: chronicActiveDays,
      note: acuteMean > 0
        ? `Seulement ${chronicActiveDays} journée${chronicActiveDays > 1 ? 's' : ''} `
          + 'd’entraînement sur les trois semaines de référence : il n’y a pas '
          + 'de base à laquelle comparer la semaine écoulée. Monte '
          + 'progressivement, le rapport deviendra lisible.'
        : 'Aucune charge enregistrée sur la période de référence.',
    };
  }

  const ratio = acuteMean / chronicMean;
  return {
    ratio: Math.round(ratio * 100) / 100,
    ready: true,
    acute_mean: Math.round(acuteMean),
    chronic_mean: Math.round(chronicMean),
    chronic_active_days: chronicActiveDays,
    reference: ACWR.reference,
    // Le verbe décrit une VITESSE, jamais un risque.
    trend: ratio < 0.8 ? 'en baisse' : ratio <= 1.3 ? 'stable' : 'en hausse rapide',
    note: ratio > 1.5
      ? 'Ta charge des 7 derniers jours dépasse de moitié ta moyenne des trois '
        + 'semaines précédentes. Ce n’est pas un pronostic de blessure — c’est '
        + 'une progression rapide, à tenir à l’œil.'
      : null,
  };
}

/**
 * Bilan de charge sur une fenêtre.
 *
 * @param {Array<{date, load, sport, category}>} sessions
 */
export function loadSummary(sessions = [], { from, to } = {}) {
  const days = dailySeries(sessions, { from, to });
  const lastWeek = days.slice(-7);

  const byCategory = new Map();
  const bySport = new Map();
  for (const s of sessions) {
    if (!(s.load > 0)) continue;
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + s.load);
    bySport.set(s.sport, (bySport.get(s.sport) ?? 0) + s.load);
  }

  const total = sessions.reduce((n, s) => n + (Number(s.load) || 0), 0);

  return {
    from,
    to,
    days,
    total_load: Math.round(total),
    sessions: sessions.length,
    week: monotonyOf(lastWeek),
    acwr: acuteChronicRatio(days),
    by_category: [...byCategory.entries()]
      .map(([category, load]) => ({
        category,
        load: Math.round(load),
        share: total ? Math.round((load / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.load - a.load),
    by_sport: [...bySport.entries()]
      .map(([sport, load]) => ({ sport, load: Math.round(load) }))
      .sort((a, b) => b.load - a.load),
    monotony_ceiling: MONOTONY_CEILING,
  };
}
