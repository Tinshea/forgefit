// Séries de jours actifs.
//
// ┌─ CE QU'UN COMPTEUR DE SÉRIE DOIT ET NE DOIT PAS FAIRE ────────────┐
// │ Il doit récompenser la RÉGULARITÉ, qui est le facteur le mieux    │
// │ établi de progression à long terme — devant le choix des          │
// │ exercices, le matériel et la périodisation.                       │
// │                                                                    │
// │ Il ne doit pas mentir. Trois règles en découlent :                 │
// │                                                                    │
// │   1. La journée en cours ne casse rien tant qu'elle n'est pas      │
// │      finie. Un compteur qui affiche « série perdue » à 9 h du     │
// │      matin punit quelqu'un qui n'a encore rien raté.               │
// │                                                                    │
// │   2. Les jours de REPOS PRÉVUS ne cassent pas la série. Un         │
// │      programme à 4 jours par semaine impose trois jours sans       │
// │      séance : les compter comme des échecs pousserait à           │
// │      s'entraîner contre son propre plan. La série se mesure en    │
// │      SEMAINES tenues, pas en jours consécutifs.                    │
// │                                                                    │
// │   3. Aucun objectif inventé. Le seuil hebdomadaire est celui du   │
// │      programme actif ; sans programme, il n'y a pas de série,     │
// │      et on le dit.                                                 │
// └────────────────────────────────────────────────────────────────────┘

const DAY_MS = 86_400_000;

const parse = (iso) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Lundi de la semaine contenant `iso`.
 *
 * La semaine commence lundi : c'est la convention ISO, et celle des
 * programmes de l'application.
 */
export function weekStart(iso) {
  const ms = parse(iso);
  const dow = new Date(ms).getUTCDay(); // 0 = dimanche
  const offset = (dow + 6) % 7;
  return toIso(ms - offset * DAY_MS);
}

/**
 * Série de semaines où l'objectif de séances a été tenu.
 *
 * @param {object} p
 * @param {string[]} p.sessionDates  dates locales des séances (AAAA-MM-JJ)
 * @param {number}   p.perWeek       séances visées par semaine
 * @param {string}   p.today
 * @returns {{current, best, weeks, this_week, target_per_week, note}}
 */
export function weeklyStreak({ sessionDates = [], perWeek = 0, today } = {}) {
  if (!(perWeek > 0)) {
    return {
      current: 0,
      best: 0,
      weeks: [],
      this_week: 0,
      target_per_week: 0,
      note: 'Aucun programme actif : il n’y a pas d’objectif hebdomadaire à tenir.',
    };
  }

  const counts = new Map();
  for (const date of sessionDates) {
    const key = weekStart(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const currentWeek = weekStart(today);
  const thisWeek = counts.get(currentWeek) ?? 0;

  // On remonte dans le temps depuis la semaine COMPLÉTÉE la plus
  // récente. La semaine en cours ne peut que prolonger la série, jamais
  // l'interrompre : elle n'est pas finie.
  let cursor = toIso(parse(currentWeek) - 7 * DAY_MS);
  let current = thisWeek >= perWeek ? 1 : 0;
  while ((counts.get(cursor) ?? 0) >= perWeek) {
    current += 1;
    cursor = toIso(parse(cursor) - 7 * DAY_MS);
  }

  // Meilleure série historique : balayage des semaines connues, du plus
  // ancien au plus récent, en comptant les trous.
  const known = [...counts.keys()].sort();
  let best = 0;
  let run = 0;
  if (known.length) {
    let week = known[0];
    const last = currentWeek;
    while (week <= last) {
      if ((counts.get(week) ?? 0) >= perWeek) {
        run += 1;
        best = Math.max(best, run);
      } else if (week !== currentWeek) {
        // La semaine en cours, incomplète, ne rompt pas le décompte
        // historique : elle n'a pas encore eu sa chance.
        run = 0;
      }
      week = toIso(parse(week) + 7 * DAY_MS);
    }
  }
  best = Math.max(best, current);

  // Huit dernières semaines, pour la lecture graphique.
  const weeks = [];
  for (let i = 7; i >= 0; i -= 1) {
    const key = toIso(parse(currentWeek) - i * DAY_MS * 7);
    const done = counts.get(key) ?? 0;
    weeks.push({
      week_start: key,
      sessions: done,
      target: perWeek,
      met: done >= perWeek,
      in_progress: key === currentWeek,
    });
  }

  return {
    current,
    best,
    weeks,
    this_week: thisWeek,
    target_per_week: perWeek,
    remaining_this_week: Math.max(0, perWeek - thisWeek),
    note: current > 0
      ? `${current} semaine${current > 1 ? 's' : ''} d’affilée à ${perWeek} séances ou plus.`
      : 'Tiens l’objectif cette semaine pour démarrer une série.',
  };
}
