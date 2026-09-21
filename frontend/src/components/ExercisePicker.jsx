import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import EvidenceBadge from './EvidenceBadge.jsx';
import { muscleLabel } from '../lib/anatomy.js';

const DISCIPLINES = [
  { key: '', label: 'Tout' },
  { key: 'musculation', label: 'Muscu' },
  { key: 'callisthenie', label: 'Callisthénie' },
  { key: 'mobilite', label: 'Mobilité' },
  { key: 'souplesse', label: 'Souplesse' },
  { key: 'cardio', label: 'Cardio' },
];

/**
 * Choix d'un exercice à ajouter à une séance.
 *
 * Le catalogue ENTIER est proposé par défaut : restreindre au noyau curé
 * reviendrait à décider à la place de l'utilisateur, alors que ne pas
 * figurer dans ce noyau n'est pas un jugement de qualité.
 *
 * Ce qui rend les 1324 entrées navigables, ce n'est pas un filtre par
 * défaut, c'est l'ORDRE : l'API sert les exercices classés en tête, du
 * fondamental à l'accessoire. Le bon choix est donc en haut sans que
 * rien ne soit caché.
 */
export default function ExercisePicker({ onPick, onCancel }) {
  const [facets, setFacets] = useState(null);
  const [pattern, setPattern] = useState('');
  const [q, setQ] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [equipment, setEquipment] = useState('');
  const [curatedOnly, setCuratedOnly] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.facets().then(setFacets).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api.exercises({
        pattern: pattern || undefined,
        q: q || undefined,
        discipline: discipline || undefined,
        equipment: equipment || undefined,
        curated: curatedOnly ? '1' : undefined,
        limit: 60,
      })
        .then((d) => { setItems(d.items); setTotal(d.total); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [pattern, q, discipline, equipment, curatedOnly]);

  return (
    <div className="card" style={{ border: '1px solid var(--series-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 className="card-title" style={{ flex: 1, margin: 0 }}>Ajouter un exercice</h3>
        <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
      </div>

      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      <div className="field-block" style={{ marginTop: 12 }}>
        <label htmlFor="picker-pattern">Patron de mouvement</label>
        <select
          id="picker-pattern" value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        >
          <option value="">Tous</option>
          {(facets?.patterns ?? []).map((p) => (
            <option key={p.value} value={p.value}>
              {p.label} ({p.count})
            </option>
          ))}
        </select>
      </div>

      <div className="field-block">
        <label htmlFor="picker-equipment">Matériel</label>
        <select
          id="picker-equipment" value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">Tout matériel</option>
          {(facets?.equipment ?? []).map((eq) => (
            <option key={eq.value} value={eq.value}>
              {eq.value} ({eq.count})
            </option>
          ))}
        </select>
      </div>

      <div className="field-block">
        <label htmlFor="picker-q">Recherche</label>
        <input
          id="picker-q" type="search" className="field-search"
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="développé, traction, mollets…"
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {DISCIPLINES.map((d) => (
          <button
            key={d.key} type="button" className="tab"
            aria-selected={discipline === d.key}
            onClick={() => setDiscipline(d.key)}
          >
            {d.label}
          </button>
        ))}
        <button
          type="button" className="tab"
          aria-selected={curatedOnly}
          onClick={() => setCuratedOnly((v) => !v)}
          title="Ne montrer que les exercices pour lesquels ForgeFit cite de la littérature"
        >
          Classés seuls
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
        {total} exercice{total > 1 ? 's' : ''} — les mieux documentés en tête.
        {!curatedOnly && facets?.unrated_note ? ` ${facets.unrated_note}` : ''}
      </p>

      {loading && <p className="empty">Recherche…</p>}

      <ul className="exercise-list" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {items.map((ex) => (
          <li key={ex.id}>
            <button
              type="button" className="exercise-item"
              onClick={() => onPick(ex)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <img
                src={ex.gif_url} alt="" loading="lazy" decoding="async"
                className="exercise-thumb"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="exercise-name">{ex.name_fr}</span>
                  <EvidenceBadge tier={ex.evidence_tier} compact />
                </span>
                <span className="exercise-meta">
                  {muscleLabel(ex.target)}{ex.equipment ? ` · ${ex.equipment}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {!loading && !items.length && (
        <p className="empty">
          Aucun exercice ne correspond
          {curatedOnly ? ' parmi les exercices classés. Retire ce filtre pour chercher dans tout le catalogue.' : '.'}
        </p>
      )}
    </div>
  );
}
