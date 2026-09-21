import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Glyph from './Glyph.jsx';
import { playLater as play } from '../lib/sound-lazy.js';
import { locate } from '../lib/ambience.js';
import {
  TILE, visibleTiles, project, unproject, panBy, MAX_LAT,
} from '../lib/mercator.js';

/**
 * Carte réelle, en tuiles OpenStreetMap.
 *
 * ┌─ CE QUI EST ASSUMÉ ICI ───────────────────────────────────────────┐
 * │ Les tuiles viennent d'un service extérieur — le deuxième et       │
 * │ dernier de l'application, après la météo. Trois garde-fous :      │
 * │                                                                    │
 * │ — elles transitent par TON serveur, jamais par ton navigateur :   │
 * │   le fournisseur ne voit pas ton adresse IP (cf. routes/tiles.js);│
 * │ — l'attribution « © OpenStreetMap contributors » est affichée en  │
 * │   permanence : ce n'est pas une politesse, c'est la condition de  │
 * │   la licence ODbL ;                                               │
 * │ — rien ne charge tant qu'on n'ouvre pas la carte.                 │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Écrite à la main plutôt qu'avec une bibliothèque de cartographie :
 * voir `lib/mercator.js` pour la raison.
 */

const ZOOM = { min: 3, max: 19 };

/**
 * Rendus de tuiles.
 *
 * ┌─ POURQUOI DES FILTRES ET PAS UN AUTRE FOURNISSEUR ────────────────┐
 * │ Les fonds sombres tout prêts — Carto Dark Matter, Stamen Toner —  │
 * │ sont beaux, mais ce serait un SERVICE TIERS DE PLUS, avec sa      │
 * │ politique d'usage, parfois sa clé d'API, et une adresse de plus à │
 * │ qui l'on révèle ce qu'on regarde.                                 │
 * │                                                                    │
 * │ Les mêmes tuiles OpenStreetMap, retravaillées par un filtre CSS,  │
 * │ donnent trois rendus très différents pour zéro requête            │
 * │ supplémentaire et zéro dépendance. Le filtre s'applique sur le    │
 * │ compositeur : il ne coûte rien à l'exécution.                     │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * « Encre » est le rendu par défaut : inversé et contrasté, il donne un
 * plan blanc sur noir, qui est exactement le vocabulaire du reste de
 * l'interface. Le rendu brut reste offert — une carte sert d'abord à
 * être lue, et personne ne doit être enfermé dans un parti pris.
 */
const STYLES = [
  {
    key: 'encre',
    label: 'Encre',
    // Un peu plus clair que le premier essai : les noms de rues y
    // gagnent en lisibilité, et une carte sert d'abord à être lue.
    filter: 'grayscale(1) invert(1) contrast(1.32) brightness(0.98)',
  },
  {
    key: 'braise',
    label: 'Braise',
    filter: 'grayscale(1) invert(1) contrast(1.5) brightness(0.7) '
      + 'sepia(1) hue-rotate(-38deg) saturate(3.2)',
  },
  {
    key: 'plan',
    label: 'Plan',
    filter: 'brightness(0.62) saturate(0.55) contrast(1.12)',
  },
  { key: 'brut', label: 'Brut', filter: 'none' },
];

const STYLE_KEY = 'forgefit.mapStyle';

const readStyle = () => {
  try {
    return localStorage.getItem(STYLE_KEY) ?? 'encre';
  } catch {
    return 'encre';
  }
};

/** Vue de départ quand aucun lieu n'est encore posé : l'Europe. */
const FALLBACK = { lat: 48.8566, lon: 2.3522, zoom: 12 };

export default function MapBoard({ onPickSport, full = false, onToggleFull }) {
  const [places, setPlaces] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [meta, setMeta] = useState(null);
  const [active, setActive] = useState(null);
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState(FALLBACK);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [locating, setLocating] = useState(false);
  const [style, setStyle] = useState(readStyle);

  const frameRef = useRef(null);
  const drag = useRef(null);

  // Le cadre est mesuré : les tuiles visibles en dépendent entièrement.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(() => api.places()
    .then((d) => {
      const items = d.items ?? [];
      setPlaces(items);
      setKinds(d.kinds ?? []);
      // On s'ouvre sur ses propres lieux plutôt que sur une vue
      // arbitraire : la carte doit montrer quelque chose d'utile dès
      // le premier instant.
      if (items.length) {
        setView((v) => ({ ...v, lat: items[0].lat, lon: items[0].lon }));
      }
    })
    .catch((e) => setError(e.message)), []);

  useEffect(() => {
    load();
    api.tileInfo().then(setMeta).catch(() => {});
  }, [load]);

  // --- Déplacement -------------------------------------------------------
  const onPointerDown = (e) => {
    if (e.target.closest('.map-pin')) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
    setView((v) => panBy(v, dx, dy, size.w, size.h));
  };

  const onPointerUp = (e) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;

    // On ne pose un lieu que si le doigt n'a PAS glissé : sinon chaque
    // déplacement de carte en créerait un.
    if (adding && !wasDrag && frameRef.current) {
      const r = frameRef.current.getBoundingClientRect();
      const point = unproject(
        { left: e.clientX - r.left, top: e.clientY - r.top },
        view, size.w, size.h,
      );
      setAdding((a) => ({ ...a, lat: point.lat, lon: point.lon }));
      play('select');
    }
  };

  const zoom = (delta) => setView((v) => ({
    ...v,
    zoom: Math.max(ZOOM.min, Math.min(meta?.max_zoom ?? ZOOM.max, v.zoom + delta)),
  }));

  const goToMe = async () => {
    setLocating(true);
    setError(null);
    try {
      const c = await locate();
      setView((v) => ({ ...v, lat: c.lat, lon: c.lon, zoom: Math.max(v.zoom, 15) }));
      play('confirm');
    } catch (e) {
      setError(e.message);
    } finally {
      setLocating(false);
    }
  };

  /**
   * Trois lieux d'exemple, posés autour du centre de la vue.
   *
   * ┌─ POURQUOI UN BOUTON ET PAS UN PRÉ-REMPLISSAGE ──────────────────┐
   * │ Glisser des données dans le compte de quelqu'un sans le lui     │
   * │ demander est toujours une mauvaise idée : on ne sait plus ce    │
   * │ qui vient de soi et ce qui vient du logiciel.                   │
   * │                                                                  │
   * │ Ils sont donc posés à la demande, nommés « Exemple » sans        │
   * │ ambiguïté, et se retirent un par un comme n'importe quel lieu.  │
   * │                                                                  │
   * │ Ils sont placés autour du CENTRE DE LA VUE et non à des         │
   * │ coordonnées fixes : posés à Paris alors qu'on regarde Lyon, ils │
   * │ seraient invisibles, et l'exemple n'aurait rien montré.         │
   * └──────────────────────────────────────────────────────────────────┘
   */
  const addExamples = async () => {
    // Environ 400 m d'écart : assez pour distinguer les pions, assez
    // près pour tenir dans le cadre à ce niveau de zoom.
    const d = 0.004;
    const samples = [
      { label: 'Exemple — salle', kind: 'salle', lat: view.lat + d, lon: view.lon - d },
      { label: 'Exemple — bureau', kind: 'travail', lat: view.lat - d * 0.6, lon: view.lon + d * 1.2 },
      { label: 'Exemple — parc', kind: 'dehors', lat: view.lat - d * 1.3, lon: view.lon - d * 0.8 },
    ];
    try {
      // En série : l'ordre de création fixe l'ordre d'affichage.
      for (const sample of samples) await api.addPlace(sample);
      play('confirm');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const create = async () => {
    try {
      await api.addPlace(adding);
      setAdding(null);
      play('confirm');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const { tiles } = size.w > 0
    ? visibleTiles(view, size.w, size.h)
    : { tiles: [] };

  const pickStyle = (key) => {
    setStyle(key);
    try { localStorage.setItem(STYLE_KEY, key); } catch { /* réglage volatil */ }
    play('tick');
  };

  const filter = STYLES.find((v) => v.key === style)?.filter ?? STYLES[0].filter;

  return (
    <div className="map-wrap" data-full={full ? '' : undefined}>
      {error && <div className="error-banner">{error}</div>}

      <div className="map-tools">
        <button type="button" className="map-tool" onClick={() => zoom(-1)} aria-label="Dézoomer">
          <Glyph name="moins" size={14} />
        </button>
        <button type="button" className="map-tool" onClick={() => zoom(1)} aria-label="Zoomer">
          <Glyph name="plus" size={14} />
        </button>
        <button
          type="button" className="map-tool" onClick={goToMe}
          disabled={locating} aria-label="Centrer sur ma position"
        >
          {locating ? '…' : <Glyph name="cible" size={15} />}
        </button>
        <button
          type="button"
          className="map-tool map-tool-add"
          aria-pressed={!!adding}
          onClick={() => {
            setAdding(adding ? null : { label: '', kind: kinds[0]?.key ?? 'maison', lat: null, lon: null });
            setActive(null);
            play(adding ? 'cancel' : 'select');
          }}
        >
          {adding ? 'Annuler' : '+ Lieu'}
        </button>
        {onToggleFull && (
          <button
            type="button" className="map-tool"
            onClick={() => { onToggleFull(); play('select'); }}
            aria-label={full ? 'Réduire la carte' : 'Agrandir la carte'}
          >
            <Glyph name={full ? 'reduire' : 'agrandir'} size={14} />
          </button>
        )}
      </div>

      {/* Le choix de rendu n'apparaît qu'en grand : sur une carte de
          320 px, quatre boutons de plus mangent la carte elle-même. */}
      {full && (
        <div className="map-styles">
          {STYLES.map((v) => (
            <button
              key={v.key} type="button" className="map-style"
              aria-pressed={style === v.key}
              onClick={() => pickStyle(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <p className="map-hint">
          {adding.lat == null
            ? 'Touche la carte à l’endroit voulu.'
            : 'Nomme ce lieu et choisis son type.'}
        </p>
      )}

      <div
        ref={frameRef}
        className="map-viewport"
        data-adding={adding ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
      >
        <div className="map-tiles" aria-hidden="true">
          {tiles.map((t) => (
            <img
              key={t.key}
              className="map-tile"
              src={`/api/tiles/${t.z}/${t.x}/${t.y}.png`}
              alt=""
              width={TILE}
              height={TILE}
              loading="eager"
              draggable="false"
              style={{ transform: `translate(${t.left}px, ${t.top}px)`, filter }}
              // Une tuile manquante laisse un trou sombre plutôt qu'une
              // icône d'image cassée : la carte reste lisible.
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
          ))}
        </div>

        {size.w > 0 && places.map((pl) => {
          const p = project(pl, view, size.w, size.h);
          // Hors cadre : inutile de le rendre, et cela évite des dizaines
          // de nœuds invisibles quand on dézoome.
          if (p.left < -60 || p.left > size.w + 60 || p.top < -60 || p.top > size.h + 60) {
            return null;
          }
          return (
            <button
              key={pl.id}
              type="button"
              className="map-pin"
              data-active={active?.id === pl.id ? '' : undefined}
              style={{ left: p.left, top: p.top }}
              onClick={(e) => {
                e.stopPropagation();
                setActive(active?.id === pl.id ? null : pl);
                play('nav');
              }}
            >
              <span className="map-pin-body">
                <Glyph name={pl.glyph} size={18} />
              </span>
              <span className="map-pin-label">{pl.label}</span>
            </button>
          );
        })}

        {adding?.lat != null && size.w > 0 && (() => {
          const p = project(adding, view, size.w, size.h);
          return <span className="map-ghost" style={{ left: p.left, top: p.top }} />;
        })()}

        {/* Attribution : condition de la licence ODbL, donc permanente
            et jamais masquée par un autre élément. */}
        <a
          className="map-credit"
          href={meta?.attribution_url ?? 'https://www.openstreetmap.org/copyright'}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {meta?.attribution ?? '© OpenStreetMap contributors'}
        </a>
      </div>

      {adding?.lat != null && (
        <div className="map-form">
          <div className="field-block">
            <label htmlFor="place-label">Nom</label>
            <input
              id="place-label" value={adding.label} maxLength={32}
              onChange={(e) => setAdding((a) => ({ ...a, label: e.target.value }))}
              placeholder="Ma salle"
            />
          </div>
          <div className="field-block">
            <label>Type</label>
            <div className="kind-picker">
              {kinds.map((k) => (
                <button
                  key={k.key} type="button" className="kind-option"
                  aria-pressed={adding.kind === k.key}
                  onClick={() => setAdding((a) => ({ ...a, kind: k.key }))}
                >
                  <Glyph name={k.glyph} size={16} />
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button" className="btn-primary" style={{ marginTop: 0 }}
            onClick={create} disabled={!adding.label.trim()}
          >
            Poser le lieu
          </button>
        </div>
      )}

      {active && (
        <div className="map-detail">
          <div className="place-head">
            <Glyph name={active.glyph} size={26} />
            <span className="place-title">{active.label}</span>
          </div>
          <p className="phone-note">
            {active.kind_label} · {active.sports} sport{active.sports > 1 ? 's' : ''} praticable
            {active.sports > 1 ? 's' : ''} ici.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="btn-ghost" onClick={() => onPickSport?.(active.kind)}>
              Que faire ici ?
            </button>
            <button
              type="button" className="btn-ghost"
              onClick={() => {
                api.deletePlace(active.id)
                  .then(() => { setActive(null); play('cancel'); return load(); })
                  .catch((e) => setError(e.message));
              }}
            >
              Retirer
            </button>
          </div>
        </div>
      )}

      {places.length === 0 && !adding && (
        <div className="map-empty">
          <p className="phone-note" style={{ marginTop: 0 }}>
            Pose tes lieux : ta salle, ton bureau, le parc. Touche
            <strong> + Lieu</strong>, puis la carte à l’endroit voulu.
            Les tuiles transitent par ton serveur — le fournisseur de cartes
            ne voit pas ton adresse.
          </p>
          <button type="button" className="btn-ghost" onClick={addExamples}>
            Poser trois lieux d’exemple
          </button>
        </div>
      )}
    </div>
  );
}
