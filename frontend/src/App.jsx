import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  SECTIONS, defaultRoute, findRoute, parseHash, toHash,
} from './lib/navigation.js';

// Écrans de saisie : chargés d'emblée. Ce sont eux le chemin critique —
// on ouvre l'app en salle pour enregistrer une série, pas pour lire un
// graphique.
import FieldLogger from './pages/FieldLogger.jsx';
import NutritionPage from './pages/NutritionPage.jsx';

/**
 * Écrans d'analyse : chargés à la demande.
 *
 * Recharts pèse à lui seul l'essentiel du bundle. L'embarquer dans le
 * chargement initial faisait payer 690 Ko à quelqu'un qui ouvre l'app
 * entre deux séries, sur le réseau d'une salle de sport, pour saisir un
 * développé couché.
 */
const ProgramPage = lazy(() => import('./pages/ProgramPage.jsx'));
const ExerciseLibrary = lazy(() => import('./pages/ExerciseLibrary.jsx'));
const FoodCatalogue = lazy(() => import('./pages/FoodCatalogue.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const TrendsPage = lazy(() => import('./pages/TrendsPage.jsx'));
const BenchmarkPage = lazy(() => import('./pages/BenchmarkPage.jsx'));
const HealthPage = lazy(() => import('./pages/HealthPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

/**
 * Câblage clé de page → composant.
 *
 * Séparé de `navigation.js`, qui reste des données pures : ce module-là
 * doit être analysable par Node pour que la structure de navigation
 * soit vérifiable hors navigateur.
 */
const PAGES = {
  seance: FieldLogger,
  programme: ProgramPage,
  exercices: ExerciseLibrary,
  journal: NutritionPage,
  aliments: FoodCatalogue,
  apercu: Dashboard,
  tendances: TrendsPage,
  benchmark: BenchmarkPage,
  sante: HealthPage,
  profil: ProfilePage,
};

/**
 * Ossature de navigation.
 *
 * Deux niveaux : une section (ce qu'on vient faire) puis une page. Dix
 * onglets au même rang obligeaient à lire toute la barre pour trouver
 * un bouton de saisie.
 *
 * La route vit dans le fragment d'URL : le bouton retour du navigateur
 * fonctionne, un rechargement ne ramène pas à l'accueil, et un écran
 * précis peut être mis en favori.
 */
export default function App() {
  const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

  const [route, setRoute] = useState(
    () => parseHash(window.location.hash) ?? defaultRoute(isDesktop()),
  );

  // Synchronisation avec l'historique du navigateur.
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash(window.location.hash);
      if (parsed) setRoute(parsed);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const target = toHash(route);
    if (window.location.hash !== target) window.location.hash = target;
  }, [route]);

  const go = useCallback((sectionKey, pageKey) => {
    const found = findRoute(sectionKey, pageKey);
    if (found) setRoute({ section: found.section.key, page: found.page.key });
    // Changer d'écran doit ramener en haut : conserver le défilement
    // d'une page d'analyse sur un écran de saisie n'a aucun sens.
    window.scrollTo({ top: 0 });
  }, []);

  const current = findRoute(route.section, route.page);
  if (!current) return null;
  const { section, page } = current;
  const Component = PAGES[page.key];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Forge<span>Fit</span>
        </div>

        {/* Sections — masquées sur mobile, où la barre basse prend le relais */}
        <nav className="sections-desktop" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className="tab"
              aria-current={section.key === s.key ? 'page' : undefined}
              aria-selected={section.key === s.key}
              onClick={() => go(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Pages de la section courante. Une section à page unique n'a pas
          besoin de sous-navigation. */}
      {section.pages.length > 1 && (
        <div className="subnav">
          <nav className="subnav-scroll" aria-label={`Pages — ${section.label}`}>
            {section.pages.map((p) => (
              <button
                key={p.key}
                type="button"
                className="subtab"
                aria-current={page.key === p.key ? 'page' : undefined}
                onClick={() => go(section.key, p.key)}
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="content">
        <p className="page-hint">{page.hint}</p>
        <Suspense fallback={<p className="empty">Chargement…</p>}>
          <Component />
        </Suspense>
      </main>

      {/* Barre basse sur mobile : atteignable au pouce, contrairement à
          une barre haute sur un grand téléphone. */}
      <nav className="bottombar" aria-label="Sections">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className="bottomtab"
            aria-current={section.key === s.key ? 'page' : undefined}
            onClick={() => go(s.key)}
          >
            <span className="bottomtab-icon" aria-hidden="true">{s.icon}</span>
            <span className="bottomtab-label">{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
