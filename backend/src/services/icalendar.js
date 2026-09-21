// Export iCalendar (RFC 5545).
//
// Pourquoi ce format plutôt que l'API Google Calendar : une URL .ics
// s'abonne depuis Google, Apple, Outlook et à peu près tout le reste,
// sans compte développeur, sans OAuth, sans jeton à renouveler. Elle est
// aussi la seule voie utilisable hors ligne et sur un serveur personnel.
//
// Contrepartie assumée : l'abonnement est en LECTURE SEULE et Google ne
// le resynchronise que toutes les quelques heures — une modification du
// programme n'apparaît donc pas immédiatement dans l'agenda.
//
// Un évènement par séance de programme, répété par RRULE hebdomadaire.
// Émettre une occurrence par semaine gonflerait le fichier et, surtout,
// interdirait à l'agenda de reconnaître une série.

/**
 * Échappement des valeurs textuelles.
 *
 * Une virgule ou un point-virgule non échappé coupe la valeur en deux
 * listes de paramètres : le titre d'une séance suffirait à casser tout
 * le fichier pour le client qui le lit.
 */
const escapeText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/**
 * Pliage des lignes à 75 octets.
 *
 * La norme l'impose, et certains clients tronquent silencieusement les
 * lignes plus longues. Le découpage se fait sur les OCTETS, pas sur les
 * caractères : « é » en compte deux, et couper au milieu produirait un
 * fichier invalide.
 */
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Ne jamais couper au milieu d'une séquence UTF-8 : les octets de
    // continuation valent 0b10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    // Les lignes suivantes sont préfixées d'une espace, qui consomme un
    // octet du budget.
    limit = 74;
  }

  return parts.join('\r\n ');
}

/** Horodatage UTC, format `AAAAMMJJTHHMMSSZ`. */
const utcStamp = (date) => new Date(date).toISOString().replace(/[-:]|\.\d{3}/g, '');

/** Date et heure locales, format `AAAAMMJJTHHMMSS` (sans Z). */
function localStamp(isoDate, time) {
  const [h = '00', m = '00', s = '00'] = String(time ?? '18:00:00').split(':');
  return `${String(isoDate).replace(/-/g, '')}T${h.padStart(2, '0')}${m.padStart(2, '0')}`
    + `${String(s).padStart(2, '0')}`;
}

const ICAL_WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/**
 * Première occurrence d'un jour ISO à partir d'une date.
 *
 * `DTSTART` doit tomber sur le jour que décrit la `RRULE`, sinon les
 * clients divergent : certains ignorent la première occurrence, d'autres
 * l'ajoutent en plus de la série.
 */
export function firstOccurrence(startsOn, weekday) {
  const start = new Date(`${startsOn}T00:00:00Z`);
  const startIso = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  const shift = (weekday - startIso + 7) % 7;
  return new Date(start.getTime() + shift * 86_400_000).toISOString().slice(0, 10);
}

/** Résumé lisible d'une ligne de programme, pour la description. */
function describeItem(item) {
  const dose = item.target_seconds
    ? `${item.target_sets} × ${item.target_seconds} s`
    : `${item.target_sets} × ${item.target_reps}`
      + (item.target_reps_max ? `-${item.target_reps_max}` : '');
  const load = item.suggested_kg != null ? ` @ ${Number(item.suggested_kg)} kg` : '';
  return `• ${item.name_fr} — ${dose}${load}`;
}

/**
 * Construit le flux iCalendar d'un programme.
 *
 * @param {object} program  programme actif, avec `starts_on` et `weeks`
 * @param {Array}  days     séances placées (`weekday` non nul), avec leurs lignes
 * @param {object} options  `{ productId, calendarName, reminderMinutes, timezone }`
 */
export function buildCalendar(program, days, options = {}) {
  const {
    productId = '-//ForgeFit//Programme//FR',
    calendarName = program ? `ForgeFit — ${program.name}` : 'ForgeFit',
    reminderMinutes = 60,
    timezone = 'UTC',
  } = options;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeText(productId)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Propriétés non normalisées mais comprises de Google, Apple et
    // Outlook : sans elles, l'agenda s'appelle du nom de l'URL.
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeText(timezone)}`,
    // Intervalle de rafraîchissement souhaité. Les clients en font ce
    // qu'ils veulent — Google impose le sien — mais l'indiquer coûte
    // une ligne.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  // Le fuseau est défini dans le fichier, avant tout évènement qui s'y
  // réfère : un `TZID` orphelin n'est pas conforme, même si les clients
  // grand public le tolèrent.
  const vtimezone = buildVTimezone(timezone);
  if (vtimezone) lines.push(...vtimezone);

  const now = utcStamp(new Date());

  for (const day of days) {
    if (!day.weekday) continue;

    const firstDate = firstOccurrence(program.starts_on, day.weekday);
    const start = localStamp(firstDate, day.start_time);
    const end = localStamp(
      firstDate,
      addMinutes(day.start_time, day.duration_minutes ?? 60),
    );

    const items = day.items ?? [];
    const description = [
      day.focus ? `Dominante : ${day.focus}` : null,
      items.length ? '' : null,
      ...items.map(describeItem),
      '',
      `Programme : ${program.name} (${program.weeks} semaines)`,
    ].filter((x) => x !== null).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      // Stable d'un export à l'autre : sans cela, chaque
      // resynchronisation créerait des doublons au lieu de mettre à jour.
      `UID:${day.id}@forgefit`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${timezone}:${start}`,
      `DTEND;TZID=${timezone}:${end}`,
      `RRULE:FREQ=WEEKLY;COUNT=${Math.max(1, program.weeks)};BYDAY=${ICAL_WEEKDAYS[day.weekday - 1]}`,
      `SUMMARY:${escapeText(day.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'CATEGORIES:ForgeFit',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-PT${Math.max(0, reminderMinutes)}M`,
      `DESCRIPTION:${escapeText(day.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  // CRLF, imposé par la norme : quelques clients refusent un fichier en
  // LF seul.
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** Ajoute des minutes à une heure `HH:MM[:SS]`. */
export function addMinutes(time, minutes) {
  const [h = 0, m = 0] = String(time ?? '18:00').split(':').map(Number);
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:`
    + `${String(total % 60).padStart(2, '0')}:00`;
}

// ---------------------------------------------------------------------
// VTIMEZONE
//
// `DTSTART;TZID=Europe/Paris` sans composant VTIMEZONE n'est pas
// conforme à la RFC 5545 : la norme veut que le fichier porte lui-même
// la définition du fuseau. Google et Apple résolvent les noms IANA
// malgré tout, mais un fichier valide ne doit pas dépendre de leur
// tolérance.
//
// Les décalages sont lus dans le moteur d'internationalisation plutôt
// que codés en dur : une base de fuseaux recopiée à la main serait
// périmée à la première réforme d'heure d'été.
// ---------------------------------------------------------------------

/** Décalage d'un fuseau à un instant donné, en minutes. */
export function offsetMinutes(timezone, date) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, timeZoneName: 'longOffset',
  }).format(date);
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(formatted);
  // « GMT » sans décalage signifie UTC.
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

const pad = (n) => String(n).padStart(2, '0');
const asIcalOffset = (minutes) => {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
};

/**
 * Transitions d'heure d'une année, trouvées par balayage puis dichotomie.
 *
 * Un balayage à l'heure près sur une année ferait 8 760 appels au
 * formateur ; le balayage journalier en fait 365, et la dichotomie
 * cinq de plus par transition.
 */
function findTransitions(timezone, year) {
  const transitions = [];
  let previous = offsetMinutes(timezone, new Date(Date.UTC(year, 0, 1)));

  for (let day = 1; day <= 366; day += 1) {
    const at = new Date(Date.UTC(year, 0, 1 + day));
    if (at.getUTCFullYear() !== year) break;
    const current = offsetMinutes(timezone, at);
    if (current === previous) continue;

    let low = new Date(Date.UTC(year, 0, day));
    let high = at;
    // À la minute près : une transition trouvée à l'heure près placerait
    // le basculement 30 minutes à côté dans la définition du fuseau.
    while (high - low > 60_000) {
      const mid = new Date((low.getTime() + high.getTime()) / 2);
      if (offsetMinutes(timezone, mid) === previous) low = mid;
      else high = mid;
    }
    transitions.push({ at: high, from: previous, to: current });
    previous = current;
  }
  return transitions;
}

const ICAL_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Règle annuelle décrivant une transition.
 *
 * Les changements d'heure tombent sur un rang de jour dans le mois
 * (« dernier dimanche de mars »), pas sur une date fixe : une RRULE sur
 * la date serait fausse dès l'année suivante.
 */
function yearlyRule(localDate) {
  const month = localDate.getUTCMonth() + 1;
  const dayOfMonth = localDate.getUTCDate();
  const weekday = ICAL_DAYS[localDate.getUTCDay()];

  const daysInMonth = new Date(Date.UTC(
    localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, 0,
  )).getUTCDate();
  // Dernière occurrence du mois si moins de sept jours suivent.
  const ordinal = dayOfMonth + 7 > daysInMonth
    ? -1
    : Math.floor((dayOfMonth - 1) / 7) + 1;

  return `FREQ=YEARLY;BYMONTH=${month};BYDAY=${ordinal}${weekday}`;
}

/**
 * Heure LOCALE d'une transition, dans le décalage qui précède.
 *
 * Arrondie à la minute inférieure : la dichotomie converge à la minute
 * près, et aucun changement d'heure ne tombe au milieu d'une minute.
 */
function localStampAt(date, offsetBefore) {
  const shifted = new Date(date.getTime() + offsetBefore * 60_000);
  return `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}`
    + `${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}`
    + `${pad(shifted.getUTCMinutes())}00`;
}

/**
 * Composant VTIMEZONE d'un fuseau.
 *
 * Gère le cas courant : zéro transition (fuseau sans heure d'été) ou
 * deux par an. Un fuseau plus exotique retombe sur une définition à
 * décalage unique — approximative, mais valide, et signalée par
 * `X-FORGEFIT-APPROX` plutôt que passée sous silence.
 */
export function buildVTimezone(timezone, year = new Date().getUTCFullYear()) {
  let transitions;
  try {
    transitions = findTransitions(timezone, year);
  } catch {
    return null;
  }

  const base = offsetMinutes(timezone, new Date(Date.UTC(year, 0, 1)));

  if (transitions.length !== 2) {
    const lines = [
      'BEGIN:VTIMEZONE',
      `TZID:${timezone}`,
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${asIcalOffset(base)}`,
      `TZOFFSETTO:${asIcalOffset(base)}`,
      `TZNAME:${timezone}`,
      'END:STANDARD',
    ];
    if (transitions.length) lines.splice(2, 0, 'X-FORGEFIT-APPROX:TRUE');
    lines.push('END:VTIMEZONE');
    return lines;
  }

  const [first, second] = transitions;
  const daylight = first.to > first.from ? first : second;
  const standard = first.to > first.from ? second : first;

  return [
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    'BEGIN:DAYLIGHT',
    `DTSTART:${localStampAt(daylight.at, daylight.from)}`,
    `RRULE:${yearlyRule(new Date(daylight.at.getTime() + daylight.from * 60_000))}`,
    `TZOFFSETFROM:${asIcalOffset(daylight.from)}`,
    `TZOFFSETTO:${asIcalOffset(daylight.to)}`,
    'TZNAME:DST',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    `DTSTART:${localStampAt(standard.at, standard.from)}`,
    `RRULE:${yearlyRule(new Date(standard.at.getTime() + standard.from * 60_000))}`,
    `TZOFFSETFROM:${asIcalOffset(standard.from)}`,
    `TZOFFSETTO:${asIcalOffset(standard.to)}`,
    'TZNAME:STD',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}
