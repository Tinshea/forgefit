import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Adhérence : ce qui était prévu face à ce qui a été fait.
 *
 * L'application savait dire ce qu'on avait fait ; elle ne savait pas
 * dire ce qu'on avait RATÉ. C'est pourtant la seule information qui
 * explique une progression qui stagne : un programme parfait suivi une
 * fois sur deux vaut moins qu'un programme moyen suivi.
 */

const rateColor = (rate) => {
  if (rate == null) return 'var(--text-muted)';
  if (rate >= 90) return 'var(--good)';
  if (rate >= 70) return 'var(--series-1)';
  if (rate >= 40) return 'var(--warning)';
  return 'var(--critical)';
};

const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});

export default function AdherenceCard() {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    api.adherence(8)
      .then((d) => { setData(d); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  if (state !== 'ready') return null;

  // Sans programme actif, il n'y a rien à comparer : on l'explique au
  // lieu d'afficher un taux de 0 % qui ne voudrait rien dire.
  if (!data.program) {
    return (
      <div className="card">
        <h2 className="card-title">Adhérence</h2>
        <p className="card-sub" style={{ marginTop: 6, lineHeight: 1.6 }}>{data.note}</p>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="card-title">Adhérence</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {data.program.name} · depuis le {shortDate(data.program.starts_on)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 30, fontWeight: 700, lineHeight: 1,
            color: rateColor(s.rate), fontVariantNumeric: 'tabular-nums',
          }}>
            {s.rate == null ? '—' : `${s.rate} %`}
          </div>
          <div className="stat-label">{s.done}/{s.planned} séances</div>
        </div>
      </div>

      <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
        <strong style={{ color: rateColor(s.rate) }}>{s.verdict.label}</strong>
        {' — '}
        <span style={{ color: 'var(--text-secondary)' }}>{s.verdict.note}</span>
      </p>

      <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
        {data.weeks.map((w) => (
          <div key={w.week}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Semaine {w.week}
                <span style={{ color: 'var(--text-muted)' }}> · {shortDate(w.start)}</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {w.done}/{w.planned}
                {w.extra > 0 && ` · +${w.extra} hors plan`}
              </span>
            </div>
            <div className="gauge" style={{ height: 6 }}>
              <div
                className="gauge-fill"
                style={{
                  width: `${w.planned ? (w.done / w.planned) * 100 : 0}%`,
                  background: rateColor(w.rate),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="stat-row" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="stat-value">{s.streak}</div>
          <div className="stat-label">semaines pleines d’affilée</div>
        </div>
        <div className="stat">
          <div className="stat-value">{s.missed.length}</div>
          <div className="stat-label">séances manquées</div>
        </div>
        <div className="stat">
          <div className="stat-value">{s.extra}</div>
          <div className="stat-label">séances hors plan</div>
        </div>
      </div>

      {s.extra > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          Les séances « hors plan » sont des entraînements libres, ou rattachés à un
          autre jour du programme. Elles comptent dans ton volume réel, pas dans le
          suivi du plan.
        </p>
      )}
    </div>
  );
}
