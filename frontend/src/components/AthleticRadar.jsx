import { useState } from 'react';
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

/**
 * Le radar, tracé à la main.
 *
 * ┌─ POURQUOI SE PASSER DE LA BIBLIOTHÈQUE ───────────────────────────┐
 * │ Ce composant tirait `recharts` — 96 Ko compressés — pour dessiner │
 * │ un hexagone et deux polygones. Or il vit sur l'Aperçu, qui est la │
 * │ route par DÉFAUT sur grand écran : toute ouverture de             │
 * │ l'application payait cette bibliothèque, qu'on regarde le radar   │
 * │ ou non.                                                           │
 * │                                                                    │
 * │ Le tracé ci-dessous fait une soixantaine de lignes, n'ajoute rien │
 * │ au lot, et obéit à la direction artistique au lieu d'y résister.  │
 * │                                                                    │
 * │ `recharts` sert encore aux courbes de Tendances et de Santé, où   │
 * │ les échelles, les axes temporels et les infobulles justifient     │
 * │ leur poids — mais ces pages ne sont plus sur le chemin critique.  │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Les sommets partent du HAUT et tournent dans le sens horaire : c'est
 * la convention de lecture d'un radar, et l'inverse déroute.
 */
/** Marge du cadre, en unités du tracé. Latérale surtout : c'est là que
 *  les libellés débordent. */
const PAD = 62;
const PAD_Y = 10;

function RadarPlot({ axes, size = 300 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
  const n = axes.length;

  const point = (i, value) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const d = (Math.max(0, Math.min(100, value)) / 100) * r;
    return [cx + d * Math.cos(angle), cy + d * Math.sin(angle)];
  };

  const polygon = (values) => values
    .map((v, i) => point(i, v).map((c) => c.toFixed(1)).join(','))
    .join(' ');

  const scores = axes.map((a) => a.score);
  const median = axes.map(() => 50);

  return (
    <div className="radar-plot">
      {/* Le cadre déborde LATÉRALEMENT du tracé : les libellés sont
          ancrés à l'extérieur des sommets et s'étendent vers le bord.
          Avec un cadre carré collé au tracé, « Explosivité » et
          « Force Tirage » étaient coupés net. */}
      <svg
        viewBox={`${-PAD} ${-PAD_Y} ${size + PAD * 2} ${size + PAD_Y * 2}`}
        role="img"
        aria-label="Radar athlétique"
      >
        {/* Toile : quatre anneaux, un par tranche de 25 points. */}
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            className="radar-ring"
            points={polygon(axes.map(() => ring))}
          />
        ))}

        {/* Rayons vers chaque sommet. */}
        {axes.map((a, i) => {
          const [x, y] = point(i, 100);
          return <line key={a.axis} className="radar-spoke" x1={cx} y1={cy} x2={x} y2={y} />;
        })}

        <polygon className="radar-median" points={polygon(median)} />
        <polygon className="radar-score" points={polygon(scores)} />

        {axes.map((a, i) => {
          const [x, y] = point(i, 100);
          // Le libellé se pousse vers l'extérieur, et son ancrage suit
          // le côté : à gauche il s'aligne à droite, et inversement.
          const dx = x - cx;
          const lx = cx + dx * 1.16;
          const ly = cy + (y - cy) * 1.16;
          const anchor = Math.abs(dx) < 4 ? 'middle' : dx > 0 ? 'start' : 'end';
          return (
            <text
              key={`l-${a.axis}`}
              className="radar-label"
              x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
            >
              {a.label}
            </text>
          );
        })}

        {axes.map((a, i) => {
          const [x, y] = point(i, a.score);
          return <circle key={`p-${a.axis}`} className="radar-dot" cx={x} cy={y} r="3.5" />;
        })}
      </svg>

      <div className="legend" style={{ justifyContent: 'center' }}>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
          Toi
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-2)' }} />
          Médiane de référence
        </span>
      </div>
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

      <RadarPlot axes={data.axes} />

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
