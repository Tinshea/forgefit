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

import { ALL_SECTIONS, MODULES, APP, moduleOf } from './modules.js';

/**
 * Les sections, à plat.
 *
 * Elles ne sont plus déclarées ici : elles appartiennent désormais aux
 * MODULES (`modules.js`). L'URL reste `#/section/page` et ne connaît
 * pas les modules — c'est ce qui permet d'en ajouter un sans casser un
 * seul lien existant.
 */
export const SECTIONS = ALL_SECTIONS;

// La coquille et ses modules transitent par le même point d'entrée que
// le reste de la navigation : App.jsx n'a pas à savoir dans quel
// fichier vit chaque donnée pure.
export { MODULES, APP, moduleOf };

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

/**
 * Le hub, au-dessus des modules.
 *
 * Il n'a ni section ni page : c'est justement ce qui le distingue. Une
 * route vaut donc SOIT `{ hub: true }`, SOIT `{ section, page }` — et
 * `isHub()` est le seul endroit qui en décide, pour qu'aucun appelant
 * n'ait à deviner la forme.
 */
export const HUB = { hub: true };
export const isHub = (route) => route?.hub === true;

/** Lit la route depuis le fragment d'URL (#/hub ou #/section/page). */
export function parseHash(hash) {
  const raw = hash ?? '';
  // `#/hub` est réservé : aucune section ne peut porter ce nom, sans
  // quoi elle deviendrait inatteignable. `keyCollisions()` le vérifie.
  if (/^#\/hub\/?$/.test(raw)) return HUB;

  const m = /^#\/([\w-]+)(?:\/([\w-]+))?/.exec(raw);
  if (!m) return null;
  const found = findRoute(m[1], m[2]);
  return found ? { section: found.section.key, page: found.page.key } : null;
}

export const toHash = (route) => (isHub(route)
  ? '#/hub'
  : `#/${route.section}/${route.page}`);

/** Toutes les routes valides, pour vérification et navigation clavier. */
export const allRoutes = () => SECTIONS.flatMap(
  (s) => s.pages.map((p) => ({ section: s.key, page: p.key })),
);
