// Évolutions de schéma appliquées au démarrage de l'API.
//
// Les fichiers de `db/init` ne s'exécutent qu'au PREMIER boot d'un
// volume Postgres vide : une base déjà créée ne les reverrait jamais.
// Et l'image de l'API ne copie que `src/`, pas `db/` — elle ne peut donc
// pas rejouer ces fichiers depuis le disque.
//
// Les évolutions postérieures au schéma initial vivent ici, en JS, et
// sont rejouées à chaque démarrage. Chaque instruction est IDEMPOTENTE :
// la rejouer sur une base déjà à jour ne fait rien.
//
// Un verrou consultatif sérialise l'ensemble. Plusieurs instances d'API
// peuvent démarrer simultanément sans se marcher dessus sur du DDL —
// c'est la même exigence que le worker santé, qui suppose déjà
// plusieurs consommateurs.

import { pool } from '../db.js';
import { WEEKDAY_SPREAD } from '../services/scheduling.js';

/**
 * Table de répartition, rendue en `VALUES` SQL.
 *
 * Construite depuis la constante JS plutôt que recopiée : deux tables de
 * répartition finiraient par diverger, et le rattrapage placerait alors
 * les séances autrement que le générateur.
 */
const SPREAD_VALUES = Object.entries(WEEKDAY_SPREAD)
  .flatMap(([total, days]) => days.map((weekday, i) => `(${total},${i + 1},${weekday})`))
  .join(', ');

// Clé arbitraire mais stable : deux processus ForgeFit doivent tomber
// sur la même, et aucune autre application ne doit la partager.
const LOCK_KEY = 4071337;

const STATEMENTS = [
  // -------------------------------------------------------------------
  // Curation des exercices
  //
  // Le dataset ne hiérarchise rien : ses 1324 entrées sont sur le même
  // plan, du squat barre au « dumbbell biceps curl v sit on bosu ball ».
  // Sans palier, le catalogue est un annuaire, pas un outil de choix.
  // -------------------------------------------------------------------
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_tier') THEN
       CREATE TYPE evidence_tier AS ENUM ('fondamental', 'complement', 'accessoire');
     END IF;
   END $$`,

  `ALTER TABLE exercises
     ADD COLUMN IF NOT EXISTS evidence_tier    evidence_tier,
     ADD COLUMN IF NOT EXISTS movement_pattern TEXT,
     ADD COLUMN IF NOT EXISTS is_compound      BOOLEAN,
     ADD COLUMN IF NOT EXISTS evidence_note    TEXT,
     ADD COLUMN IF NOT EXISTS evidence_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
     ADD COLUMN IF NOT EXISTS pattern_rank     SMALLINT`,

  `CREATE INDEX IF NOT EXISTS idx_exercises_tier
     ON exercises (evidence_tier) WHERE evidence_tier IS NOT NULL`,

  // Le classement au sein d'un patron est la requête chaude : les
  // modèles de programme résolvent « meilleur mouvement de ce patron
  // compatible avec ce matériel » à chaque instanciation.
  `CREATE INDEX IF NOT EXISTS idx_exercises_pattern_rank
     ON exercises (movement_pattern, pattern_rank)
     WHERE movement_pattern IS NOT NULL`,

  // -------------------------------------------------------------------
  // Provenance d'un programme
  //
  // Trois programmes identiques en structure n'ont pas la même autorité
  // selon qu'ils sortent du radar, d'un modèle publié ou de la main de
  // l'utilisateur. L'interface doit pouvoir le dire.
  // -------------------------------------------------------------------
  `ALTER TABLE programs
     ADD COLUMN IF NOT EXISTS origin       TEXT NOT NULL DEFAULT 'generated',
     ADD COLUMN IF NOT EXISTS template_key TEXT,
     ADD COLUMN IF NOT EXISTS notes        TEXT,
     ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'programs_origin_check'
     ) THEN
       ALTER TABLE programs ADD CONSTRAINT programs_origin_check
         CHECK (origin IN ('generated', 'template', 'manual'));
     END IF;
   END $$`,

  // Un programme construit à la main commence vide : on ajoute les jours
  // un par un. `days_per_week` ne peut donc plus valoir au minimum 1
  // seulement à la création — mais 0 reste interdit, un programme sans
  // aucun jour prévu n'a pas de sens une fois enregistré.

  // -------------------------------------------------------------------
  // Édition manuelle des séances
  //
  // Le générateur remplit toujours `target_sets` et une dose. Un
  // utilisateur qui compose sa séance veut parfois saisir une fourchette
  // de répétitions ("8 à 12") plutôt qu'un chiffre unique, et une
  // consigne libre par ligne.
  // -------------------------------------------------------------------
  `ALTER TABLE program_items
     ADD COLUMN IF NOT EXISTS target_reps_max SMALLINT
       CHECK (target_reps_max IS NULL OR target_reps_max > 0)`,

  // -------------------------------------------------------------------
  // Planification hebdomadaire
  //
  // `day_index` dit l'ORDRE des séances, pas le JOUR où elles tombent.
  // Un programme à 4 jours ne se place pas lundi-mardi-mercredi-jeudi :
  // l'espacement fait partie du dosage, puisque c'est la récupération
  // qui limite. Il faut donc une colonne distincte.
  //
  // 1 = lundi … 7 = dimanche (ISO 8601, comme `EXTRACT(ISODOW)`).
  // NULL = séance non planifiée : elle existe dans le programme mais
  // n'apparaît pas au calendrier.
  // -------------------------------------------------------------------
  `ALTER TABLE program_days
     ADD COLUMN IF NOT EXISTS weekday SMALLINT
       CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7)`,

  // Deux séances du même programme le même jour de la semaine seraient
  // indiscernables au calendrier.
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_program_days_weekday
     ON program_days (program_id, weekday) WHERE weekday IS NOT NULL`,

  // Rattrapage : les programmes créés avant l'arrivée de `weekday`
  // n'ont aucune séance placée, donc n'apparaissent pas au calendrier.
  // On ne touche qu'aux programmes ENTIÈREMENT non planifiés : dès
  // qu'une seule séance est placée, le reste est un choix, pas un oubli.
  // Conséquence assumée : un programme dont on retirerait TOUS les jours
  // se verrait reproposer la répartition par défaut au redémarrage.
  `WITH spread(total, n, weekday) AS (VALUES ${SPREAD_VALUES}),
        numbered AS (
     SELECT d.id,
            ROW_NUMBER() OVER (PARTITION BY d.program_id ORDER BY d.day_index) AS n,
            COUNT(*)     OVER (PARTITION BY d.program_id)                      AS total
       FROM program_days d
      WHERE NOT EXISTS (
        SELECT 1 FROM program_days x
         WHERE x.program_id = d.program_id AND x.weekday IS NOT NULL
      )
   )
   UPDATE program_days d
      SET weekday = s.weekday
     FROM numbered n
     JOIN spread s ON s.total = n.total AND s.n = n.n
    WHERE d.id = n.id`,

  // Date de départ du cycle : sans elle, impossible de dire en quelle
  // semaine du programme on se trouve, ni quand il se termine.
  // `created_at` ne convient pas — réactiver un vieux programme le
  // ferait apparaître comme déjà terminé.
  //
  // Le départ est calé sur le LUNDI de la semaine en cours. Un programme
  // démarré un jeudi ferait sinon chevaucher ses semaines sur deux
  // semaines de calendrier : « semaine 2 du programme » tomberait au
  // milieu d'une ligne, et le volume hebdomadaire — l'unité de dosage —
  // ne se lirait plus d'une traite.
  `ALTER TABLE programs
     ADD COLUMN IF NOT EXISTS starts_on DATE NOT NULL
       DEFAULT date_trunc('week', CURRENT_DATE)::date`,

  // La valeur par défaut ne s'applique qu'aux nouvelles lignes : les
  // programmes déjà créés gardent leur date brute. On les recale.
  `UPDATE programs
      SET starts_on = date_trunc('week', starts_on)::date
    WHERE starts_on <> date_trunc('week', starts_on)::date`,

  // -------------------------------------------------------------------
  // Heure et durée des séances
  //
  // Un calendrier externe (Google, Apple, Outlook) ne sait pas afficher
  // « lundi » : il lui faut un début et une fin. Sans ces deux colonnes,
  // l'export ne pourrait produire que des évènements sur la journée
  // entière, ce qui noierait l'agenda.
  // -------------------------------------------------------------------
  `ALTER TABLE program_days
     ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '18:00',
     ADD COLUMN IF NOT EXISTS duration_minutes SMALLINT NOT NULL DEFAULT 60
       CHECK (duration_minutes BETWEEN 5 AND 360)`,

  // -------------------------------------------------------------------
  // Abonnement au calendrier
  //
  // Une application d'agenda s'abonne à une URL et la sonde toutes les
  // quelques heures : elle ne sait pas envoyer d'en-tête
  // d'authentification. Le secret doit donc tenir dans l'URL, d'où un
  // jeton dédié — jamais l'identifiant d'utilisateur, qui sert ailleurs.
  //
  // Il est révocable : régénérer le jeton invalide les abonnements
  // existants, ce qui est le seul moyen de couper un lien partagé par
  // erreur.
  // -------------------------------------------------------------------
  `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS calendar_token TEXT`,

  `UPDATE users SET calendar_token = encode(gen_random_bytes(24), 'hex')
    WHERE calendar_token IS NULL`,

  `CREATE UNIQUE INDEX IF NOT EXISTS uq_users_calendar_token
     ON users (calendar_token) WHERE calendar_token IS NOT NULL`,

  // -------------------------------------------------------------------
  // Recettes
  //
  // Le journal alimentaire sait compter ce qui a été mangé ; il ne sait
  // rien proposer. Une recette est une COMPOSITION d'aliments du
  // catalogue : ses macros ne sont donc jamais saisies, elles se
  // recalculent depuis ses ingrédients. Deux sources de vérité pour les
  // mêmes calories divergeraient à la première correction de fiche.
  // -------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS recipes (
     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     -- NULL = recette du catalogue commun, comme pour les aliments.
     user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
     slug          TEXT NOT NULL,
     name          TEXT NOT NULL,
     -- À quels repas la recette convient. Un tableau : des œufs
     -- brouillés se mangent au petit-déjeuner comme le soir.
     meals         meal_slot[] NOT NULL DEFAULT '{}',
     servings      SMALLINT NOT NULL DEFAULT 1 CHECK (servings > 0),
     prep_minutes  SMALLINT CHECK (prep_minutes >= 0),
     tags          TEXT[] NOT NULL DEFAULT '{}',
     steps         JSONB NOT NULL DEFAULT '[]'::jsonb,
     note          TEXT,
     source        TEXT NOT NULL DEFAULT 'catalogue',
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS uq_recipes_slug
     ON recipes (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug)`,

  `CREATE INDEX IF NOT EXISTS idx_recipes_meals ON recipes USING GIN (meals)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_tags  ON recipes USING GIN (tags)`,

  `CREATE TABLE IF NOT EXISTS recipe_ingredients (
     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
     -- RESTRICT et non SET NULL : une recette dont un ingrédient
     -- disparaîtrait afficherait des macros fausses sans le dire.
     food_id    UUID NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
     quantity   NUMERIC(8,2) NOT NULL CHECK (quantity > 0),
     position   SMALLINT NOT NULL DEFAULT 1,
     optional   BOOLEAN NOT NULL DEFAULT FALSE,
     UNIQUE (recipe_id, food_id)
   )`,

  `CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
     ON recipe_ingredients (recipe_id, position)`,

  // Vue : macros d'une recette, PAR PORTION. Calculée en base pour que
  // l'API, les suggestions et le journal comptent tous la même chose.
  `CREATE OR REPLACE VIEW recipe_macros AS
   SELECT r.id AS recipe_id,
          r.servings,
          COUNT(ri.id)::int AS ingredient_count,
          (SUM(f.kcal      * ri.quantity / f.reference_qty) / r.servings)::numeric(8,2) AS kcal,
          (SUM(f.protein_g * ri.quantity / f.reference_qty) / r.servings)::numeric(8,2) AS protein_g,
          (SUM(f.carbs_g   * ri.quantity / f.reference_qty) / r.servings)::numeric(8,2) AS carbs_g,
          (SUM(f.fat_g     * ri.quantity / f.reference_qty) / r.servings)::numeric(8,2) AS fat_g,
          (SUM(f.fiber_g   * ri.quantity / f.reference_qty) / r.servings)::numeric(8,2) AS fiber_g,
          (SUM(f.price_eur * ri.quantity / f.reference_qty) / r.servings)::numeric(8,3) AS price_eur
     FROM recipes r
     JOIN recipe_ingredients ri ON ri.recipe_id = r.id
     JOIN foods f               ON f.id = ri.food_id
    GROUP BY r.id`,

  // -------------------------------------------------------------------
  // Répartition entraînement / repos
  //
  // Manger davantage les jours de séance est commode. Ce réglage ne crée
  // AUCUNE énergie : ce qui est ajouté les jours d'entraînement est
  // retiré les jours de repos, à total hebdomadaire constant. Le
  // multiplicateur d'activité, lui, inclut déjà l'entraînement — ajouter
  // les calories d'une séance par-dessus les compterait deux fois.
  // -------------------------------------------------------------------
  `ALTER TABLE nutrition_profiles
     ADD COLUMN IF NOT EXISTS day_split_pct SMALLINT NOT NULL DEFAULT 0
       CHECK (day_split_pct BETWEEN 0 AND 30)`,

  // -------------------------------------------------------------------
  // Choix de la formule de métabolisme de base
  //
  // Les équations prédictives divergent de plus de 200 kcal sur un même
  // profil. Imposer la nôtre revenait à cacher cette incertitude ;
  // `bmr_method` la rend explicite et modifiable. NULL = choix
  // automatique, c'est-à-dire la formule la mieux informée disponible.
  //
  // `measured_bmr` court-circuite toute formule : calorimétrie, ou
  // dépense calibrée sur le journal et les pesées (tdee-calibration.js).
  // Une valeur mesurée n'a pas à être devinée.
  // -------------------------------------------------------------------
  `ALTER TABLE nutrition_profiles
     ADD COLUMN IF NOT EXISTS bmr_method TEXT
       CHECK (bmr_method IN ('katch-mcardle', 'cunningham', 'mifflin-st-jeor',
                             'harris-benedict', 'owen', 'mesure'))`,

  `ALTER TABLE nutrition_profiles
     ADD COLUMN IF NOT EXISTS measured_bmr NUMERIC(7,1)
       CHECK (measured_bmr > 500 AND measured_bmr < 5000)`,

  // -------------------------------------------------------------------
  // Une séance n'est plus forcément une séance de musculation
  //
  // L'application ne savait modéliser qu'un empilement de séries. Une
  // sortie vélo, un entraînement de judo ou une séance de bloc n'ont
  // aucune série — mais ce sont des séances, elles comptent dans le
  // calendrier, dans l'adhérence, dans la régularité et dans la charge.
  //
  // D'où le choix d'ÉTENDRE `workout_sessions` plutôt que de créer une
  // table parallèle : une table à part aurait forcé à dupliquer le
  // calendrier, la série, l'hydratation et l'export — et à les faire
  // diverger au premier oubli.
  //
  // `perceived_exertion` existait déjà : c'est le RPE de Foster, et
  // c'est lui qui rend comparables des disciplines qui n'ont aucune
  // unité commune.
  // -------------------------------------------------------------------
  `ALTER TABLE workout_sessions
     ADD COLUMN IF NOT EXISTS sport_key TEXT`,

  `ALTER TABLE workout_sessions
     ADD COLUMN IF NOT EXISTS distance_m NUMERIC(10,1)
       CHECK (distance_m IS NULL OR distance_m >= 0)`,

  // Le dénivelé peut être NÉGATIF : une descente de col n'est pas une
  // erreur de saisie, et une contrainte >= 0 la rejetterait.
  `ALTER TABLE workout_sessions
     ADD COLUMN IF NOT EXISTS elevation_m NUMERIC(7,1)`,

  `ALTER TABLE workout_sessions
     ADD COLUMN IF NOT EXISTS rounds SMALLINT
       CHECK (rounds IS NULL OR rounds BETWEEN 0 AND 200)`,

  `ALTER TABLE workout_sessions
     ADD COLUMN IF NOT EXISTS ascents SMALLINT
       CHECK (ascents IS NULL OR ascents BETWEEN 0 AND 500)`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_sport
     ON workout_sessions (user_id, sport_key, started_at DESC)`,

  // Les séances existantes sont de la musculation : elles ont des
  // séries. Les marquer explicitement évite qu'elles tombent hors du
  // bilan de charge par discipline, où elles apparaîtraient comme
  // « sport inconnu ».
  `UPDATE workout_sessions s
      SET sport_key = 'musculation'
    WHERE s.sport_key IS NULL
      AND EXISTS (SELECT 1 FROM workout_sets w WHERE w.session_id = s.id)`,

  // -------------------------------------------------------------------
  // Lanceur d'applications
  //
  // ForgeFit n'est qu'une pièce d'une suite personnelle à venir. Le
  // lanceur garde les liens vers les autres, et il est stocké EN BASE
  // plutôt que dans le navigateur : un lanceur qui ne suit pas d'un
  // appareil à l'autre ne sert à rien.
  //
  // `url` est libre : ce sont les applications de l'utilisateur, sur
  // son propre réseau. L'interface les ouvre dans un onglet neuf avec
  // `rel="noopener"` — voir le commentaire de PhoneMenu.jsx.
  // -------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS user_apps (
     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     label      TEXT NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 40),
     url        TEXT NOT NULL CHECK (length(url) BETWEEN 3 AND 500),
     glyph      TEXT NOT NULL DEFAULT 'app'
                CHECK (length(btrim(glyph)) BETWEEN 1 AND 24),
     position   SMALLINT NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE INDEX IF NOT EXISTS idx_user_apps_owner
     ON user_apps (user_id, position, created_at)`,

  // -------------------------------------------------------------------
  // Carte personnelle
  //
  // Les LIEUX du catalogue (maison, salle, dehors…) sont des TYPES :
  // ils disent ce qu'on peut y faire. Ceux-ci sont les lieux RÉELS de
  // l'utilisateur — sa salle, son bureau — posés sur une carte.
  //
  // Les coordonnées sont celles d'un plan STYLISÉ, pas de la Terre :
  // c'est un repère mental, pas une position GPS. Rien ici ne permet
  // de localiser qui que ce soit.
  // -------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS user_places (
     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     label      TEXT NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 32),
     kind       TEXT NOT NULL,
     x          NUMERIC(6,2) NOT NULL CHECK (x BETWEEN 0 AND 100),
     y          NUMERIC(6,2) NOT NULL CHECK (y BETWEEN 0 AND 100),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE INDEX IF NOT EXISTS idx_user_places_owner
     ON user_places (user_id, created_at)`,

  // -------------------------------------------------------------------
  // Module « Carnet » — banc d'essai de l'architecture modulaire
  //
  // Ce module n'a RIEN à voir avec l'entraînement, et c'est le but : il
  // vérifie qu'une fonctionnalité étrangère peut vivre dans la coquille
  // avec ses propres sections, sa propre table et sa propre route, sans
  // toucher à une ligne de ForgeFit.
  //
  // Il est volontairement minuscule, et se retire en supprimant cette
  // table, sa route et son entrée dans `modules.js`.
  // -------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS notes (
     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     body       TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
     pinned     BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE INDEX IF NOT EXISTS idx_notes_owner
     ON notes (user_id, pinned DESC, created_at DESC)`,

  // -------------------------------------------------------------------
  // La carte devient géographique
  //
  // Les lieux étaient posés sur un plan stylisé borné à 0–100. Avec des
  // tuiles réelles, il leur faut de vraies coordonnées. Les anciennes
  // colonnes deviennent facultatives plutôt que supprimées : une
  // migration qui jette des données est irréversible, et elles ne
  // coûtent rien.
  // -------------------------------------------------------------------
  `ALTER TABLE user_places
     ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6)
       CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90))`,

  `ALTER TABLE user_places
     ADD COLUMN IF NOT EXISTS lon NUMERIC(9,6)
       CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180))`,

  `ALTER TABLE user_places ALTER COLUMN x DROP NOT NULL`,
  `ALTER TABLE user_places ALTER COLUMN y DROP NOT NULL`,

  // Identité stable des aliments du catalogue commun.
  //
  // Le seed les supprimait puis les réinsérait à chaque exécution : les
  // identifiants changeaient, ce qui cassait les recettes qui les
  // référencent et, plus silencieusement, détachait les lignes du
  // journal alimentaire de leur fiche (`ON DELETE SET NULL`). Un nom
  // unique permet une mise à jour EN PLACE, qui préserve les deux.
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_foods_seed_name
     ON foods (name) WHERE user_id IS NULL AND source = 'seed'`,

  // Les positions se réordonnent par glisser-déposer : l'unicité
  // (day, position) doit pouvoir être violée le temps d'une transaction
  // de permutation, sinon toute réorganisation exige un ordre d'écriture
  // artificiel passant par des positions temporaires.
  `DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conname = 'program_items_program_day_id_position_key'
     ) THEN
       ALTER TABLE program_items
         DROP CONSTRAINT program_items_program_day_id_position_key;
       ALTER TABLE program_items
         ADD CONSTRAINT program_items_program_day_id_position_key
         UNIQUE (program_day_id, position) DEFERRABLE INITIALLY IMMEDIATE;
     END IF;
   END $$`,

  // -------------------------------------------------------------------
  // Authentification
  //
  // ┌─ CE QUE CES TROIS TABLES REMPLACENT ────────────────────────────┐
  // │ L'utilisateur était lu dans un en-tête `x-user-id`, sans        │
  // │ vérification. Cohérent sur un réseau privé ; intenable dès que  │
  // │ l'adresse devient publique, où n'importe qui lit et écrit les   │
  // │ mesures de n'importe qui.                                       │
  // └──────────────────────────────────────────────────────────────────┘
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ`,

  // Le jeton n'est JAMAIS stocké en clair : une fuite de cette table
  // livrerait sinon toutes les sessions ouvertes. On n'y garde que son
  // empreinte, et `ON DELETE CASCADE` fait qu'un compte supprimé ferme
  // ses sessions au lieu de les laisser flotter.
  `CREATE TABLE IF NOT EXISTS sessions (
     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash   TEXT NOT NULL UNIQUE,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at   TIMESTAMPTZ NOT NULL,
     user_agent   TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at)`,

  // La temporisation se compte PAR ADRESSE, pas par session : sinon il
  // suffirait de jeter son cookie entre deux essais pour repartir de
  // zéro. La ligne survit à l'échec et se remet à zéro au succès.
  // -------------------------------------------------------------------
  // Objectif de discipline, et progression dans son syllabus
  //
  // L'objectif vit sur `users` : il n'y en a qu'un actif à la fois, et
  // une table à une ligne serait une indirection pour rien. La
  // progression, elle, est une liste qui grandit — d'où sa table.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_discipline TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_grade INT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_sessions_per_week INT`,

  `CREATE TABLE IF NOT EXISTS discipline_progress (
     user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     discipline  TEXT NOT NULL,
     item_key    TEXT NOT NULL,
     acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, discipline, item_key)
   )`,

  `CREATE TABLE IF NOT EXISTS login_attempts (
     email        TEXT PRIMARY KEY,
     failures     INT NOT NULL DEFAULT 0,
     last_failure TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

/**
 * Applique les évolutions de schéma, une seule instance à la fois.
 *
 * Le verrou est pris sur une connexion dédiée et relâché dans le
 * `finally` : un échec de DDL ne doit pas laisser les autres instances
 * bloquées indéfiniment.
 */
export async function applySchemaUpdates() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    for (const sql of STATEMENTS) {
      await client.query(sql);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}
