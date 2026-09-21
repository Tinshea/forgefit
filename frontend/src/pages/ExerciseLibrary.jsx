import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import ExerciseSheet, { DISCIPLINE_LABELS } from '../components/ExerciseSheet.jsx';
import EvidenceBadge from '../components/EvidenceBadge.jsx';
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

/**
 * Fiche en pleine page.
 *
 * Ne garde que l'enveloppe — titre, fermeture, gestion du clavier. Le
 * contenu vit dans `ExerciseSheet`, partagé avec la séance et les
 * programmes.
 */
function ExerciseDetail({ exercise, onClose }) {
  const closeRef = useRef(null);

  // Fermeture au clavier : la fiche est une couche modale sur mobile.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="card sheet" role="dialog" aria-label={exercise.name_fr}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="card-title">{exercise.name_fr}</h2>
          <p className="card-sub" style={{ margin: 0 }}>{exercise.name_en}</p>
        </div>
        <button
          type="button" className="btn-ghost" onClick={onClose} ref={closeRef}
          aria-label="Fermer la fiche"
        >
          Fermer
        </button>
      </div>

      <ExerciseSheet exercise={exercise} />
    </div>
  );
}

export default function ExerciseLibrary() {
  const [query, setQuery] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [target, setTarget] = useState('');
  const [tier, setTier] = useState('');
  const [pattern, setPattern] = useState('');
  const [curatedOnly, setCuratedOnly] = useState(false);
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
        tier: tier || undefined,
        pattern: pattern || undefined,
        curated: curatedOnly ? '1' : undefined,
        limit: 60,
      })
        .then((d) => { setItems(d.items); setTotal(d.total); setError(null); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query, discipline, target, tier, pattern, curatedOnly]);

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

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button" className="tab"
            aria-selected={tier === '' && !curatedOnly}
            onClick={() => { setTier(''); setCuratedOnly(false); }}
          >
            Tout le catalogue
          </button>
          <button
            type="button" className="tab"
            aria-selected={curatedOnly && tier === ''}
            onClick={() => { setTier(''); setCuratedOnly(true); }}
            title="Les exercices pour lesquels ForgeFit cite de la littérature"
          >
            Classés
          </button>
          {(facets?.tiers ?? []).map((t) => (
            <button
              key={t.value} type="button" className="tab"
              aria-selected={tier === t.value}
              onClick={() => { setTier(t.value); setCuratedOnly(false); }}
              title={t.criteria}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Le critère du palier retenu, en clair : un badge dont on ne
            peut pas lire la règle n'est qu'une étiquette. */}
        {tier && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)', marginTop: 8,
            marginBottom: 0, lineHeight: 1.5,
          }}>
            {(facets?.tiers ?? []).find((t) => t.value === tier)?.criteria}
          </p>
        )}
        {!tier && !curatedOnly && facets?.unrated_note && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)', marginTop: 8,
            marginBottom: 0, lineHeight: 1.5,
          }}>
            {facets.unrated_note}
          </p>
        )}

        {(facets?.patterns ?? []).length > 0 && (
          <div className="field-block" style={{ marginTop: 12 }}>
            <label htmlFor="pattern-filter">Patron de mouvement</label>
            <select
              id="pattern-filter" value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Tous les patrons</option>
              {facets.patterns.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label} ({pt.count})
                </option>
              ))}
            </select>
          </div>
        )}

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
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <EvidenceBadge tier={ex.evidence_tier} compact />
                    <span className="pill">
                      {DISCIPLINE_LABELS[ex.discipline]?.slice(0, 5) ?? ex.discipline}
                    </span>
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
