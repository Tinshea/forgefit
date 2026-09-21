import {
  Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import {
  SECTIONS, MODULES, moduleOf, defaultRoute, findRoute, parseHash, toHash,
} from './lib/navigation.js';

// Écrans de saisie : chargés d'emblée. Ce sont eux le chemin critique —
// on ouvre l'app en salle pour enregistrer une série, pas pour lire un
// graphique.
import FieldLogger from './pages/FieldLogger.jsx';
import NutritionPage from './pages/NutritionPage.jsx';
import RouteFx from './components/RouteFx.jsx';
import ClickBurst from './components/ClickBurst.jsx';
import DateHud from './components/DateHud.jsx';
import Glyph from './components/Glyph.jsx';
import WeatherHud from './components/WeatherHud.jsx';
import { isMuted, setMuted, playLater } from './lib/sound-lazy.js';
import { daypartOf, setDaypart } from './lib/ambience.js';

/**
 * Écrans d'analyse : chargés à la demande.
 *
 * Recharts pèse à lui seul l'essentiel du bundle. L'embarquer dans le
 * chargement initial faisait payer 690 Ko à quelqu'un qui ouvre l'app
 * entre deux séries, sur le réseau d'une salle de sport, pour saisir un
 * développé couché.
 */
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const ProgramPage = lazy(() => import('./pages/ProgramPage.jsx'));
const ExerciseLibrary = lazy(() => import('./pages/ExerciseLibrary.jsx'));
const FoodCatalogue = lazy(() => import('./pages/FoodCatalogue.jsx'));
const SportsPage = lazy(() => import('./pages/SportsPage.jsx'));
const LevelPage = lazy(() => import('./pages/LevelPage.jsx'));
const NotesPage = lazy(() => import('./pages/NotesPage.jsx'));

/**
 * Le téléphone, chargé à la demande.
 *
 * ┌─ POURQUOI IL N'EST PAS DANS LE LOT INITIAL ───────────────────────┐
 * │ Il entraîne avec lui la carte, la projection de Mercator et le    │
 * │ registre des lieux — soit une part notable du chemin critique,    │
 * │ pour une surface qu'on n'ouvre pas à chaque session.              │
 * │                                                                    │
 * │ Son BOUTON, lui, reste dans le lot initial : il doit être là dès  │
 * │ le premier rendu, sinon il apparaîtrait après coup sous le doigt. │
 * └────────────────────────────────────────────────────────────────────┘
 */
const PhoneMenu = lazy(() => import('./components/PhoneMenu.jsx'));
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
  calendrier: CalendarPage,
  programme: ProgramPage,
  exercices: ExerciseLibrary,
  journal: NutritionPage,
  aliments: FoodCatalogue,
  sports: SportsPage,
  niveau: LevelPage,
  notes: NotesPage,
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
/**
 * Sous-navigation à curseur mobile.
 *
 * ┌─ POURQUOI MESURER PLUTÔT QUE COLORER ─────────────────────────────┐
 * │ Un fond appliqué à l'onglet actif APPARAÎT à un endroit et       │
 * │ DISPARAÎT à un autre : aucun mouvement ne relie les deux, et le  │
 * │ changement se lit comme un saut.                                  │
 * │                                                                    │
 * │ Un bloc unique, positionné par mesure, VOYAGE d'un onglet à       │
 * │ l'autre. L'œil suit le déplacement, ce qui dit d'où l'on vient.   │
 * │ C'est le geste des menus Atlus, et il n'est pas seulement joli :  │
 * │ il rend la navigation lisible.                                    │
 * │                                                                    │
 * │ `useLayoutEffect` et non `useEffect` : la mesure doit être faite  │
 * │ AVANT la peinture, sinon le curseur apparaît d'abord à sa         │
 * │ position précédente et corrige après coup — un sursaut visible.   │
 * └────────────────────────────────────────────────────────────────────┘
 */
/**
 * Coupure du son.
 *
 * Visible en permanence : un son qu'on ne sait pas couper est une
 * nuisance. Le réglage survit au rechargement.
 */
function SoundToggle() {
  const [on, setOn] = useState(() => !isMuted());

  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={on}
      aria-label={on ? 'Couper les sons' : 'Activer les sons'}
      onClick={() => {
        const next = !on;
        setOn(next);

        // ┌─ L'ORDRE COMPTE, DANS LES DEUX SENS ────────────────────┐
        // │ À L'ALLUMAGE : le réglage doit être écrit AVANT de       │
        // │ jouer, sinon `play` lit encore « coupé » dans le         │
        // │ stockage et sort sans rien émettre — on allumerait le    │
        // │ son sans l'entendre.                                     │
        // │                                                          │
        // │ À L'EXTINCTION : le son d'adieu doit être joué AVANT     │
        // │ d'écrire la coupure, sinon éteindre serait muet, donc    │
        // │ sans confirmation.                                       │
        // └──────────────────────────────────────────────────────────┘
        if (next) {
          setMuted(false);
          playLater('toggleOn');
        } else {
          playLater('toggleOff');
          setTimeout(() => setMuted(true), 250);
        }
      }}
    >
      <span aria-hidden="true">{on ? '♪' : '✕'}</span>
      Son
    </button>
  );
}

function SubNav({ section, activeKey, onPick }) {
  const scrollRef = useRef(null);
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const root = scrollRef.current;
      const active = root?.querySelector('[aria-current="page"]');
      if (!root || !active) { setBox(null); return; }
      setBox({
        // Décalage dans le CONTENU défilable, pas à l'écran : la barre
        // défile horizontalement, et une position à l'écran dériverait
        // dès le premier défilement.
        left: active.offsetLeft,
        width: active.offsetWidth,
      });
    };

    measure();
    // Les polices système arrivent parfois après le premier rendu : une
    // mesure unique laisserait le curseur mal calé.
    const ro = new ResizeObserver(measure);
    if (scrollRef.current) ro.observe(scrollRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [activeKey, section.key]);

  return (
    <nav className="subnav-scroll" ref={scrollRef} aria-label={`Pages — ${section.label}`}>
      {box && (
        <span
          className="subnav-cursor"
          aria-hidden="true"
          style={{ transform: `translateX(${box.left}px)`, width: box.width }}
        />
      )}
      {section.pages.map((p) => (
        <button
          key={p.key}
          type="button"
          className="subtab"
          aria-current={activeKey === p.key ? 'page' : undefined}
          onClick={() => onPick(section.key, p.key)}
          title={p.hint}
        >
          {p.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Mesure la barre du haut et la publie en variable CSS.
 *
 * La sous-navigation est collante et doit se caler JUSTE sous elle. Sa
 * hauteur varie pourtant de 62 à 81 px selon la largeur — la marque,
 * le bandeau de date, les onglets et le bouton de son ne prennent pas
 * la même place partout. Une valeur figée laissait un trou ici et un
 * recouvrement là.
 */
function useTopbarHeight(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = () => {
      document.documentElement.style.setProperty(
        '--topbar-h', `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

export default function App() {
  const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

  const topbarRef = useRef(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
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
    if (found) {
      setRoute({ section: found.section.key, page: found.page.key });
      playLater('swipe');
    }
    // Changer d'écran doit ramener en haut : conserver le défilement
    // d'une page d'analyse sur un écran de saisie n'a aucun sens.
    window.scrollTo({ top: 0 });
  }, []);

  useTopbarHeight(topbarRef);

  // Onglet caché : on marque la racine pour que la feuille de style
  // suspende les boucles de fond. Rien à animer si personne ne regarde.
  useEffect(() => {
    const apply = () => {
      if (document.hidden) document.documentElement.setAttribute('data-hidden', '');
      else document.documentElement.removeAttribute('data-hidden');
    };
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, []);

  // Phase du jour : calculée sur l'horloge locale, donc sans réseau ni
  // permission. Le fond change avec l'heure même si la météo n'est
  // jamais activée. Rafraîchie au quart d'heure — une transition
  // d'aube à journée ne doit pas attendre un rechargement.
  useEffect(() => {
    const apply = () => setDaypart(daypartOf());
    apply();
    const timer = setInterval(apply, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const current = findRoute(route.section, route.page);
  if (!current) return null;
  const { section, page } = current;
  const Component = PAGES[page.key];

  const routeToken = `${section.key}/${page.key}`;
  // Le module courant se déduit de la section : l'URL ne le porte pas,
  // et c'est voulu — ajouter un module ne doit casser aucun lien.
  const currentModule = moduleOf(section.key);

  // Le module courant est publié sur la racine : c'est ce qui permet à
  // un module d'apporter sa PROPRE identité visuelle, sans que la
  // coquille ait à connaître ses couleurs.
  useEffect(() => {
    document.documentElement.setAttribute('data-module', currentModule.key);
  }, [currentModule.key]);

  return (
    <div className="app">
      {/* Effets décoratifs, montés une fois pour toute l'application.
          Ils ne rendent aucun texte et n'interceptent aucun clic. */}
      <ClickBurst />
      <RouteFx token={routeToken} />
      {/* Couches d'ambiance. Toutes décoratives, toutes fixes, toutes
          derrière le contenu — et toutes en `transform` ou en opacité,
          donc aucune ne se repeint. */}
      <span className="sky" aria-hidden="true" />
      <span className="rays" aria-hidden="true" />
      <span className="bands" aria-hidden="true" />
      <span className="tear" aria-hidden="true" />
      <span className="depth depth-near" aria-hidden="true" />
      <span className="weather-layer" aria-hidden="true" />
      <span className="motes" aria-hidden="true" />
      <span className="vignette" aria-hidden="true" />
      {/* `null` en repli : un indicateur de chargement pour une couche
          décorative clignoterait pour rien. */}
      <Suspense fallback={null}>
        <PhoneMenu
          navigate={go}
          currentModule={currentModule.key}
          open={phoneOpen}
          onOpenChange={setPhoneOpen}
        />
      </Suspense>

      <header className="topbar" ref={topbarRef}>
        <div className="brand">
          Forge<span>Fit</span>
        </div>

        <DateHud navigate={go} />

        <div className="topbar-right">
          <WeatherHud />
        {/* Sections — masquées sur mobile, où la barre basse prend le relais */}
        <nav className="sections-desktop" aria-label={`Sections — ${currentModule.label}`}>
          {currentModule.sections.map((s) => (
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
        <SoundToggle />
        </div>
      </header>

      {/* Pages de la section courante. Une section à page unique n'a pas
          besoin de sous-navigation. */}
      {section.pages.length > 1 && (
        <div className="subnav">
          <SubNav section={section} activeKey={page.key} onPick={go} />
        </div>
      )}

      {/* La clé force un remontage à chaque changement de route : sans
          elle, l'animation d'entrée ne rejouerait pas quand on passe
          d'une page à l'autre d'une même section. */}
      <main className="content page-enter" key={routeToken}>
        {/* Titre d'écran. C'était jusqu'ici une ligne de gris, et
            l'application n'avait AUCUN `h1` — un lecteur d'écran ne
            pouvait pas dire sur quelle page il se trouvait. Il devient
            à la fois la pièce graphique la plus imposante de l'écran
            et le titre de niveau 1 qui manquait. */}
        <header className="page-head">
          <h1 className="page-title">{page.label}</h1>
          <p className="page-hint">{page.hint}</p>
        </header>
        <Suspense fallback={<p className="empty">Chargement…</p>}>
          {/* `navigate` permet à un écran d'en ouvrir un autre : démarrer
              une séance depuis le calendrier doit conduire au mode
              Terrain, pas laisser l'utilisateur la chercher. */}
          <Component navigate={go} />
        </Suspense>
      </main>

      {/* Barre basse sur mobile : atteignable au pouce, contrairement à
          une barre haute sur un grand téléphone. */}
      <nav className="bottombar" aria-label={`Sections — ${currentModule.label}`}>
        {currentModule.sections.map((s) => (
          <button
            key={s.key}
            type="button"
            className="bottomtab"
            aria-current={section.key === s.key ? 'page' : undefined}
            onClick={() => go(s.key)}
          >
            <Glyph name={s.glyph ?? 'app'} size={21} />
            <span className="bottomtab-label">{s.label}</span>
          </button>
        ))}

        {/* Le téléphone était un bouton flottant en bas à droite : sur
            un écran étroit, il recouvrait le champ de recherche et le
            dernier élément de chaque liste. Il rejoint la barre, où il
            ne masque rien et reste sous le pouce. */}
        <button
          type="button"
          className="bottomtab bottomtab-phone"
          aria-label="Ouvrir le téléphone"
          onClick={() => setPhoneOpen(true)}
        >
          <Glyph name="app" size={21} />
          <span className="bottomtab-label">Apps</span>
        </button>
      </nav>
    </div>
  );
}
