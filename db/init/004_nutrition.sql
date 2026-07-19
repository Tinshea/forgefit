-- =====================================================================
-- Nutrition
--
-- Modèle repris du tableur de l'utilisateur, dont les formules ont été
-- vérifiées et conservées (cf. services/nutrition.js) : dépense calculée
-- sur la MASSE MAIGRE (Katch-McArdle), macros en g/kg de masse maigre.
--
-- Particularité utile et rare : le PRIX est suivi par aliment. Un plan
-- alimentaire qu'on ne peut pas se payer n'est pas un plan.
-- =====================================================================

CREATE TYPE meal_slot AS ENUM ('matin', 'midi', 'soir', 'collation');
CREATE TYPE nutrition_goal AS ENUM ('perte', 'maintien', 'prise');
CREATE TYPE activity_level AS ENUM ('sedentaire', 'leger', 'modere', 'intense');

-- ---------------------------------------------------------------------
-- Catalogue d'aliments
-- ---------------------------------------------------------------------

CREATE TABLE foods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = aliment du catalogue commun, visible par tous.
  -- Renseigné = aliment personnel (produit scanné, recette maison).
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  brand          TEXT,
  barcode        TEXT,
  source         TEXT NOT NULL DEFAULT 'manual',  -- seed | manual | openfoodfacts

  -- Toutes les valeurs se rapportent à cette quantité. 100 g dans la
  -- quasi-totalité des cas, mais certains aliments se comptent à la
  -- pièce (un œuf, un scoop de whey) : figer 100 g obligerait à des
  -- conversions mentales à chaque saisie.
  reference_qty  NUMERIC(8,2) NOT NULL DEFAULT 100 CHECK (reference_qty > 0),
  unit           TEXT NOT NULL DEFAULT 'g',

  kcal           NUMERIC(8,2) NOT NULL CHECK (kcal >= 0),
  fat_g          NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  carbs_g        NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  protein_g      NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  fiber_g        NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  price_eur      NUMERIC(8,3) CHECK (price_eur >= 0),

  nutriscore     TEXT,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un code-barres ne peut être enregistré qu'une fois par utilisateur
-- (et une fois dans le catalogue commun).
CREATE UNIQUE INDEX uq_foods_barcode_user
  ON foods (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX idx_foods_user ON foods (user_id);
CREATE INDEX idx_foods_name_trgm ON foods USING GIN (name gin_trgm_ops);
CREATE INDEX idx_foods_search
  ON foods USING GIN (to_tsvector('french', immutable_unaccent(name)));

-- ---------------------------------------------------------------------
-- Journal alimentaire
-- ---------------------------------------------------------------------

CREATE TABLE food_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumed_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  meal         meal_slot NOT NULL,
  -- L'aliment peut disparaître du catalogue sans effacer l'historique.
  food_id      UUID REFERENCES foods(id) ON DELETE SET NULL,
  food_name    TEXT NOT NULL,
  quantity     NUMERIC(8,2) NOT NULL CHECK (quantity > 0),
  unit         TEXT NOT NULL DEFAULT 'g',

  -- Valeurs FIGÉES au moment de la saisie. Corriger la fiche d'un
  -- aliment ne doit pas réécrire ce qui a déjà été mangé : le journal
  -- est un fait historique, pas une vue calculée.
  kcal         NUMERIC(9,2) NOT NULL CHECK (kcal >= 0),
  fat_g        NUMERIC(8,2) NOT NULL DEFAULT 0,
  carbs_g      NUMERIC(8,2) NOT NULL DEFAULT 0,
  protein_g    NUMERIC(8,2) NOT NULL DEFAULT 0,
  fiber_g      NUMERIC(8,2) NOT NULL DEFAULT 0,
  price_eur    NUMERIC(8,3),

  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_food_entries_day ON food_entries (user_id, consumed_on DESC, meal);

-- ---------------------------------------------------------------------
-- Profil nutritionnel
-- ---------------------------------------------------------------------

CREATE TABLE nutrition_profiles (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal           nutrition_goal  NOT NULL DEFAULT 'maintien',
  activity       activity_level  NOT NULL DEFAULT 'leger',

  -- Masse maigre : base de TOUS les calculs. Katch-McArdle l'utilise
  -- pour le métabolisme de base, et les cibles de macros sont en g/kg
  -- de masse maigre — pas de poids total, qui surestimerait les besoins
  -- d'une personne avec beaucoup de masse grasse.
  lean_mass_kg   NUMERIC(5,2) CHECK (lean_mass_kg > 0 AND lean_mass_kg < 200),
  body_fat_pct   NUMERIC(4,1) CHECK (body_fat_pct >= 0 AND body_fat_pct < 70),

  -- Objectifs saisis à la main, qui priment sur le calcul quand ils
  -- sont renseignés.
  kcal_override      NUMERIC(7,1) CHECK (kcal_override > 0),
  protein_override_g NUMERIC(6,1) CHECK (protein_override_g >= 0),
  fat_override_g     NUMERIC(6,1) CHECK (fat_override_g >= 0),
  fiber_target_g     NUMERIC(5,1) NOT NULL DEFAULT 30,

  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Vue : totaux journaliers
--
-- Le tableur recalculait ces sommes à chaque cellule. En base, une vue
-- garantit que l'API, les graphiques et les exports comptent tous la
-- même chose.
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW nutrition_daily AS
SELECT
  user_id,
  consumed_on,
  SUM(kcal)::numeric(9,2)      AS kcal,
  SUM(fat_g)::numeric(8,2)     AS fat_g,
  SUM(carbs_g)::numeric(8,2)   AS carbs_g,
  SUM(protein_g)::numeric(8,2) AS protein_g,
  SUM(fiber_g)::numeric(8,2)   AS fiber_g,
  SUM(price_eur)::numeric(8,2) AS price_eur,
  COUNT(*)::int                AS entries
FROM food_entries
GROUP BY user_id, consumed_on;

-- Totaux par repas, pour le tableau récapitulatif du journal.
CREATE OR REPLACE VIEW nutrition_daily_by_meal AS
SELECT
  user_id,
  consumed_on,
  meal,
  SUM(kcal)::numeric(9,2)      AS kcal,
  SUM(fat_g)::numeric(8,2)     AS fat_g,
  SUM(carbs_g)::numeric(8,2)   AS carbs_g,
  SUM(protein_g)::numeric(8,2) AS protein_g,
  SUM(fiber_g)::numeric(8,2)   AS fiber_g,
  SUM(price_eur)::numeric(8,2) AS price_eur,
  COUNT(*)::int                AS entries
FROM food_entries
GROUP BY user_id, consumed_on, meal;

-- Profil par défaut pour l'utilisateur de démonstration.
INSERT INTO nutrition_profiles (user_id, goal, activity, lean_mass_kg)
VALUES ('00000000-0000-0000-0000-000000000001', 'perte', 'leger', 63.5)
ON CONFLICT (user_id) DO NOTHING;
