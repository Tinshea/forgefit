// Adhérence : ce qui était prévu face à ce qui a été fait.
//
// L'application savait dire ce qu'on avait fait. Elle ne savait pas dire
// ce qu'on avait RATÉ — or c'est la seule information qui explique une
// progression qui stagne. Un programme parfait suivi une fois sur deux
// vaut moins qu'un programme moyen suivi.
//
// Module pur : les requêtes vivent dans la route. On lui passe le
// programme, ses jours et les séances, il rend le bilan.

import { dateRange, programWeek } from './scheduling.js';

/**
 * Bilan hebdomadaire d'adhérence.
 *
 * @param {object} p
 * @param {object} p.program   {starts_on, weeks}
 * @param {Array}  p.days      jours de programme placés {id, weekday, title}
 * @param {Array}  p.sessions  séances {local_date, program_day_id}
 * @param {string} p.from      première date observée
 * @param {string} p.to        dernière date observée
 * @param {string} p.today     date du jour, pour ne pas compter l'avenir
 */
export function computeAdherence({
  program, days = [], sessions = [], from, to, today,
} = {}) {
  if (!program) {
    return {
      program: null,
      weeks: [],
      summary: null,
      note: 'Aucun programme actif : il n’y a rien à comparer. L’adhérence mesure '
        + 'l’écart entre un plan et sa réalisation, pas la quantité d’entraînement.',
    };
  }

  const byWeekday = new Map(days.map((d) => [d.weekday, d]));
  const sessionsByDate = new Map();
  for (const s of sessions) {
    if (!sessionsByDate.has(s.local_date)) sessionsByDate.set(s.local_date, []);
    sessionsByDate.get(s.local_date).push(s);
  }

  const weeks = new Map();

  for (const { date, weekday } of dateRange(from, to)) {
    const week = programWeek(date, program.starts_on);
    // Hors cycle : avant le départ ou après la dernière semaine. Ces
    // jours ne comptent ni au numérateur ni au dénominateur.
    if (week < 1 || week > program.weeks) continue;
    // L'avenir n'est pas un manquement : une séance prévue demain n'est
    // pas ratée. La compter ferait chuter le taux à mesure qu'on
    // regarde loin devant.
    if (date > today) continue;

    if (!weeks.has(week)) {
      weeks.set(week, {
        week, planned: 0, done: 0, extra: 0, missed: [], start: date, end: date,
      });
    }
    const entry = weeks.get(week);
    entry.end = date;

    const planned = byWeekday.get(weekday) ?? null;
    const daySessions = sessionsByDate.get(date) ?? [];

    if (planned) {
      entry.planned += 1;
      const executed = daySessions.some((s) => s.program_day_id === planned.id);
      if (executed) entry.done += 1;
      else entry.missed.push({ date, title: planned.title });
    }

    // Séances libres, ou rattachées à un autre jour de programme : elles
    // ne comptent pas comme le plan suivi, mais les ignorer ferait
    // croire à une semaine vide alors qu'on s'est entraîné.
    entry.extra += daySessions.filter(
      (s) => !planned || s.program_day_id !== planned.id,
    ).length;
  }

  const list = [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map((w) => ({
      ...w,
      rate: w.planned ? Math.round((w.done / w.planned) * 100) : null,
    }));

  const totalPlanned = list.reduce((n, w) => n + w.planned, 0);
  const totalDone = list.reduce((n, w) => n + w.done, 0);
  const totalExtra = list.reduce((n, w) => n + w.extra, 0);

  return {
    program: {
      name: program.name,
      starts_on: program.starts_on,
      weeks: program.weeks,
      days_per_week: days.length,
    },
    weeks: list,
    summary: {
      planned: totalPlanned,
      done: totalDone,
      extra: totalExtra,
      rate: totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : null,
      missed: list.flatMap((w) => w.missed),
      streak: currentStreak(list),
      verdict: verdictFor(totalPlanned ? totalDone / totalPlanned : null),
    },
  };
}

/** Semaines consécutives complètes, en partant de la plus récente. */
function currentStreak(weeks) {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (weeks[i].planned > 0 && weeks[i].done >= weeks[i].planned) streak += 1;
    else break;
  }
  return streak;
}

/**
 * Verdict qualitatif.
 *
 * Les seuils ne sortent d'aucune étude : ce sont des repères de lecture,
 * et ils sont annoncés comme tels. Prétendre le contraire serait le
 * genre de faux chiffre que le reste de l'application évite.
 */
function verdictFor(rate) {
  if (rate == null) return { label: 'Rien de prévu', note: 'Aucune séance programmée sur la période.' };
  if (rate >= 0.9) {
    return {
      label: 'Programme suivi',
      note: 'Le plan est tenu. C’est la condition pour que son dosage veuille dire quelque chose.',
    };
  }
  if (rate >= 0.7) {
    return {
      label: 'Suivi correct',
      note: 'Quelques séances manquent. Le volume hebdomadaire réel est inférieur à celui '
        + 'affiché par le programme.',
    };
  }
  if (rate >= 0.4) {
    return {
      label: 'Suivi irrégulier',
      note: 'Moins de trois séances sur quatre. Un programme moins ambitieux mais tenu '
        + 'donnerait davantage — le volume réel est ce qui compte, pas le volume prévu.',
    };
  }
  return {
    label: 'Programme peu suivi',
    note: 'Le plan et la réalité ont peu de rapport. Réduire le nombre de jours rendrait '
      + 'le programme atteignable, et son dosage de nouveau significatif.',
  };
}
