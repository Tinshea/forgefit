-- =====================================================================
-- ForgeFit — schéma de base
-- Objectif: modèle rigide pour l'entraînement (structuré, relationnel)
--           + modèle dynamique JSONB pour la santé (schema-on-read).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- recherche floue sur noms FR
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- "développé" ~ "developpe"

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------

-- Discipline dérivée à l'ingestion (le dataset ne la fournit pas).
--
-- Mobilité et souplesse sont deux qualités distinctes, pas deux mots
-- pour la même chose :
--   mobilité  = amplitude ACTIVE, sous contrôle musculaire (cercles
--               articulaires, rotations, auto-massage, travail dynamique)
--   souplesse = amplitude PASSIVE, étirement tenu sans production de
--               force (allongement du tissu)
-- On peut être très souple et peu mobile. Les confondre masquerait
-- exactement le déséquilibre qu'on cherche à révéler.
CREATE TYPE discipline AS ENUM (
  'musculation',   -- charges externes: barre, haltères, poulie, machine
  'callisthenie',  -- poids de corps, assisté, lesté
  'mobilite',      -- amplitude active, dynamique, auto-massage
  'souplesse',     -- étirement statique tenu
  'cardio'
);

CREATE TYPE sex AS ENUM ('male', 'female', 'unspecified');

-- 'processing' : l'evenement a ete reserve par un worker. Indispensable
-- pour que plusieurs instances de l'API puissent consommer la meme file
-- sans traiter deux fois le meme evenement.
CREATE TYPE webhook_status AS ENUM (
  'pending', 'processing', 'processed', 'failed', 'skipped'
);

-- ---------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  display_name   TEXT NOT NULL,
  sex            sex  NOT NULL DEFAULT 'unspecified',
  birth_date     DATE,
  -- Poids de corps: indispensable au calcul des ratios de force.
  bodyweight_kg  NUMERIC(5,2) CHECK (bodyweight_kg > 0 AND bodyweight_kg < 500),
  height_cm      NUMERIC(5,2) CHECK (height_cm > 0 AND height_cm < 300),
  locale         TEXT NOT NULL DEFAULT 'fr',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Catalogue d'exercices (issu du dataset, enrichi FR)
-- ---------------------------------------------------------------------

CREATE TABLE exercises (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id        TEXT UNIQUE NOT NULL,          -- "0001" du dataset
  slug               TEXT UNIQUE NOT NULL,
  name_en            TEXT NOT NULL,
  name_fr            TEXT NOT NULL,                 -- traduit à l'ingestion
  discipline         discipline NOT NULL,
  category           TEXT NOT NULL,                 -- région anatomique brute
  body_part          TEXT,
  equipment          TEXT,
  target             TEXT,                          -- muscle primaire
  muscle_group       TEXT,
  secondary_muscles  TEXT[] NOT NULL DEFAULT '{}',
  -- Axe athlétique dominant: push / pull / legs / core / endurance /
  -- mobility / explosive. Alimente le radar à 6 axes.
  axis               TEXT,
  -- Médias: URLs absolues, jamais téléchargées (cf. ingest.js).
  image_url          TEXT,
  gif_url            TEXT,
  media_id           TEXT,
  attribution        TEXT,
  -- Instructions multilingues conservées telles quelles: le dataset
  -- fournit 10 langues, on n'en fige aucune en colonne.
  instructions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  instruction_steps  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recherche plein-texte française, insensible aux accents.
-- unaccent() n'est pas IMMUTABLE par défaut => wrapper immutable requis
-- pour l'utiliser dans un index d'expression / colonne générée.
CREATE OR REPLACE FUNCTION immutable_unaccent(TEXT)
RETURNS TEXT AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

ALTER TABLE exercises
  ADD COLUMN search_fr tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french',
      immutable_unaccent(coalesce(name_fr, '')) || ' ' ||
      immutable_unaccent(coalesce(name_en, '')) || ' ' ||
      coalesce(target, '')   || ' ' ||
      coalesce(equipment, '')
    )
  ) STORED;

CREATE INDEX idx_exercises_search_fr  ON exercises USING GIN (search_fr);
CREATE INDEX idx_exercises_name_fr_trgm ON exercises USING GIN (name_fr gin_trgm_ops);
CREATE INDEX idx_exercises_discipline ON exercises (discipline);
CREATE INDEX idx_exercises_target     ON exercises (target);
CREATE INDEX idx_exercises_axis       ON exercises (axis);
CREATE INDEX idx_exercises_equipment  ON exercises (equipment);

-- ---------------------------------------------------------------------
-- Journal d'entraînement (relationnel, fortement typé)
-- ---------------------------------------------------------------------

CREATE TABLE workout_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  title              TEXT,
  notes              TEXT,
  perceived_exertion SMALLINT CHECK (perceived_exertion BETWEEN 1 AND 10),
  source             TEXT NOT NULL DEFAULT 'app',   -- app | watch | import
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT session_time_order CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_sessions_user_time ON workout_sessions (user_id, started_at DESC);

CREATE TABLE workout_sets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id   UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  set_index     SMALLINT NOT NULL DEFAULT 1,
  -- Toutes les métriques sont nullables: une série de gainage n'a ni
  -- charge ni répétitions, un sprint n'a que distance + durée.
  weight_kg     NUMERIC(6,2) CHECK (weight_kg >= 0),
  reps          SMALLINT     CHECK (reps >= 0),
  rpe           NUMERIC(3,1) CHECK (rpe BETWEEN 1 AND 10),
  duration_s    INTEGER      CHECK (duration_s >= 0),
  distance_m    NUMERIC(9,2) CHECK (distance_m >= 0),
  tempo         TEXT,
  is_warmup     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Volume de charge, calculé en base pour éviter toute divergence
  -- entre le backend et les requêtes analytiques.
  volume_kg     NUMERIC(12,2)
    GENERATED ALWAYS AS (COALESCE(weight_kg, 0) * COALESCE(reps, 0)) STORED,
  UNIQUE (session_id, exercise_id, set_index)
);

CREATE INDEX idx_sets_session   ON workout_sets (session_id);
CREATE INDEX idx_sets_exercise  ON workout_sets (exercise_id);
CREATE INDEX idx_sets_completed ON workout_sets (completed_at DESC);

-- ---------------------------------------------------------------------
-- Santé ++ : modèle dynamique JSONB
--
-- Aucune colonne par type de métrique. Sommeil, hydratation, VFC, poids,
-- SpO2, glycémie... entrent tous ici. `value` porte la charge utile
-- native de la source; `magnitude` en extrait un scalaire indexable
-- pour les agrégations rapides.
-- ---------------------------------------------------------------------

CREATE TABLE health_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Clé libre: 'sleep', 'hydration', 'hrv', 'calories', 'weight'...
  -- Volontairement TEXT et non ENUM: une nouvelle source ne doit jamais
  -- exiger une migration de schéma.
  metric_type   TEXT NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual',  -- apple_health | withings | iot | manual
  -- Identifiant natif chez la source: garantit l'idempotence des rejeux
  -- de webhooks (une montre qui resynchronise 7 jours d'historique).
  external_id   TEXT,
  unit          TEXT,
  value         JSONB NOT NULL,
  -- Scalaire extrait de `value` quand il existe: permet AVG/SUM sans
  -- désérialiser le JSON. STORED => indexable.
  magnitude     NUMERIC
    GENERATED ALWAYS AS (
      CASE jsonb_typeof(value)
        WHEN 'number' THEN (value #>> '{}')::NUMERIC
        WHEN 'object' THEN
          CASE
            WHEN jsonb_typeof(value -> 'value') = 'number'
              THEN (value #>> '{value}')::NUMERIC
            WHEN jsonb_typeof(value -> 'amount') = 'number'
              THEN (value #>> '{amount}')::NUMERIC
            WHEN jsonb_typeof(value -> 'qty') = 'number'
              THEN (value #>> '{qty}')::NUMERIC
            ELSE NULL
          END
        ELSE NULL
      END
    ) STORED,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotence: un même événement source ne peut entrer deux fois.
-- Index partiel car external_id est NULL pour les saisies manuelles
-- (qui, elles, doivent pouvoir se répéter: 3 verres d'eau à 10h).
CREATE UNIQUE INDEX uq_health_source_external
  ON health_metrics (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX idx_health_user_type_time
  ON health_metrics (user_id, metric_type, recorded_at DESC);

CREATE INDEX idx_health_value_gin
  ON health_metrics USING GIN (value jsonb_path_ops);

-- Pas d'index sur (recorded_at::date) : le cast timestamptz -> date
-- dépend du paramètre TimeZone de la session, il est donc STABLE et non
-- IMMUTABLE — Postgres refuse de l'indexer.
--
-- Les agrégations journalières (jauge d'hydratation, sommeil de la nuit)
-- interrogent donc un INTERVALLE mi-ouvert sur recorded_at :
--   recorded_at >= date_trunc('day', now())
--   AND recorded_at <  date_trunc('day', now()) + INTERVAL '1 day'
-- Cette forme est sargable et exploite idx_health_user_type_time
-- ci-dessus, ce qu'un prédicat sur recorded_at::date ne ferait pas.

-- ---------------------------------------------------------------------
-- Webhooks: journal brut, traité de façon asynchrone
--
-- L'endpoint accuse réception (202) puis rend la main. Un worker
-- normalise ensuite le payload vers health_metrics. Le brut est
-- conservé: si un adaptateur est corrigé, on peut rejouer.
-- ---------------------------------------------------------------------

CREATE TABLE webhook_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source        TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  payload       JSONB NOT NULL,
  headers       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        webhook_status NOT NULL DEFAULT 'pending',
  attempts      SMALLINT NOT NULL DEFAULT 0,
  metrics_count INTEGER,
  error         TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX idx_webhook_pending
  ON webhook_events (received_at)
  WHERE status = 'pending';

-- Notifie le worker qu'un événement est en attente (LISTEN/NOTIFY).
CREATE OR REPLACE FUNCTION notify_webhook_event() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('health_event', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_webhook_event
  AFTER INSERT ON webhook_events
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_webhook_event();

-- ---------------------------------------------------------------------
-- Vue: fatigue par groupe musculaire (alimente la heatmap SVG)
--
-- Décroissance exponentielle du volume récent, demi-vie 48 h.
-- Le muscle primaire compte plein pot, les secondaires à 40 %.
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW muscle_load_recent AS
WITH contributions AS (
  -- Muscle primaire
  SELECT
    s.user_id,
    e.target AS muscle,
    ws.volume_kg * 1.0 AS weighted_volume,
    ws.completed_at
  FROM workout_sets ws
  JOIN workout_sessions s ON s.id = ws.session_id
  JOIN exercises e        ON e.id = ws.exercise_id
  WHERE ws.is_warmup = FALSE
    AND e.target IS NOT NULL
    AND ws.completed_at > now() - INTERVAL '14 days'

  UNION ALL

  -- Muscles secondaires, pondérés
  SELECT
    s.user_id,
    sm AS muscle,
    ws.volume_kg * 0.4 AS weighted_volume,
    ws.completed_at
  FROM workout_sets ws
  JOIN workout_sessions s ON s.id = ws.session_id
  JOIN exercises e        ON e.id = ws.exercise_id
  CROSS JOIN LATERAL unnest(e.secondary_muscles) AS sm
  WHERE ws.is_warmup = FALSE
    AND ws.completed_at > now() - INTERVAL '14 days'
)
SELECT
  user_id,
  muscle,
  SUM(weighted_volume) AS volume_14d,
  -- exp(-ln2 * h / 48) : demi-vie de 48 heures
  SUM(
    weighted_volume *
    exp(-0.6931471805599453 * EXTRACT(EPOCH FROM (now() - completed_at)) / 3600.0 / 48.0)
  ) AS fatigue_raw,
  COUNT(*)          AS set_count,
  MAX(completed_at) AS last_trained_at
FROM contributions
GROUP BY user_id, muscle;
