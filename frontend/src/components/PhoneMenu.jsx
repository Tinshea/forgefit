import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.js';
import { MODULES } from '../lib/navigation.js';
import Glyph from './Glyph.jsx';
import { playLater as play } from '../lib/sound-lazy.js';
import MapBoard from './MapBoard.jsx';

/**
 * Le téléphone — lanceur d'applications et carte des lieux.
 *
 * ┌─ CE QUE C'EST, ET CE QUE CE N'EST PAS ────────────────────────────┐
 * │ C'est un LANCEUR. ForgeFit n'est qu'une pièce d'une suite         │
 * │ personnelle à venir ; le téléphone donne un point d'entrée unique │
 * │ vers ses sections et vers les autres applications auto-hébergées. │
 * │                                                                    │
 * │ Ce n'est PAS une vitrine de fonctionnalités à venir. Aucune       │
 * │ tuile factice, aucun « bientôt disponible » : les seules          │
 * │ applications listées sont celles qui existent — les sections de   │
 * │ ForgeFit, et les liens que l'utilisateur ajoute lui-même.         │
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Onglets internes du téléphone. */
const TABS = [
  { key: 'apps', label: 'Apps', glyph: 'app' },
  { key: 'carte', label: 'Carte', glyph: 'carte' },
];

/**
 * `open` et `onOpenChange` permettent à la barre basse de commander le
 * téléphone. Il garde un état interne en repli, pour rester utilisable
 * seul — mais quand la coquille le pilote, c'est elle qui décide.
 */
/** Durée de la sortie. Doit rester égale à celle de `ff-phone-out`. */
const OUT_MS = 260;

export default function PhoneMenu({
  navigate, currentModule, open: openProp, onOpenChange,
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = openProp ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [tab, setTab] = useState('apps');
  const [apps, setApps] = useState([]);
  const [places, setPlaces] = useState([]);
  const [place, setPlace] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [fullMap, setFullMap] = useState(false);

  // ┌─ POURQUOI UN ÉTAT « EN TRAIN DE SE FERMER » ────────────────────┐
  // │ Le panneau était monté sur `open &&`. À la fermeture, React le  │
  // │ retirait du DOM sur-le-champ : il n'y avait donc RIEN à animer, │
  // │ et le téléphone disparaissait d'un coup alors qu'il était entré │
  // │ en glissant. L'aller était soigné, le retour n'existait pas.    │
  // │                                                                  │
  // │ On garde le nœud le temps de l'animation de sortie, puis on     │
  // │ ferme pour de bon. C'est la seule façon d'animer un démontage.  │
  // └──────────────────────────────────────────────────────────────────┘
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const close = useCallback(() => {
    if (closing) return;
    play('cancel');
    // Le mouvement est un ornement : qui l'a désactivé ferme tout de suite.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => { setClosing(false); setOpen(false); }, OUT_MS);
  }, [closing, setOpen]);

  const loadApps = useCallback(() => api.apps()
    .then((d) => setApps(d.items ?? []))
    .catch(() => {}), []);

  useEffect(() => {
    if (!open) return;
    loadApps();
    if (!places.length) api.locations().then((d) => setPlaces(d.locations ?? [])).catch(() => {});
  }, [open, loadApps, places.length]);

  // Fermeture au clavier, comme toute couche modale.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Refermer la couche la plus haute d'abord : fermer le téléphone
      // en laissant la carte plein écran ouverte serait déroutant.
      if (fullMap) { setFullMap(false); play('cancel'); }
      else close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, fullMap]);

  const go = (section, page) => {
    setOpen(false);
    setClosing(false);
    clearTimeout(closeTimer.current);
    navigate?.(section, page);
  };

  return (
    <>
      {/* ┌─ DEUX POINTS D'ENTREE, UN PAR CONTEXTE ───────────────────┐
          │ Sur téléphone, la barre basse porte une entrée « Apps » :  │
          │ le bouton flottant y recouvrait le champ de recherche.     │
          │ Sur grand écran, cette barre n'existe pas — masquer le     │
          │ bouton flottant y rendait le téléphone INATTEIGNABLE.      │
          │                                                             │
          │ Le choix est donc fait par la feuille de style, sur la     │
          │ même largeur de bascule que la barre elle-même, et non par │
          │ une condition en JavaScript qui ignorerait la taille.      │
          └─────────────────────────────────────────────────────────────┘ */}
      <button
        type="button"
        className="phone-button"
        aria-expanded={open}
        aria-label={open ? 'Fermer le téléphone' : 'Ouvrir le téléphone'}
        onClick={() => { if (open) close(); else { setOpen(true); play('select'); } }}
      >
        <span className="phone-button-body" aria-hidden="true">
          <span className="phone-button-screen" />
        </span>
      </button>

      {fullMap && createPortal(
        <div className="map-full" role="dialog" aria-label="Carte en plein écran">
          <MapBoard
            full
            onToggleFull={() => setFullMap(false)}
            onPickSport={(kind) => {
              const found = places.find((l) => l.key === kind);
              if (found) { setFullMap(false); setTab('carte'); setPlace(found); play('nav'); }
            }}
          />
        </div>,
        document.body,
      )}

      {(open || closing) && createPortal(
        <div
          className={`phone-layer${closing ? ' phone-layer-closing' : ''}`}
          role="dialog"
          aria-label="Téléphone"
        >
          {/* Voile : fermer en cliquant à côté est le geste attendu. */}
          <button
            type="button"
            className="phone-scrim"
            aria-label="Fermer"
            onClick={close}
          />

          <div className="phone">
            <div className="phone-notch" aria-hidden="true" />

            {/* En plein écran il n'y a plus d'« à côté » où appuyer :
                la feuille de style n'affiche ce bouton que là. */}
            <button
              type="button"
              className="phone-close"
              aria-label="Fermer le téléphone"
              onClick={close}
            >
              <Glyph name="croix" size={18} />
            </button>

            <div className="phone-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="phone-tab"
                  aria-selected={tab === t.key}
                  onClick={() => { setTab(t.key); setPlace(null); }}
                >
                  <Glyph name={t.glyph} size={14} />
                  {t.label}
                </button>
              ))}
            </div>

            {error && <div className="error-banner">{error}</div>}

            {tab === 'apps' && (
              <div className="phone-body">
                {/* Les MODULES d'abord : c'est le niveau auquel on
                    change d'application. Un module ouvre sa première
                    section, et la barre du haut se recompose autour de
                    lui. */}
                <div className="phone-section">Modules</div>
                <div className="module-list">
                  {MODULES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      className="module-row"
                      data-current={m.key === currentModule ? '' : undefined}
                      onClick={() => go(m.sections[0].key, m.sections[0].pages[0].key)}
                    >
                      <Glyph name={m.glyph} size={26} />
                      <span className="module-text">
                        <span className="module-name">{m.label}</span>
                        <span className="module-tag">{m.tagline}</span>
                      </span>
                      <span className="module-count">{m.sections.length}</span>
                    </button>
                  ))}
                </div>

                {/* Puis les sections du module courant : une fois dedans,
                    c'est là qu'on navigue. */}
                <div className="phone-section">
                  {MODULES.find((m) => m.key === currentModule)?.label ?? 'Sections'}
                </div>
                <div className="app-grid">
                  {(MODULES.find((m) => m.key === currentModule)?.sections ?? []).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className="app-tile"
                      onClick={() => go(s.key, s.pages[0].key)}
                    >
                      <Glyph name={s.glyph ?? 'app'} size={26} />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>

                <div className="phone-section">Liens externes</div>
                <div className="app-grid">
                  {apps.map((a) => (
                    <a
                      key={a.id}
                      className="app-tile"
                      href={a.url}
                      target="_blank"
                      // `noreferrer` en plus de `noopener` : la page
                      // ouverte n'a besoin ni de piloter celle-ci, ni de
                      // savoir d'où elle vient.
                      rel="noopener noreferrer"
                      onClick={() => play('select')}
                    >
                      <Glyph name={a.glyph} size={26} />
                      <span>{a.label}</span>
                      <button
                        type="button"
                        className="app-remove"
                        aria-label={`Retirer ${a.label}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          api.deleteApp(a.id).then(loadApps).catch((x) => setError(x.message));
                        }}
                      >
                        <Glyph name="croix" size={9} />
                      </button>
                    </a>
                  ))}

                  <button
                    type="button"
                    className="app-tile app-add"
                    onClick={() => setAdding(true)}
                  >
                    <Glyph name="plus" size={26} />
                    <span>Ajouter</span>
                  </button>
                </div>

                {apps.length === 0 && !adding && (
                  <p className="phone-note">
                    Pour un outil qui n’est pas un module de cette coquille.
                    Il s’ouvrira dans un onglet neuf, et la liste te suivra d’un
                    appareil à l’autre.
                  </p>
                )}

                {adding && (
                  <AppForm
                    onCancel={() => setAdding(false)}
                    onDone={() => { setAdding(false); loadApps(); play('confirm'); }}
                    onError={setError}
                  />
                )}
              </div>
            )}

            {tab === 'carte' && (
              <div className="phone-body">
                {!place ? (
                  <MapBoard
                    onToggleFull={() => setFullMap(true)}
                    onPickSport={(kind) => {
                      const found = places.find((l) => l.key === kind);
                      if (found) { setPlace(found); play('nav'); }
                    }}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="place-back"
                      onClick={() => { setPlace(null); play('cancel'); }}
                    >
                      ← La carte
                    </button>
                    <div className="place-head">
                      <Glyph name={place.glyph} size={30} />
                      <span className="place-title">{place.label}</span>
                    </div>
                    <p className="phone-note">{place.note}</p>
                    <div className="place-kit">
                      {place.equipment.map((e) => (
                        <span className="pill" key={e}>{e}</span>
                      ))}
                    </div>
                    <div className="phone-section">Praticable ici</div>
                    <div className="place-sports">
                      {place.sports.map((sp) => (
                        <button
                          key={sp.key}
                          type="button"
                          className="place-sport"
                          onClick={() => go('entrainement', 'sports')}
                        >
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Ajout d'une application : nom, adresse, pictogramme. */
function AppForm({ onCancel, onDone, onError }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [glyph, setGlyph] = useState('livre');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.addApp({ label, url, glyph });
      onDone();
    } catch (e) {
      onError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="app-form">
      <div className="field-block">
        <label htmlFor="app-label">Nom</label>
        <input
          id="app-label" value={label} maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Bibliothèque"
        />
      </div>
      <div className="field-block">
        <label htmlFor="app-url">Adresse</label>
        <input
          id="app-url" value={url} type="url"
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://biblio.chez-moi.lan"
        />
      </div>
      <div className="field-block">
        <label>Pictogramme</label>
        <div className="glyph-picker">
          {['livre', 'app', 'courbe', 'carte', 'reglage', 'assiette'].map((g) => (
            <button
              key={g} type="button" className="glyph-option"
              aria-pressed={glyph === g} onClick={() => setGlyph(g)}
              aria-label={g}
            >
              <Glyph name={g} size={20} />
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button" className="btn-primary" style={{ width: 'auto', marginTop: 0 }}
          onClick={submit} disabled={busy || !label.trim() || !url.trim()}
        >
          Ajouter
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
