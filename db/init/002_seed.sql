-- Utilisateur de démonstration. Le script d'ingestion et l'API
-- retombent sur cet utilisateur quand aucun n'est précisé.
INSERT INTO users (id, email, display_name, sex, birth_date, bodyweight_kg, height_cm)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@forgefit.local',
  'Athlète Démo',
  'male',
  '1995-06-15',
  78.0,
  180.0
)
ON CONFLICT (email) DO NOTHING;
