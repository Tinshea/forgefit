// Progression, niveaux et distinctions.
//
// ┌─ CE QU'UNE GAMIFICATION HONNÊTE PEUT ET NE PEUT PAS FAIRE ────────┐
// │ Elle peut rendre VISIBLE un travail qui, autrement, disparaît :   │
// │ deux ans d'entraînement régulier ne laissent qu'une liste de      │
// │ séances. Un niveau qui monte lentement dit quelque chose de vrai  │
// │ sur ce cumul.                                                      │
// │                                                                    │
// │ Elle ne peut pas inventer de points. Chaque XP de ce fichier EST  │
// │ une charge d'entraînement réellement enregistrée — RPE × durée.   │
// │ Rien n'est attribué pour avoir ouvert l'application, complété un  │
// │ profil ou consulté un écran.                                      │
// │                                                                    │
// │ Et elle ne doit RÉCOMPENSER AUCUN COMPORTEMENT NUISIBLE. D'où     │
// │ trois règles qui ont façonné tout ce qui suit :                   │
// │                                                                    │
// │   1. Rendements décroissants au-delà d'une charge quotidienne     │
// │      élevée. Passé un certain point, le volume supplémentaire     │
// │      est de la dette de récupération, pas du progrès : le         │
// │      compteur cesse de le payer plein tarif.                      │
// │                                                                    │
// │   2. AUCUNE distinction pour s'entraîner tous les jours, ni pour  │
// │      une séance interminable. Ce serait payer quelqu'un pour se   │
// │      blesser.                                                      │
// │                                                                    │
// │   3. Rien ne se perd. Aucun niveau ne redescend, aucune           │
// │      distinction ne se retire. Une interruption — blessure,       │
// │      travail, lassitude — ne doit pas effacer ce qui a été fait.  │
// └────────────────────────────────────────────────────────────────────┘

/**
 * Charge quotidienne au-delà de laquelle les gains ralentissent.
 *
 * 600 AU correspond à une bonne grosse séance : une heure et demie à
 * RPE 6,7, ou une heure à RPE 10.
 */
export const DAILY_SOFT_CAP = 600;

/**
 * XP d'une journée, rendements décroissants compris.
 *
 *   au-delà du plafond :  XP = C + 2C × (√(1 + excès/C) − 1)
 *
 * Cette forme est choisie pour deux propriétés que la racine carrée
 * naïve (`C + √(excès × C)`) n'a PAS :
 *
 *   — elle vaut C exactement au plafond, sans marche ;
 *   — sa PENTE y vaut 1, puis décroît. La version naïve avait une pente
 *     infinie juste après le plafond : les premières unités au-dessus
 *     rapportaient PLUS que celles d'en dessous, soit l'inverse exact
 *     de l'effet recherché. À 1 200 de charge, elle rendait 1 200 XP —
 *     aucun freinage du tout.
 *
 * Concrètement : 1 200 de charge rapportent ≈ 1 097 XP, 2 400 en
 * rapportent 1 800. Doubler une journée déjà lourde n'achète plus
 * qu'une fraction.
 */
export function xpForDay(dayLoad) {
  const load = Number(dayLoad) || 0;
  if (load <= 0) return 0;
  if (load <= DAILY_SOFT_CAP) return Math.round(load);
  const excess = load - DAILY_SOFT_CAP;
  const tapered = 2 * DAILY_SOFT_CAP * (Math.sqrt(1 + excess / DAILY_SOFT_CAP) - 1);
  return Math.round(DAILY_SOFT_CAP + tapered);
}

/**
 * Courbe de niveau.
 *
 *   XP cumulée pour atteindre le niveau L = FACTEUR × (L − 1)²
 *
 * Progression quadratique : chaque niveau demande un peu plus que le
 * précédent, sans jamais devenir hors d'atteinte. Concrètement, à
 * raison de quatre séances par semaine, le niveau 10 arrive vers trois
 * mois, le niveau 30 vers deux ans et demi. C'est volontairement LENT :
 * un niveau qui monte vite ne dit plus rien au bout d'un mois.
 */
export const LEVEL_FACTOR = 250;

export const xpForLevel = (level) => (level <= 1 ? 0 : LEVEL_FACTOR * (level - 1) ** 2);

export function levelFor(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = Math.floor(Math.sqrt(xp / LEVEL_FACTOR)) + 1;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xp: Math.round(xp),
    into_level: Math.round(xp - floor),
    level_span: next - floor,
    to_next: Math.round(next - xp),
    progress: Math.min(1, Math.round(((xp - floor) / (next - floor)) * 1000) / 1000),
  };
}

/**
 * Titres de palier.
 *
 * Ils nomment un NIVEAU D'ENGAGEMENT accumulé, jamais un niveau de
 * performance : l'application ne mesure ni ta VO₂max ni ton 1RM
 * relatif, et prétendre le contraire serait faux.
 */
const TITLES = [
  [1, 'Débutant'],
  [5, 'Pratiquant régulier'],
  [10, 'Pratiquant confirmé'],
  [18, 'Athlète amateur'],
  [28, 'Athlète assidu'],
  [40, 'Vétéran'],
  [55, 'Pilier'],
];

export function titleFor(level) {
  let title = TITLES[0][1];
  for (const [min, label] of TITLES) if (level >= min) title = label;
  return title;
}

/**
 * Distinctions.
 *
 * Chacune porte sa règle EN CLAIR : une distinction dont on ne peut pas
 * lire la condition ressemble à une loterie. `progress` permet d'afficher
 * l'avancement plutôt qu'un simple verrou — savoir qu'il manque deux
 * sports est motivant, « non débloqué » ne l'est pas.
 *
 * `tiers` décline une même idée en paliers : mieux vaut une distinction
 * qui grandit que dix distinctions distinctes qui encombrent l'écran.
 */
const tiered = (id, label, icon, rule, tiers, valueOf) => ({
  id,
  label,
  icon,
  rule,
  tiers,
  evaluate: (stats) => {
    const value = valueOf(stats) ?? 0;
    const reached = tiers.filter((t) => value >= t.at);
    const current = reached.at(-1) ?? null;
    const next = tiers.find((t) => value < t.at) ?? null;
    return {
      value,
      tier: current ? current.name : null,
      tier_index: reached.length,
      tier_count: tiers.length,
      earned: reached.length > 0,
      next: next ? { name: next.name, at: next.at } : null,
      progress: next ? Math.min(1, value / next.at) : 1,
    };
  },
});

export const BADGES = [
  tiered(
    'explorateur', 'Explorateur', '🧭',
    'Nombre de sports différents pratiqués au moins une fois.',
    [
      { at: 3, name: 'Curieux' },
      { at: 6, name: 'Explorateur' },
      { at: 12, name: 'Touche-à-tout' },
      { at: 20, name: 'Caméléon' },
    ],
    (s) => s.sports_practised,
  ),
  tiered(
    'polyvalent', 'Polyvalent', '🎯',
    'Catégories différentes pratiquées sur les 28 derniers jours. '
    + 'Mélanger force, endurance et technique protège mieux qu’une seule '
    + 'discipline poussée à fond.',
    [
      { at: 2, name: 'Double casquette' },
      { at: 3, name: 'Polyvalent' },
      { at: 4, name: 'Athlète complet' },
      { at: 5, name: 'Décathlonien' },
    ],
    (s) => s.categories_recent,
  ),
  tiered(
    'regularite', 'Régularité', '📅',
    'Semaines consécutives où l’objectif du programme a été tenu. '
    + 'La régularité est le facteur de progression le mieux établi, devant '
    + 'le choix des exercices et le matériel.',
    [
      { at: 4, name: 'Un mois' },
      { at: 12, name: 'Un trimestre' },
      { at: 26, name: 'Six mois' },
      { at: 52, name: 'Une année' },
    ],
    (s) => s.best_streak,
  ),
  tiered(
    'endurance', 'Cœur solide', '❤️',
    'Semaines où les 150 minutes d’activité modérée recommandées par '
    + 'l’OMS ont été atteintes.',
    [
      { at: 1, name: 'Première semaine' },
      { at: 10, name: 'Habitude prise' },
      { at: 30, name: 'Mode de vie' },
      { at: 75, name: 'Seconde nature' },
    ],
    (s) => s.who_weeks,
  ),
  tiered(
    'charge', 'Kilomètres au compteur', '⚙️',
    'Charge d’entraînement cumulée, toutes disciplines confondues '
    + '(RPE × minutes).',
    [
      { at: 10_000, name: 'Premiers pas' },
      { at: 50_000, name: 'Du métier' },
      { at: 150_000, name: 'Du lourd' },
      { at: 400_000, name: 'Une vie de sport' },
    ],
    (s) => s.total_load,
  ),
  tiered(
    'seances', 'Présences', '✅',
    'Nombre total de séances terminées. Celles qu’on n’avait pas envie '
    + 'de faire comptent double — mais l’application ne sait pas lesquelles.',
    [
      { at: 25, name: '25 séances' },
      { at: 100, name: '100 séances' },
      { at: 365, name: '365 séances' },
      { at: 1000, name: '1000 séances' },
    ],
    (s) => s.total_sessions,
  ),
  tiered(
    'profondeur', 'Spécialiste', '🔬',
    'Séances dans ton sport le plus pratiqué. La polyvalence a ses '
    + 'distinctions, la profondeur aussi.',
    [
      { at: 20, name: 'Initié' },
      { at: 75, name: 'Habitué' },
      { at: 200, name: 'Spécialiste' },
      { at: 500, name: 'Maître' },
    ],
    (s) => s.top_sport_sessions,
  ),
  tiered(
    'retour', 'Le retour', '🔁',
    'Reprises après deux semaines ou plus d’interruption. Recommencer '
    + 'est plus difficile que continuer : ça se célèbre.',
    [
      { at: 1, name: 'Premier retour' },
      { at: 3, name: 'Increvable' },
      { at: 6, name: 'On ne lâche rien' },
    ],
    (s) => s.comebacks,
  ),
];

/**
 * Progression complète, depuis des agrégats déjà calculés.
 *
 * Aucun accès base ici : les mêmes chiffres doivent pouvoir être testés
 * sans Postgres, et la route reste seule responsable des requêtes.
 *
 * @param {object} stats
 * @param {Array<{date, load, category, sport}>} stats.days   charge quotidienne
 */
export function progression(stats = {}) {
  const days = stats.days ?? [];
  // L'XP se compte JOUR PAR JOUR, pas séance par séance : le plafond de
  // rendement décroissant porte sur la journée, sinon trois séances de
  // 400 échapperaient à un plafond que 1 200 d'un coup subirait.
  const totalXp = days.reduce((n, d) => n + xpForDay(d.load), 0);

  const byCategory = new Map();
  for (const s of stats.sessions ?? []) {
    if (!s.category || !(s.load > 0)) continue;
    const entry = byCategory.get(s.category) ?? { load: 0, sessions: 0 };
    entry.load += s.load;
    entry.sessions += 1;
    byCategory.set(s.category, entry);
  }

  const level = levelFor(totalXp);

  return {
    ...level,
    title: titleFor(level.level),
    // Un niveau par catégorie : c'est le portrait de ce qu'on pratique
    // vraiment, là où un niveau global le moyenne.
    categories: [...byCategory.entries()]
      .map(([category, e]) => ({
        category,
        sessions: e.sessions,
        load: Math.round(e.load),
        ...levelFor(e.load),
      }))
      .sort((a, b) => b.xp - a.xp),
    badges: BADGES.map((b) => ({
      id: b.id,
      label: b.label,
      icon: b.icon,
      rule: b.rule,
      ...b.evaluate(stats),
    })),
    soft_cap: DAILY_SOFT_CAP,
    method: [
      'Chaque XP est une charge d’entraînement réellement enregistrée : '
      + 'RPE × durée, en unités arbitraires.',
      `Au-delà de ${DAILY_SOFT_CAP} de charge sur une journée, les gains `
      + 'ralentissent : passé ce point, le volume supplémentaire coûte plus '
      + 'en récupération qu’il ne rapporte.',
      'Rien n’est attribué pour ouvrir l’application ou remplir un champ.',
      'Aucun niveau ne redescend et aucune distinction ne se retire : une '
      + 'interruption n’efface pas ce qui a été fait.',
    ],
  };
}
