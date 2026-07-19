import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import ReferenceNote from '../components/ReferenceNote.jsx';

/**
 * Benchmark de force.
 *
 * Un percentile seul n'est pas actionnable : « 62ᵉ percentile » ne dit
 * pas quoi faire lundi. Chaque mouvement est donc affiché sur son
 * échelle de paliers, avec la charge EXACTE qui ferait basculer au
 * palier suivant, calculée pour le poids de corps de l'utilisateur.
 */

const LEVEL_COLORS = {
  'Débutant': 'var(--critical)',
  'Novice': 'var(--serious)',
  'Intermédiaire': 'var(--warning)',
  'Avancé': 'var(--series-2)',
  'Élite': 'var(--good)',
};

function LiftRow({ item }) {
  const pct = Math.min(100, Math.max(0, item.percentile));

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 className="card-title">{item.label}</h3>
          <p className="card-sub" style={{ margin: 0 }}>
            1RM estimé {item.one_rep_max_kg} kg · ×{item.ratio.toFixed(2)} du poids de corps
          </p>
          {item.confidence_note && (
            <p style={{
              fontSize: 11, margin: '4px 0 0',
              // Un 1RM extrapolé de loin mérite d'être signalé : le
              // percentile qui en découle hérite de son incertitude.
              color: item.confidence >= 0.9 ? 'var(--text-muted)' : 'var(--warning)',
            }}>
              {item.confidence < 0.9 && '▲ '}{item.confidence_note}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
            {Math.round(item.percentile)}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
              {' '}e
            </span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, marginTop: 3,
            color: LEVEL_COLORS[item.level] ?? 'var(--text-muted)',
          }}>
            {item.level}
          </div>
        </div>
      </div>

      {/* Position sur l'échelle : la barre porte le percentile, les
          repères marquent les paliers nommés. */}
      <div style={{ marginTop: 16, position: 'relative' }}>
        <div className="gauge" style={{ height: 10 }}>
          <div
            className="gauge-fill"
            style={{ width: `${pct}%`, background: LEVEL_COLORS[item.level] ?? 'var(--series-1)' }}
          />
        </div>
        <div style={{ position: 'relative', height: 18, marginTop: 2 }}>
          {item.ladder.map((l) => (
            <span
              key={l.level}
              title={`${l.level} — ${l.kg} kg`}
              style={{
                position: 'absolute',
                left: `${l.percentile}%`,
                transform: 'translateX(-50%)',
                fontSize: 10,
                color: l.reached ? 'var(--text-secondary)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {l.reached ? '✓' : '·'} {l.level.slice(0, 4)}
            </span>
          ))}
        </div>
      </div>

      <table className="data-table" style={{ marginTop: 14 }}>
        <caption className="visually-hidden">
          Charges par palier pour {item.label}
        </caption>
        <thead>
          <tr>
            <th scope="col">Palier</th>
            <th scope="col">Ratio</th>
            <th scope="col">Charge</th>
            <th scope="col">Atteint</th>
          </tr>
        </thead>
        <tbody>
          {item.ladder.map((l) => (
            <tr key={l.level} style={{ opacity: l.reached ? 1 : 0.55 }}>
              <th scope="row" style={{ fontWeight: 500 }}>{l.level}</th>
              <td>×{l.ratio.toFixed(2)}</td>
              <td>{l.kg} kg</td>
              <td>{l.reached ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {item.next_level ? (
        <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          <span style={{ color: 'var(--text-muted)' }}>Prochain palier — </span>
          <strong>{item.next_level.level}</strong>
          <span style={{ color: 'var(--text-muted)' }}> à </span>
          <strong>{item.next_level.kg} kg</strong>
          <span style={{ color: 'var(--text-muted)' }}>
            {' '}(+{item.next_level.delta_kg} kg)
          </span>
        </p>
      ) : (
        <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0, color: 'var(--good)' }}>
          Tous les paliers sont franchis sur ce mouvement.
        </p>
      )}
    </div>
  );
}

export default function BenchmarkPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.benchmark()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <p className="empty">Chargement du benchmark…</p>;

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2 className="card-title">Benchmark de force</h2>
        <p className="card-sub">
          Position parmi les pratiquants qui suivent leurs charges, à poids de
          corps égal
        </p>

        {data?.bodyweight_kg ? (
          <div className="stat-row" style={{ marginTop: 4 }}>
            <div className="stat">
              <div className="stat-label">Poids de corps</div>
              <div className="stat-value">
                {data.bodyweight_kg} <span className="stat-unit">kg</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Percentile moyen</div>
              <div className="stat-value">{data.average_percentile ?? '—'}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Mouvements couverts</div>
              <div className="stat-value">{data.covered_lifts}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Référence</div>
              <div className="stat-value" style={{ fontSize: 16, paddingTop: 6 }}>
                {data.sex === 'female' ? 'Femmes' : data.sex === 'male' ? 'Hommes' : 'Mixte'}
              </div>
            </div>
          </div>
        ) : (
          <p className="empty">{data?.note}</p>
        )}
      </div>

      {data?.items?.length === 0 && data?.bodyweight_kg && (
        <div className="card">
          <p className="empty">
            Aucun mouvement de référence enregistré. Loggue un développé couché,
            un squat, un soulevé de terre ou une traction pour te situer.
          </p>
        </div>
      )}

      {data?.items?.map((item) => <LiftRow key={item.lift} item={item} />)}

      {data?.items?.length > 0 && (
        <div className="card">
          <h3 className="card-title">Méthode</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Le 1RM est estimé par la formule d’Epley au-delà d’une répétition ;
            l’extrapolation est gelée au-delà de 12 répétitions, où elle cesse
            d’être fiable. Le percentile vient d’une loi log-normale calibrée sur
            les paliers ci-dessus, pas d’un comptage réel d’individus.
          </p>
          <ReferenceNote reference={data.reference} />
        </div>
      )}
    </div>
  );
}
