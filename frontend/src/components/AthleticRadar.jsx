import { useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import ReferenceNote from './ReferenceNote.jsx';

/**
 * Radar athletique a 6 axes + rang global.
 *
 * Deux series : l'athlete et la mediane de population (50 partout, par
 * construction des standards -- un percentile 50 EST la mediane). La
 * reference donne une echelle de lecture : sans elle, un hexagone seul
 * ne dit pas si 60 est bon.
 */

const RANK_HINT = {
  S: '90–100', A: '80–89', B: '70–79', C: '60–69',
  D: '50–59', E: '40–49', F: '< 40',
};

function RadarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="legend-swatch"
            style={{ background: p.color }}
            aria-hidden="true"
          />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          <strong style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(p.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function AthleticRadar({ data }) {
  const [showTable, setShowTable] = useState(false);

  if (!data?.axes?.length) {
    return (
      <div className="card">
        <h2 className="card-title">Radar athlétique</h2>
        <p className="empty">Enregistre quelques séances pour afficher ton profil.</p>
      </div>
    );
  }

  const chartData = data.axes.map((a) => ({
    axis: a.label,
    score: a.score,
    median: 50,
  }));

  const rank = data.rank ?? 'F';

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Radar athlétique</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Percentile par axe · fenêtre {data.window_days} jours
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className={`rank-badge rank-${rank}`}>{rank}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {data.label} · {Math.round(data.overall)}/100
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <RadarChart data={chartData} outerRadius="72%">
            <PolarGrid stroke="var(--grid)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={5}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              angle={90}
            />
            <Radar
              name="Médiane de référence"
              dataKey="median"
              stroke="var(--series-2)"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive={false}
            />
            <Radar
              name="Toi"
              dataKey="score"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.28}
              isAnimationActive={false}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        className="table-toggle"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
      >
        {showTable ? 'Masquer' : 'Afficher'} les valeurs
      </button>

      {showTable && (
        <table className="data-table" style={{ marginTop: 10 }}>
          <caption className="visually-hidden">
            Score par axe athlétique, sur 100
          </caption>
          <thead>
            <tr><th scope="col">Axe</th><th scope="col">Score</th><th scope="col">Rang</th></tr>
          </thead>
          <tbody>
            {data.axes.map((a) => (
              <tr key={a.axis}>
                <th scope="row" style={{ fontWeight: 500 }}>{a.label}</th>
                <td>{a.score}</td>
                <td>{rankOf(a.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.mobility_breakdown && (
        <MobilityBreakdown data={data.mobility_breakdown} />
      )}

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        Rang {rank} : {RANK_HINT[rank]} points.
      </p>

      <ReferenceNote reference={data.reference} compact />
    </div>
  );
}

/**
 * La branche « Mobilité » du radar fusionne deux qualités distinctes.
 * On les détaille ici : mobilité = amplitude ACTIVE (sous contrôle),
 * souplesse = amplitude PASSIVE (étirement tenu). On peut être très
 * souple et peu mobile — c'est l'écart entre les deux qui informe.
 */
function MobilityBreakdown({ data }) {
  const rows = [
    { key: 'mobilite', label: 'Mobilité', hint: 'amplitude active', ...data.mobilite },
    { key: 'souplesse', label: 'Souplesse', hint: 'étirement tenu', ...data.souplesse },
  ];
  const gap = Math.abs(rows[0].score - rows[1].score);

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--grid)' }}>
      <div className="stat-label" style={{ marginBottom: 10 }}>
        Détail de la branche Mobilité
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((r) => (
          <div key={r.key}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 13, marginBottom: 5,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {r.label}
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>
                  {r.hint}
                </span>
              </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(r.score)}
              </strong>
            </div>
            <div className="gauge" style={{ height: 8 }}>
              <div
                className="gauge-fill"
                style={{
                  width: `${r.score}%`,
                  background: r.key === 'mobilite' ? 'var(--series-1)' : 'var(--series-2)',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {r.sessions_7d} séance{r.sessions_7d > 1 ? 's' : ''} · {r.minutes_7d} min sur 7 j
            </div>
          </div>
        ))}
      </div>

      {gap >= 25 && (
        <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 10, marginBottom: 0 }}>
          Écart de {Math.round(gap)} points :{' '}
          {rows[0].score < rows[1].score
            ? 'tu es plus souple que mobile — l’amplitude passive dépasse ce que tu contrôles activement.'
            : 'tu contrôles bien ton amplitude, mais elle reste limitée par la souplesse.'}
        </p>
      )}
    </div>
  );
}

function rankOf(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}
