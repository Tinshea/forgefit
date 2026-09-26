import express from 'express';
import { query } from '../db.js';
import { asyncHandler, userOf } from '../lib/http.js';
import { seanceDuJour, SOURCES_COACH, NATURES } from '../services/coach.js';
import {
  DISCIPLINES, disciplineOf, prioritesPhysiques, semaineType, SOURCES,
} from '../services/disciplines.js';
import {
  GRADES, KATA, KUMITE, TECHNIQUES, programmeDuGrade, prochainGrade,
  PILIERS, SOURCES as SOURCES_KARATE,
} from '../services/karate-syllabus.js';
import {
  sessionLoad, dailySeries, monotonyOf, acuteChronicRatio,
} from '../services/session-load.js';
import { natureDe } from '../services/session-nature.js';
import { disponibiliteDe } from '../services/readiness-gather.js';

export const coachRouter = express.Router();

/**
 * Le coach, côté HTTP.
 *
 * Toute la décision vit dans `services/coach.js`, qui est PUR : cette
 * route ne fait que rassembler l'état — objectif, charge récente,
 * séances de la semaine, éléments acquis — et le lui passer. C'est ce
 * qui permet de tester la décision sans base de données, et de la
 * rejouer telle quelle.
 */

/** L'objectif courant, ou `null` si rien n'est fixé. */
async function objectifDe(userId) {
  const { rows } = await query(
    `SELECT goal_discipline AS discipline, goal_grade AS grade,
            goal_sessions_per_week AS seances
       FROM users WHERE id = $1`,
    [userId],
  );
  const o = rows[0];
  if (!o?.discipline) return null;
  return {
    discipline: o.discipline,
    grade: o.grade ?? 9,
    seances: o.seances ?? 3,
  };
}

coachRouter.get('/disciplines', asyncHandler(async (req, res) => {
  res.json({
    items: DISCIPLINES.map((d) => ({
      key: d.key,
      label: d.label,
      famille: d.famille,
      repartition: d.repartition,
      priorites: prioritesPhysiques(d.key),
    })),
    sources: SOURCES,
  });
}));

coachRouter.get('/goal', asyncHandler(async (req, res) => {
  const objectif = await objectifDe(userOf(req));
  res.json({ goal: objectif, disciplines: DISCIPLINES.map((d) => ({ key: d.key, label: d.label })) });
}));

coachRouter.put('/goal', asyncHandler(async (req, res) => {
  const discipline = String(req.body?.discipline ?? '').trim() || null;
  if (discipline && !disciplineOf(discipline)) {
    return res.status(400).json({ error: `Discipline inconnue : ${discipline}` });
  }
  const grade = Number(req.body?.grade);
  const seances = Number(req.body?.sessions_per_week);

  // Bornes : un grade hors 1–9 ou vingt séances par semaine ne
  // produiraient pas une erreur, mais un plan absurde.
  if (discipline && !(grade >= 1 && grade <= 9)) {
    return res.status(400).json({ error: 'Le grade va du 9e au 1er kyu.' });
  }
  if (discipline && !(seances >= 1 && seances <= 14)) {
    return res.status(400).json({ error: 'Entre 1 et 14 séances par semaine.' });
  }

  await query(
    `UPDATE users SET goal_discipline = $2, goal_grade = $3,
            goal_sessions_per_week = $4, updated_at = now()
      WHERE id = $1`,
    [userOf(req), discipline, discipline ? grade : null, discipline ? seances : null],
  );
  return res.json({ goal: await objectifDe(userOf(req)) });
}));

/**
 * La séance du jour.
 *
 * Renvoie aussi l'ÉTAT qui a servi à décider : sans lui, « pourquoi
 * ça » n'aurait pas de réponse vérifiable, et le coach redeviendrait
 * un oracle.
 */
coachRouter.get('/today', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  // L'objectif n'est plus un prérequis : une séance PRÉVUE se suit même
  // sans objectif de discipline. C'est seulement en l'absence de plan
  // que le coach a besoin de savoir vers quoi il travaille.
  const objectif = await objectifDe(userId);

  // ── Charge récente, par les mêmes services que le reste ─────────
  const { rows: sessions } = await query(
    // Le `focus` du jour de programme est joint : c'est la donnée la
    // plus fiable pour savoir de quelle nature était la séance, bien
    // avant le titre.
    `SELECT s.started_at, s.ended_at, s.perceived_exertion, s.title, s.sport_key,
            d.focus
       FROM workout_sessions s
       LEFT JOIN program_days d ON d.id = s.program_day_id
      WHERE s.user_id = $1 AND s.started_at > now() - interval '28 days'
      ORDER BY s.started_at DESC`,
    [userId],
  );

  const pourCharge = sessions.map((s) => ({
    date: new Date(s.started_at).toISOString().slice(0, 10),
    load: sessionLoad({
      rpe: s.perceived_exertion,
      minutes: s.ended_at
        ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000)
        : null,
    }),
  })).filter((s) => s.load != null);

  const fin = new Date().toISOString().slice(0, 10);
  const debut = new Date(Date.now() - 27 * 86400000).toISOString().slice(0, 10);
  const serie = dailySeries(pourCharge, { from: debut, to: fin });

  // Ces deux services REFUSENT de se prononcer sans assez d'historique,
  // et c'est voulu : ils renvoient alors `null` avec une note. Le coach
  // sait décider sans eux — il ne doit pas hériter d'un chiffre inventé.
  const acwrBrut = acuteChronicRatio(serie);
  const monoBrut = monotonyOf(serie);
  const acwr = acwrBrut?.ratio ?? null;
  const monotonie = monoBrut?.monotony ?? null;

  // ── Disponibilité, depuis les objets connectés ──────────────────
  //
  // Même fonction que l'écran Aperçu : une seule formule, un seul
  // chiffre. Deux calculs parallèles finiraient par se contredire à
  // l'écran, et on ne saurait plus lequel décide.
  let disponibilite = null;
  try {
    disponibilite = (await disponibiliteDe(userId))?.score ?? null;
  } catch {
    // Signaux absents ou table vide : le coach décide sans, comme avant.
  }

  // ── Ce qui a déjà été fait cette semaine ────────────────────────
  //
  // La semaine commence le LUNDI : un plan hebdomadaire qui basculerait
  // le dimanche soir ferait apparaître une semaine vide au pire moment.
  const maintenant = new Date();
  const jour = (maintenant.getDay() + 6) % 7;
  const debutSemaine = new Date(maintenant);
  debutSemaine.setHours(0, 0, 0, 0);
  debutSemaine.setDate(debutSemaine.getDate() - jour);


  const faitCetteSemaine = {};
  const derniere = {};
  for (const s of sessions) {
    const n = natureDe(s);
    if (new Date(s.started_at) >= debutSemaine) {
      faitCetteSemaine[n] = (faitCetteSemaine[n] ?? 0) + 1;
    }
    // Les séances arrivent triées du plus récent au plus ancien.
    if (!derniere[n]) derniere[n] = s.started_at;
  }

  // ── Ce qui est PRÉVU aujourd'hui ────────────────────────────────
  //
  // Le programme actif porte des jours rattachés à un jour de semaine.
  // C'est la même lecture que le calendrier : une seule source de
  // vérité pour « qu'est-ce qui est prévu », sinon les deux écrans
  // finiraient par se contredire.
  const jourIso = ((new Date().getDay()) + 6) % 7 + 1; // lundi = 1
  const { rows: prevus } = await query(
    `SELECT d.id, d.title, d.focus, d.duration_minutes,
            COUNT(i.id)::int AS item_count
       FROM programs p
       JOIN program_days d ON d.program_id = p.id
       LEFT JOIN program_items i ON i.program_day_id = d.id
      WHERE p.user_id = $1 AND p.is_active AND d.weekday = $2
      GROUP BY d.id
      LIMIT 1`,
    [userId, jourIso],
  );

  let prevu = null;
  if (prevus[0]) {
    const jour = prevus[0];
    // Les exercices de la séance : sans eux, « suivre le programme »
    // voudrait dire ouvrir un autre écran pour savoir quoi faire.
    const { rows: items } = await query(
      `SELECT e.name_fr AS nom, i.target_sets, i.target_reps, i.rest_seconds
         FROM program_items i
         JOIN exercises e ON e.id = i.exercise_id
        WHERE i.program_day_id = $1
        ORDER BY i.position`,
      [jour.id],
    );
    prevu = {
      titre: jour.title,
      minutes: jour.duration_minutes ?? null,
      origine: 'programme',
      // L'identifiant du jour : sans lui, « Démarrer la séance » ne
      // pouvait pas ouvrir LA séance prévue, seulement emmener vers un
      // écran où il fallait recliquer.
      program_day_id: jour.id,
      contenu: items.length ? {
        blocs: items.map((it) => ({
          label: it.nom,
          minutes: null,
          detail: [
            it.target_sets ? `${it.target_sets} séries` : null,
            it.target_reps ? `${it.target_reps} répétitions` : null,
            it.rest_seconds ? `${it.rest_seconds} s de repos` : null,
          ].filter(Boolean).join(' · '),
        })),
        avertissement: null,
      } : null,
    };
  }

  // ── Ce qui est acquis dans le syllabus ──────────────────────────
  const { rows: acquis } = objectif ? await query(
    'SELECT item_key FROM discipline_progress WHERE user_id = $1 AND discipline = $2',
    [userId, objectif.discipline],
  ) : { rows: [] };

  const session = seanceDuJour({
    discipline: objectif?.discipline ?? null,
    kyu: objectif?.grade ?? 9,
    seancesParSemaine: objectif?.seances ?? 3,
    charge: { acwr, monotonie, disponibilite },
    derniere,
    faitCetteSemaine,
    acquis: acquis.map((a) => a.item_key),
    prevu,
    maintenant,
  });

  return res.json({
    goal: objectif,
    session,
    // L'état qui a servi à décider, pour que la recommandation soit
    // contestable et non à croire sur parole.
    etat: {
      acwr,
      monotonie,
      disponibilite,
      // Les notes disent POURQUOI un chiffre manque, au lieu de laisser
      // croire à une charge nulle.
      acwr_note: acwrBrut?.note ?? null,
      monotonie_note: monoBrut?.note ?? null,
      plan: objectif ? semaineType(objectif.discipline, objectif.seances) : null,
      fait: faitCetteSemaine,
      derniere,
      seances_28j: sessions.length,
    },
    sources: SOURCES_COACH,
  });
}));

/** Le syllabus complet, avec ce qui est déjà tenu. */
coachRouter.get('/syllabus', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const objectif = await objectifDe(userId);
  if (!objectif || objectif.discipline !== 'karate') {
    return res.json({ syllabus: null });
  }

  const { rows } = await query(
    'SELECT item_key FROM discipline_progress WHERE user_id = $1 AND discipline = $2',
    [userId, objectif.discipline],
  );
  const acquis = new Set(rows.map((r) => r.item_key));

  return res.json({
    grade: objectif.grade,
    piliers: PILIERS,
    courant: programmeDuGrade(objectif.grade),
    suivant: prochainGrade(objectif.grade),
    grades: GRADES,
    techniques: TECHNIQUES,
    kata: KATA,
    kumite: KUMITE,
    acquis: [...acquis],
    sources: SOURCES_KARATE,
  });
}));

/** Marquer un élément tenu, ou revenir dessus. */
coachRouter.post('/progress/:key', asyncHandler(async (req, res) => {
  const userId = userOf(req);
  const objectif = await objectifDe(userId);
  if (!objectif) return res.status(400).json({ error: 'Aucun objectif fixé.' });

  const key = String(req.params.key);
  const connu = TECHNIQUES[key] || KATA.some((k) => k.key === key)
    || KUMITE.some((k) => k.key === key);
  // Sans ce contrôle, une faute de frappe créerait une ligne fantôme
  // qui ne correspondrait à rien et ne se verrait jamais.
  if (!connu) return res.status(400).json({ error: `Élément inconnu : ${key}` });

  await query(
    `INSERT INTO discipline_progress (user_id, discipline, item_key)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, objectif.discipline, key],
  );
  return res.status(201).json({ acquired: key });
}));

coachRouter.delete('/progress/:key', asyncHandler(async (req, res) => {
  const objectif = await objectifDe(userOf(req));
  if (!objectif) return res.status(400).json({ error: 'Aucun objectif fixé.' });
  await query(
    'DELETE FROM discipline_progress WHERE user_id = $1 AND discipline = $2 AND item_key = $3',
    [userOf(req), objectif.discipline, String(req.params.key)],
  );
  return res.status(204).end();
}));
