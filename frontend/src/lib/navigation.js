// Structure de navigation — DONNÉES PURES.
//
// Aucun import de composant ici : ce module doit rester analysable par
// Node pour être vérifiable hors navigateur (`npm run check:nav`). Le
// câblage clé → composant se fait dans App.jsx.
//
// Le regroupement suit ce que l'utilisateur VIENT FAIRE, pas la
// structure technique des pages :
//
//   Entraînement → agir sur la séance
//   Nutrition    → agir sur les repas
//   Progression  → prendre du recul, lire
//   Profil       → régler
//
// Les deux premières sections sont des outils de terrain, la troisième
// une salle de contrôle. Dix onglets au même rang obligeaient à lire
// toute la barre pour trouver un bouton de saisie.

import { ALL_SECTIONS, MODULES, moduleOf } from './modules.js';

/**
 * Les sections, à plat.
 *
 * Elles ne sont plus déclarées ici : elles appartiennent désormais aux
 * MODULES (`modules.js`). L'URL reste `#/section/page` et ne connaît
 * pas les modules — c'est ce qui permet d'en ajouter un sans casser un
 * seul lien existant.
 */
export const SECTIONS = ALL_SECTIONS;

export { MODULES, moduleOf };

/**
 * Route par défaut selon le contexte d'usage.
 * Sur téléphone on vient saisir, sur grand écran on vient lire.
 */
export const defaultRoute = (isDesktop) => (isDesktop
  ? { section: 'progression', page: 'apercu' }
  : { section: 'entrainement', page: 'seance' });

/** Résout une route, en retombant sur la première page de la section. */
export function findRoute(sectionKey, pageKey) {
  const section = SECTIONS.find((s) => s.key === sectionKey);
  if (!section) return null;
  const page = section.pages.find((p) => p.key === pageKey) ?? section.pages[0];
  return { section, page };
}

/** Lit la route depuis le fragment d'URL (#/section/page). */
export function parseHash(hash) {
  const m = /^#\/([\w-]+)(?:\/([\w-]+))?/.exec(hash ?? '');
  if (!m) return null;
  const found = findRoute(m[1], m[2]);
  return found ? { section: found.section.key, page: found.page.key } : null;
}

export const toHash = ({ section, page }) => `#/${section}/${page}`;

/** Toutes les routes valides, pour vérification et navigation clavier. */
export const allRoutes = () => SECTIONS.flatMap(
  (s) => s.pages.map((p) => ({ section: s.key, page: p.key })),
);
