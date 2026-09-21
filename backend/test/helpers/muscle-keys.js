// Muscles connus du mannequin anatomique.
//
// Dupliqué depuis `frontend/src/lib/anatomy.js` : le backend ne peut pas
// importer un module du front sans créer une dépendance croisée entre
// deux paquets npm séparés. Un test vérifie que la liste reste
// synchronisée — c'est moins coûteux qu'un paquet partagé pour vingt
// chaînes de caractères.
export const MUSCLE_KEYS = new Set([
  'abs', 'pectorals', 'biceps', 'triceps', 'delts', 'traps', 'lats',
  'upper back', 'forearms', 'glutes', 'quads', 'hamstrings', 'calves',
  'spine', 'lower back', 'adductors', 'abductors', 'serratus anterior',
  'levator scapulae', 'hip flexors', 'cardiovascular system',
]);
