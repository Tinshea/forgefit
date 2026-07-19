-- =====================================================================
-- Catalogue d'aliments : catégorie et visuel
--
-- La catégorie sert au filtrage et au choix d'un pictogramme. Les
-- produits scannés portent une vraie photo (Open Food Facts) ; les
-- aliments génériques du catalogue n'en ont pas — il n'existe pas de
-- base d'images libres couvrant « blanc de poulet » ou « riz complet
-- cuit » de façon fiable, et en fabriquer une serait un projet à part.
-- Le pictogramme de catégorie remplit ce rôle sans dépendance ni poids
-- réseau.
-- =====================================================================

CREATE TYPE food_category AS ENUM (
  'feculents',
  'proteines',
  'laitiers',
  'legumes',
  'fruits',
  'matieres_grasses',
  'complements',
  'condiments',
  'plats',
  'plaisirs',
  'boissons',
  'autre'
);

ALTER TABLE foods
  ADD COLUMN category  food_category NOT NULL DEFAULT 'autre',
  ADD COLUMN image_url TEXT;

CREATE INDEX idx_foods_category ON foods (category);

-- Rapatrie l'image des produits déjà importés d'Open Food Facts :
-- elle était stockée dans `meta`, elle mérite sa colonne.
UPDATE foods
   SET image_url = meta ->> 'image_url'
 WHERE meta ? 'image_url' AND image_url IS NULL;
