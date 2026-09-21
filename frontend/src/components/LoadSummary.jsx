import { dec } from '../lib/format.js';

/**
 * Charge d'entraînement de la fenêtre : volume, uniformité, tendance.
 *
 * Trois chiffres qui n'existaient nulle part, parce que l'application
 * ne savait compter que des séries. Une semaine de vélo et de foot n'y
 * laissait aucune trace.
 */

const BAR_DAYS = 28;

export default function LoadSummary({ data, categories = [] }) {
  if (!data) return null;

  const labels = Object.fromEntries(
    categories.map((c) => [c.key, { label: c.label, icon: c.icon }]),
  );
  const days = (data.days ?? []).slice(-BAR_DAYS);
  const peak = days.reduce((m, d) => Math.max(m, d.load), 0);
  const week = data.week ?? {};
  const acwr = data.acwr ?? {};

  return (
    <div className="card">
      <h2 className="card-title">Charge d’entraînement</h2>
      <p className="card-sub">
        {data.sessions} séance{data.sessions > 1 ? 's' : ''} sur la période ·
        {' '}toutes disciplines
      </p>

      <div className="stat-row" style={{ marginTop: 4 }}>
        <div className="stat">
          <div className="stat-label">Semaine écoulée</div>
          <div className="stat-value">
            {week.weekly_load ?? 0} <span className="stat-unit">AU</span>
          </div>
          <div className="stat-foot">RPE × minutes</div>
        </div>
        <div className="stat">
          <div className="stat-label">Monotonie</div>
          <div
            className="stat-value"
            style={{
              color: week.monotony > (data.monotony_ceiling ?? 2)
                ? 'var(--warning)' : undefined,
            }}
          >
            {week.monotony == null ? '—' : dec(week.monotony)}
          </div>
          <div className="stat-foot">
            {week.monotony > (data.monotony_ceiling ?? 2)
              ? 'Semaine trop uniforme'
              : 'Alternance dur / facile'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Tendance</div>
          <div className="stat-value">
            {acwr.ratio == null ? '—' : dec(acwr.ratio)}
          </div>
          <div className="stat-foot">{acwr.trend ?? 'base insuffisante'}</div>
        </div>
      </div>

      {days.length > 0 && (
        <div className="load-bars" role="img" aria-label={`Charge des ${days.length} derniers jours`}>
          {days.map((d) => (
            <span
              key={d.date}
              className="load-bar"
              title={`${d.date} : ${d.load} AU`}
            >
              <span
                className="load-bar-fill"
                style={{ height: peak > 0 ? `${(d.load / peak) * 100}%` : '0%' }}
              />
            </span>
          ))}
        </div>
      )}

      {acwr.note && <p className="load-note">{acwr.note}</p>}

      {week.monotony > (data.monotony_ceiling ?? 2) && (
        <p className="load-note">
          Au-delà de {dec(data.monotony_ceiling)}, Foster recommandait de varier :
          alterner journées dures et journées faciles plutôt que de tout niveler.
          C’est l’uniformité, autant que le volume, qu’il associait aux pépins.
        </p>
      )}

      {data.unrated_sessions > 0 && (
        <p className="load-note">
          {data.unrated_sessions} séance{data.unrated_sessions > 1 ? 's' : ''} sans
          ressenti noté ne compte{data.unrated_sessions > 1 ? 'nt' : ''} pas ici :
          une donnée manquante n’est pas un effort nul.
        </p>
      )}

      {(data.by_category ?? []).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>Répartition</div>
          <div className="split-bar">
            {data.by_category.map((c, i) => (
              <span
                key={c.category}
                className="split-seg"
                style={{ width: `${c.share}%`, background: `var(--cat-${i % 6})` }}
                title={`${labels[c.category]?.label ?? c.category} : ${dec(c.share)} %`}
              />
            ))}
          </div>
          <ul className="split-legend">
            {data.by_category.map((c, i) => (
              <li key={c.category}>
                <span className="legend-swatch" style={{ background: `var(--cat-${i % 6})` }} />
                {labels[c.category]?.icon} {labels[c.category]?.label ?? c.category}
                <span className="split-share">{dec(c.share)} %</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
