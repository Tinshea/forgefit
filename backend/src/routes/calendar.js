import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, badRequest, notFound, userOf } from '../lib/http.js';
import { buildCalendar } from '../services/icalendar.js';

export const calendarRouter = Router();

/**
 * Abonnement iCalendar.
 *
 * Une application d'agenda sonde une URL toutes les quelques heures ;
 * elle ne sait pas envoyer d'en-tête d'authentification. Le secret tient
 * donc dans l'URL, sous forme d'un jeton dédié — jamais l'identifiant
 * d'utilisateur, qui sert ailleurs et ne se révoque pas.
 */

const TOKEN_PATTERN = /^[0-9a-f]{32,96}$/i;

/** Programme actif et ses séances placées, pour un utilisateur donné. */
async function loadSchedule(userId) {
  const { rows: [program] } = await query(
    `SELECT id, name, weeks, starts_on::text AS starts_on
       FROM programs WHERE user_id = $1 AND is_active LIMIT 1`,
    [userId],
  );
  if (!program) return { program: null, days: [] };

  const { rows: days } = await query(
    `SELECT d.id, d.title, d.focus, d.weekday,
            d.start_time::text AS start_time, d.duration_minutes,
            COALESCE(
              json_agg(
                json_build_object(
                  'name_fr', e.name_fr,
                  'target_sets', i.target_sets,
                  'target_reps', i.target_reps,
                  'target_reps_max', i.target_reps_max,
                  'target_seconds', i.target_seconds,
                  'suggested_kg', i.suggested_kg
                ) ORDER BY i.position
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) AS items
       FROM program_days d
       LEFT JOIN program_items i ON i.program_day_id = d.id
       LEFT JOIN exercises e     ON e.id = i.exercise_id
      WHERE d.program_id = $1 AND d.weekday IS NOT NULL
      GROUP BY d.id
      ORDER BY d.weekday`,
    [program.id],
  );

  return { program, days };
}

/**
 * GET /api/calendar/subscribe.ics?token=…&tz=…
 *
 * Point d'entrée de l'abonnement. Volontairement hors de
 * `/api/programs` : c'est la seule route publique de l'application, et
 * la séparer rend cette exception visible plutôt que noyée.
 */
calendarRouter.get('/subscribe.ics', asyncHandler(async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!TOKEN_PATTERN.test(token)) throw badRequest('Jeton d’abonnement invalide');

  const timezone = String(req.query.tz ?? 'UTC');
  if (!/^[\w/+-]{1,64}$/.test(timezone)) throw badRequest(`Fuseau horaire invalide : ${timezone}`);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw badRequest(`Fuseau horaire inconnu : ${timezone}`);
  }

  const { rows: [user] } = await query(
    'SELECT id, display_name FROM users WHERE calendar_token = $1',
    [token],
  );
  // Jeton révoqué ou inexistant : 404 plutôt que 401. L'abonnement n'a
  // pas d'identité à présenter, un 401 ferait redemander un mot de passe
  // à une application d'agenda qui n'en a aucun.
  if (!user) throw notFound('Abonnement introuvable ou révoqué');

  const { program, days } = await loadSchedule(user.id);

  const ics = program
    ? buildCalendar(program, days, {
      timezone,
      calendarName: `ForgeFit — ${program.name}`,
      reminderMinutes: Number(req.query.reminder ?? 60),
    })
    // Aucun programme actif : un calendrier VIDE mais valide. Renvoyer
    // une erreur ferait afficher un abonnement en échec dans l'agenda,
    // alors que la situation est normale.
    : buildCalendar(
      { name: 'ForgeFit', starts_on: new Date().toISOString().slice(0, 10), weeks: 1 },
      [],
      { timezone, calendarName: 'ForgeFit — aucun programme actif' },
    );

  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="forgefit.ics"',
    // Les agendas resondent régulièrement : une mise en cache longue
    // figerait le programme pendant des heures après une modification.
    'Cache-Control': 'no-cache, max-age=0',
  });
  res.send(ics);
}));

/** GET /api/calendar/subscription — le lien à coller dans son agenda. */
calendarRouter.get('/subscription', asyncHandler(async (req, res) => {
  const { rows: [row] } = await query(
    'SELECT calendar_token FROM users WHERE id = $1',
    [userOf(req)],
  );
  if (!row) throw notFound('Utilisateur introuvable');

  res.json({
    token: row.calendar_token,
    path: `/api/calendar/subscribe.ics?token=${row.calendar_token}`,
    // L'URL absolue est construite côté client : derrière un proxy,
    // l'hôte vu par l'API n'est pas celui que voit le navigateur.
    instructions: [
      'Google Agenda : Autres agendas → + → À partir de l’URL, puis coller le lien.',
      'Apple Calendrier : Fichier → Nouvel abonnement à un calendrier, puis coller le lien.',
      'Outlook : Ajouter un calendrier → S’abonner à partir du Web.',
    ],
    caveats: [
      'L’abonnement est en lecture seule : modifier un évènement dans l’agenda ne '
        + 'change rien dans ForgeFit.',
      'Google resynchronise de lui-même, souvent toutes les quelques heures : une '
        + 'modification du programme peut mettre un moment à s’y voir.',
      'Toute personne disposant du lien voit votre programme. Régénérez le jeton pour '
        + 'couper les abonnements existants.',
      'Le calendrier suit le programme ACTIF. En activer un autre change ce que '
        + 'l’agenda affiche.',
    ],
  });
}));

/**
 * POST /api/calendar/subscription/rotate — révoque et régénère le jeton.
 *
 * C'est le seul moyen de couper un lien partagé par erreur : les
 * abonnements existants cessent de fonctionner.
 */
calendarRouter.post('/subscription/rotate', asyncHandler(async (req, res) => {
  const { rows: [row] } = await query(
    `UPDATE users SET calendar_token = encode(gen_random_bytes(24), 'hex')
      WHERE id = $1
      RETURNING calendar_token`,
    [userOf(req)],
  );
  if (!row) throw notFound('Utilisateur introuvable');
  res.json({
    token: row.calendar_token,
    path: `/api/calendar/subscribe.ics?token=${row.calendar_token}`,
  });
}));
