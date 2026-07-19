import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import MuscleDiagram from '../components/MuscleDiagram.jsx';
import { muscleLabel } from '../lib/anatomy.js';

/**
 * Bibliothèque d'exercices : consulter et comprendre, pas logger.
 *
 * La fiche répond à deux questions concrètes — quel muscle je travaille,
 * et comment j'exécute le mouvement. D'où le schéma anatomique et les
 * consignes numérotées en français, plutôt qu'un simple GIF.
 */

const DISCIPLINES = [
  { key: '', label: 'Toutes' },
  { key: 'musculation', label: 'Muscu' },
  { key: 'callisthenie', label: 'Callisthénie' },
  { key: 'mobilite', label: 'Mobilité' },
  { key: 'souplesse', label: 'Souplesse' },
  { key: 'cardio', label: 'Cardio' },
];

const DISCIPLINE_LABELS = {
  musculation: 'Musculation',
  callisthenie: 'Callisthénie',
  mobilite: 'Mobilité',
  souplesse: 'Souplesse',
  cardio: 'Cardio',
};

const AXIS_LABELS = {
  push: 'Force Poussée', pull: 'Force Tirage', legs: 'Jambes',
  endurance: 'Endurance', mobility: 'Mobilité', flexibility: 'Souplesse',
  explosive: 'Explosivité', core: 'Gainage',
};

/** Conseils d'exécution par discipline — le dataset n'en fournit pas. */
const HOW_TO = {
  souplesse: {
    title: 'Comment le travailler',
    points: [
      'Tenir 30 à 60 s par position, sans à-coups.',
      'Aller jusqu’à la tension, jamais jusqu’à la douleur.',
      'Respirer lentement : bloquer la respiration crispe le muscle.',
      'Plutôt après la séance ou à distance : un étirement long avant réduit la force disponible.',
    ],
  },
  mobilite: {
    title: 'Comment le travailler',
    points: [
      '8 à 12 répétitions lentes et contrôlées, amplitude maximale.',
      'Idéal à l’échauffement : prépare l’articulation sans fatiguer.',
      'Chercher l’amplitude que tu contrôles, pas celle que tu subis.',
      'Quotidien de préférence : la fréquence prime sur la durée.',
    ],
  },
  musculation: {
    title: 'Comment le travailler',
    points: [
      'Force : 3–5 séries de 3–6 reps à 80–90 % du 1RM, 3 min de repos.',
      'Hypertrophie : 3–4 séries de 8–12 reps à 65–75 %, 90 s de repos.',
      'Descente contrôlée (2–3 s) : c’est là que se fait l’essentiel du travail.',
      'Garder 1 à 2 reps en réserve, sauf séance de test.',
    ],
  },
  callisthenie: {
    title: 'Comment le travailler',
    points: [
      'Progresser par la difficulté du mouvement avant d’ajouter du lest.',
      'Amplitude complète : une demi-traction ne compte qu’à moitié.',
      'Si moins de 5 reps possibles, passer à une variante assistée.',
      'Au-delà de 15 reps, lester ou complexifier.',
    ],
  },
  cardio: {
    title: 'Comment le travailler',
    points: [
      'Endurance de base : 30–60 min en aisance respiratoire.',
      'Fractionné : 6–10 × 1 min intense / 1 min récupération.',
      'Viser 150 min hebdomadaires minimum, réparties sur la semaine.',
    ],
  },
};

/** Résolution native des médias du dataset. Il n'existe pas mieux. */
const MEDIA_NATIVE_PX = 180;

/**
 * Média de démonstration.
 *
 * Les GIF du dataset font 180×180 — c'est la seule résolution publiée,
 * il n'existe pas de variante HD dans le dépôt. Les étirer sur toute la
 * largeur de colonne (≈ 2,2×) produisait un flou d'interpolation qu'on
 * peut simplement éviter : on plafonne à 1,2× et on centre.
 *
 * Le zoom reste offert pour lire un mouvement fin, avec le compromis
 * annoncé plutôt que subi.
 */
function ExerciseMedia({ data }) {
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const width = zoomed ? MEDIA_NATIVE_PX * 2 : Math.round(MEDIA_NATIVE_PX * 1.2);

  return (
    <div>
      <div
        style={{
          display: 'grid', placeItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 12, minHeight: 160,
        }}
      >
        {failed ? (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Démonstration indisponible
          </span>
        ) : (
          <img
            // Média servi depuis le dépôt source, jamais rapatrié.
            src={data.gif_url}
            alt={`Démonstration animée : ${data.name_fr}`}
            loading="lazy"
            width={MEDIA_NATIVE_PX}
            height={MEDIA_NATIVE_PX}
            style={{
              width, height: width, maxWidth: '100%',
              borderRadius: 8, display: 'block',
              // Interpolation lisse : le contenu est photographique,
              // `pixelated` accentuerait l'escalier au lieu de l'atténuer.
              imageRendering: 'auto',
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {!failed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
          flexWrap: 'wrap',
        }}>
          <button
            type="button" className="btn-ghost" onClick={() => setZoomed((v) => !v)}
            aria-pressed={zoomed}
          >
            {zoomed ? 'Taille native' : 'Agrandir ×2'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Source en {MEDIA_NATIVE_PX}×{MEDIA_NATIVE_PX}
            {zoomed ? ' — agrandi, donc adouci' : ''}
          </span>
        </div>
      )}

      {data.attribution && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {data.attribution}
        </p>
      )}
    </div>
  );
}

function ExerciseDetail({ exercise, onClose }) {
  const [full, setFull] = useState(null);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setFull(null);
    api.exercise(exercise.id)
      .then((d) => { if (alive) setFull(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [exercise.id]);

  // Fermeture au clavier : la fiche est une couche modale sur mobile.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = full ?? exercise;
  const steps = full?.steps ?? [];
  const secondary = (data.secondary_muscles ?? []).filter((m) => m !== data.target);
  const howTo = HOW_TO[data.discipline];

  return (
    <div className="card" role="dialog" aria-label={data.name_fr}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="card-title">{data.name_fr}</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {data.name_en}
          </p>
        </div>
        <button
          type="button" className="btn-ghost" onClick={onClose} ref={closeRef}
          aria-label="Fermer la fiche"
        >
          Fermer
        </button>
      </div>

      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <span className="pill">{DISCIPLINE_LABELS[data.discipline] ?? data.discipline}</span>
        {data.equipment && <span className="pill">{data.equipment}</span>}
        {data.axis && <span className="pill">{AXIS_LABELS[data.axis] ?? data.axis}</span>}
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ExerciseMedia data={data} />

        <div>
          <div className="stat-label" style={{ marginBottom: 8 }}>Muscles sollicités</div>
          <MuscleDiagram
            primary={data.target}
            secondary={secondary}
            size={175}
          />

          <dl style={{ margin: '14px 0 0', fontSize: 13, display: 'grid', gap: 8 }}>
            <div>
              <dt style={{ color: 'var(--text-muted)', fontSize: 12 }}>Principal</dt>
              <dd style={{ margin: '2px 0 0', fontWeight: 650 }}>
                {muscleLabel(data.target)}
              </dd>
            </div>
            {secondary.length > 0 && (
              <div>
                <dt style={{ color: 'var(--text-muted)', fontSize: 12 }}>Secondaires</dt>
                <dd style={{ margin: '2px 0 0' }}>
                  {secondary.map(muscleLabel).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {steps.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>Exécution</div>
          <ol style={{ paddingLeft: 20, margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {!full && !error && (
        <p className="empty" style={{ marginTop: 12 }}>Chargement des consignes…</p>
      )}

      {howTo && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--grid)' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>{howTo.title}</div>
          <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            {howTo.points.map((p, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ExerciseLibrary() {
  const [query, setQuery] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [target, setTarget] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const timer = useRef(null);

  useEffect(() => {
    api.facets().then(setFacets).catch(() => {});
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      api.exercises({
        q: query || undefined,
        discipline: discipline || undefined,
        target: target || undefined,
        limit: 60,
      })
        .then((d) => { setItems(d.items); setTotal(d.total); setError(null); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query, discipline, target]);

  const targets = useMemo(
    () => (facets?.targets ?? []).filter((t) => t.value),
    [facets],
  );

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      {selected && (
        <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} />
      )}

      <div className="card">
        <h2 className="card-title">Bibliothèque d’exercices</h2>
        <p className="card-sub">
          {total} exercice{total > 1 ? 's' : ''} · muscles ciblés et exécution
        </p>

        <input
          className="field-search"
          type="search"
          placeholder="Rechercher (développé, traction, ischio…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher un exercice"
        />

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {DISCIPLINES.map((d) => (
            <button
              key={d.key} type="button" className="tab"
              aria-selected={discipline === d.key}
              onClick={() => setDiscipline(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {targets.length > 0 && (
          <div className="field-block" style={{ marginTop: 12 }}>
            <label htmlFor="target-filter">Muscle ciblé</label>
            <select
              id="target-filter"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Tous les muscles</option>
              {targets.map((t) => (
                <option key={t.value} value={t.value}>
                  {muscleLabel(t.value)} ({t.count})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && items.length === 0 && <p className="empty">Chargement…</p>}

      {!loading && items.length === 0 && (
        <div className="card"><p className="empty">Aucun exercice ne correspond.</p></div>
      )}

      {items.length > 0 && (
        <div className="card">
          <ul className="exercise-list" style={{ maxHeight: 'none' }}>
            {items.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  className="exercise-item"
                  aria-pressed={selected?.id === ex.id}
                  onClick={() => {
                    setSelected(ex);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <img
                    className="exercise-thumb"
                    src={ex.image_url} alt="" loading="lazy" decoding="async"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="exercise-name">{ex.name_fr}</span>
                    <span className="exercise-meta">
                      {muscleLabel(ex.target)} · {ex.equipment}
                    </span>
                  </span>
                  <span className="pill">
                    {DISCIPLINE_LABELS[ex.discipline]?.slice(0, 5) ?? ex.discipline}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {total > items.length && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              {items.length} affichés sur {total}. Affine la recherche pour réduire la liste.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
