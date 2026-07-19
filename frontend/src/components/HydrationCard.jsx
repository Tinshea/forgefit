import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Quick Add hydratation.
 *
 * Mise a jour OPTIMISTE : sur le terrain, l'utilisateur tape et range
 * son telephone. Attendre l'aller-retour reseau rendrait le bouton
 * mou. En cas d'echec, on revient a la valeur du serveur.
 */
const PRESETS = [250, 500, 750];

export default function HydrationCard({ compact = false, onChange }) {
  const [state, setState] = useState({ total_ml: 0, goal_ml: 2500, ratio: 0 });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.hydrationToday()
      .then((d) => { if (alive) setState(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const add = async (ml) => {
    const previous = state;
    const optimistic = {
      ...state,
      total_ml: state.total_ml + ml,
      ratio: (state.total_ml + ml) / state.goal_ml,
    };
    setState(optimistic);
    setPending(true);
    setError(null);

    try {
      const fresh = await api.addHydration(ml);
      setState(fresh);
      onChange?.(fresh);
    } catch (e) {
      setState(previous); // rollback
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  const percent = Math.min(100, Math.round((state.ratio ?? 0) * 100));
  const reached = state.total_ml >= state.goal_ml;

  return (
    <div className="card">
      <h2 className="card-title">Hydratation</h2>
      <p className="card-sub">Objectif quotidien {state.goal_ml} ml</p>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 700 }}>{state.total_ml}</span>
        <span className="stat-unit">ml · {percent} %</span>
        {reached && (
          <span
            className="pill"
            style={{ marginLeft: 'auto', color: 'var(--good)' }}
          >
            ✓ Objectif atteint
          </span>
        )}
      </div>

      <div
        className="gauge"
        role="progressbar"
        aria-valuenow={state.total_ml}
        aria-valuemin={0}
        aria-valuemax={state.goal_ml}
        aria-label="Hydratation du jour"
      >
        <div
          className="gauge-fill"
          style={{
            width: `${percent}%`,
            background: reached ? 'var(--good)' : 'var(--series-1)',
          }}
        />
      </div>

      <div className="water-actions">
        {PRESETS.map((ml) => (
          <button
            key={ml}
            type="button"
            className="water-btn"
            onClick={() => add(ml)}
            disabled={pending}
          >
            +{ml}
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
              ml
            </span>
          </button>
        ))}
      </div>

      {!compact && state.total_ml > 0 && (
        <button
          type="button"
          className="table-toggle"
          onClick={() => add(-250)}
          disabled={pending}
        >
          Annuler 250 ml
        </button>
      )}
    </div>
  );
}
