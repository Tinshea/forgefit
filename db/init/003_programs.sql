-- =====================================================================
-- Programmes d'entraînement
--
-- Un programme est une STRUCTURE (quels jours, quels mouvements, quel
-- volume), pas un journal. Il est généré à partir des points faibles
-- mesurés sur le radar, puis exécuté : chaque séance réelle reste dans
-- workout_sessions et référence le jour de programme dont elle provient.
-- =====================================================================

CREATE TABLE programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  goal         TEXT NOT NULL DEFAULT 'equilibre',  -- equilibre | force | hypertrophie | mobilite
  days_per_week SMALLINT NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  weeks        SMALLINT NOT NULL DEFAULT 4 CHECK (weeks BETWEEN 1 AND 52),
  -- Instantané des scores ayant motivé la génération : sans lui, on ne
  -- saurait plus six semaines plus tard POURQUOI ce programme.
  rationale    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programs_user ON programs (user_id, created_at DESC);

-- Un seul programme actif par utilisateur.
CREATE UNIQUE INDEX uq_programs_active
  ON programs (user_id) WHERE is_active;

CREATE TABLE program_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_index   SMALLINT NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  title       TEXT NOT NULL,
  focus       TEXT,   -- axe dominant : push | pull | legs | mobility...
  UNIQUE (program_id, day_index)
);

CREATE TABLE program_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_id    UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  position       SMALLINT NOT NULL,
  target_sets    SMALLINT NOT NULL CHECK (target_sets > 0),
  target_reps    SMALLINT CHECK (target_reps > 0),
  target_seconds INTEGER  CHECK (target_seconds > 0),
  -- Charge conseillée, calculée depuis le 1RM estimé au moment de la
  -- génération. NULL pour le poids de corps et les étirements.
  suggested_kg   NUMERIC(6,2) CHECK (suggested_kg >= 0),
  rest_seconds   SMALLINT,
  note           TEXT,
  -- Axe visé et règle d'allocation appliquée. Sans eux, l'utilisateur
  -- subit une liste d'exercices sans savoir pourquoi ceux-là.
  axis           TEXT,
  rationale      JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (program_day_id, position),
  -- Une consigne doit porter au moins des répétitions ou une durée.
  CONSTRAINT item_has_dose CHECK (target_reps IS NOT NULL OR target_seconds IS NOT NULL)
);

CREATE INDEX idx_program_items_day ON program_items (program_day_id, position);

-- Rattache une séance réelle au jour de programme qu'elle exécute.
ALTER TABLE workout_sessions
  ADD COLUMN program_day_id UUID REFERENCES program_days(id) ON DELETE SET NULL;
