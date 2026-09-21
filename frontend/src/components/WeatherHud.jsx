import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.js';
import {
  readConsent, saveConsent, forgetConsent, locate, setWeather,
} from '../lib/ambience.js';
import { playLater as play } from '../lib/sound-lazy.js';
import WeatherGlyph from './WeatherGlyph.jsx';

/**
 * Météo — le seul élément de l'application qui sorte du réseau local.
 *
 * ┌─ POURQUOI ELLE NE S'ACTIVE JAMAIS SEULE ──────────────────────────┐
 * │ Tout le reste fonctionne hors ligne, sur une base qu'on héberge   │
 * │ soi-même. La météo demande une position et un appel à un tiers :  │
 * │ ce n'est pas une fonctionnalité qu'on active à la place de        │
 * │ quelqu'un.                                                         │
 * │                                                                    │
 * │ D'où : un bouton explicite, ce qui se passe écrit en clair avant  │
 * │ de cliquer, et un moyen de tout oublier ensuite.                  │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Elle n'est pas décorative : la chaleur, le vent et la pluie changent
 * réellement ce qu'on peut faire d'une séance, et les repères affichés
 * portent leur source.
 */
/**
 * Panneau flottant, rendu HORS de la barre du haut.
 *
 * ┌─ POURQUOI UN PORTAIL, ET PAS UN Z-INDEX ──────────────────────────┐
 * │ La barre du haut porte `overflow: hidden` ET un `clip-path` pour  │
 * │ son bord incliné. Ces deux propriétés ROGNENT leurs descendants : │
 * │ un panneau en position absolue qui déborde sous la barre était    │
 * │ coupé net, et seuls quatorze pixels dépassaient.                  │
 * │                                                                    │
 * │ Aucun `z-index` ne corrige cela — la découpe n'est pas une        │
 * │ question d'ordre d'empilement. La seule issue est de sortir le    │
 * │ panneau de l'ancêtre qui le rogne, donc un portail vers le corps  │
 * │ du document, avec une position calculée depuis la pastille.       │
 * └────────────────────────────────────────────────────────────────────┘
 */
function Popover({ anchorRef, onClose, children }) {
  const panelRef = useRef(null);
  const [box, setBox] = useState(null);

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 12;
    const width = Math.min(360, vw - MARGIN * 2);

    // ┌─ BORNER DES DEUX CÔTÉS, PAS D'UN SEUL ──────────────────────┐
    // │ Le panneau s'aligne à droite sur la pastille. Mais celle-ci  │
    // │ n'est PAS au bord de l'écran : le bouton de son la suit.     │
    // │ Sur un téléphone, un alignement strict projetait donc le     │
    // │ panneau 53 px hors du bord GAUCHE.                           │
    // │                                                              │
    // │ On borne donc le décalage droit par le haut aussi : au-delà, │
    // │ le bord gauche passerait sous zéro.                          │
    // └──────────────────────────────────────────────────────────────┘
    const wanted = vw - r.right;
    const right = Math.min(
      Math.max(MARGIN, wanted),
      Math.max(MARGIN, vw - width - MARGIN),
    );

    const top = r.bottom + 10;
    setBox({
      top,
      right,
      width,
      // Un panneau plus haut que l'écran doit défiler en lui-même,
      // sinon son bouton « désactiver » devient inatteignable.
      maxHeight: Math.max(160, vh - top - MARGIN),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    place();
    window.addEventListener('resize', place);
    // `capture` : la barre est collante, mais la page défile sous elle.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [place]);

  // Fermeture au clic extérieur et à la touche d'échappement : un
  // panneau flottant qu'on ne peut fermer qu'en retrouvant son bouton
  // est une impasse.
  useEffect(() => {
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  if (!box) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="weather-panel sheet"
      role="dialog"
      aria-label="Météo et conséquences sur la séance"
      style={{
        top: box.top, right: box.right, width: box.width, maxHeight: box.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default function WeatherHud() {
  const [weather, setData] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const chipRef = useRef(null);

  const load = async ({ lat, lon }) => {
    setState('loading');
    try {
      const d = await api.weather(lat, lon);
      setData(d);
      setWeather(d.group);
      setState('ready');
    } catch (e) {
      setError(e.message);
      setState('error');
    }
  };

  useEffect(() => {
    const saved = readConsent();
    if (saved) load(saved);
    return () => setWeather(null);
    // Au montage seulement : la météo ne se recharge pas à chaque rendu.
  }, []);

  const enable = async () => {
    setError(null);
    setState('locating');
    try {
      const coords = await locate();
      saveConsent(coords);
      await load(coords);
      play('confirm');
    } catch (e) {
      setError(e.message);
      setState('error');
    }
  };

  const disable = () => {
    forgetConsent();
    setWeather(null);
    setData(null);
    setState('idle');
    setOpen(false);
    play('cancel');
  };

  if (state === 'idle' || state === 'error') {
    return (
      <div className="weather-off">
        <button
          type="button"
          className="weather-enable"
          onClick={enable}
          disabled={state === 'locating'}
          title={'Demande ta position au navigateur. Les coordonnées sont '
            + 'arrondies à environ 1 km et transmises par ton serveur, '
            + 'jamais par ton navigateur.'}
        >
          <WeatherGlyph group="cloud" size={15} />
          {state === 'locating' ? 'Localisation…' : 'Météo'}
        </button>
        {error && <span className="weather-error">{error}</span>}
      </div>
    );
  }

  if (!weather) return <span className="weather-chip">…</span>;

  const alert = weather.notes?.find((n) => n.level === 'alerte')
    ?? weather.notes?.find((n) => n.level === 'attention');

  return (
    <div className="weather-wrap">
      <button
        type="button"
        className="weather-chip"
        ref={chipRef}
        data-alert={alert ? '' : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={weather.label}
      >
        <WeatherGlyph group={weather.group} size={17} />
        <span className="weather-temp">
          {Math.round(weather.temperature)}°
        </span>
        {alert && <span className="weather-dot" aria-hidden="true" />}
      </button>

      {open && (
        <Popover anchorRef={chipRef} onClose={() => setOpen(false)}>
          <div className="weather-head">
            <WeatherGlyph group={weather.group} size={40} title={weather.label} />
            <div>
              <div className="weather-label">{weather.label}</div>
              <div className="weather-detail">
                {Math.round(weather.temperature)} °C
                {weather.apparent != null
                  && ` · ressenti ${Math.round(weather.apparent)} °C`}
                {weather.wind_kmh != null
                  && ` · vent ${Math.round(weather.wind_kmh)} km/h`}
              </div>
            </div>
          </div>

          <p className="weather-verdict" data-outdoor={weather.outdoor ? '' : undefined}>
            {weather.outdoor
              ? 'Séance dehors possible.'
              : 'Séance dehors compromise.'}
          </p>

          {weather.notes?.length > 0 && (
            <ul className="weather-notes">
              {weather.notes.map((n, i) => (
                <li key={i} data-level={n.level}>
                  {n.text}
                  {n.source && <span className="weather-source">{n.source}</span>}
                </li>
              ))}
            </ul>
          )}

          <p className="weather-privacy">{weather.privacy}</p>
          <p className="weather-privacy">{weather.attribution}</p>

          <button type="button" className="btn-ghost" onClick={disable}>
            Désactiver et oublier ma position
          </button>
        </Popover>
      )}
    </div>
  );
}
