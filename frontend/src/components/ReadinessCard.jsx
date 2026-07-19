/**
 * Score de Readiness + decomposition.
 *
 * Le score seul serait opaque : on montre chaque signal et son poids
 * effectif, pour que l'utilisateur sache POURQUOI il est bas. Les poids
 * sont renormalises cote serveur sur les seuls capteurs disponibles.
 */

const CONTRIBUTION_LABELS = {
  recuperation: 'Récupération musculaire',
  sommeil: 'Sommeil',
  vfc: 'Variabilité cardiaque',
  fc_repos: 'FC de repos',
  hydratation: 'Hydratation',
  mobilite: 'Mobilité',
};

function barColor(value) {
  if (value >= 75) return 'var(--good)';
  if (value >= 50) return 'var(--warning)';
  if (value >= 30) return 'var(--serious)';
  return 'var(--critical)';
}

export default function ReadinessCard({ data }) {
  if (!data || data.score === null) {
    return (
      <div className="card">
        <h2 className="card-title">Readiness</h2>
        <p className="empty">
          {data?.note ?? 'Connecte une montre ou enregistre une séance pour activer le score.'}
        </p>
      </div>
    );
  }

  const { score, rank, label, contributions = [], signals = {} } = data;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Readiness</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Disponibilité à l’entraînement aujourd’hui
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {/* Le chiffre porte le sens ; la couleur du rang le renforce. */}
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
            {Math.round(score)}
          </div>
          <div className={`rank-${rank}`} style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
            {rank} · {label}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
        {contributions.map((c) => (
          <div key={c.label}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 13, marginBottom: 5,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                {CONTRIBUTION_LABELS[c.label] ?? c.label}
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                  ×{c.weight}
                </span>
              </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(c.value)}
              </strong>
            </div>
            <div className="gauge" style={{ height: 8 }}>
              <div
                className="gauge-fill"
                style={{ width: `${c.value}%`, background: barColor(c.value) }}
              />
            </div>
          </div>
        ))}
      </div>

      <dl
        style={{
          marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--grid)',
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13,
        }}
      >
        <Signal label="Sommeil" value={signals.sleep_hours} unit="h" />
        <Signal label="VFC" value={signals.hrv_ms} unit="ms" />
        <Signal label="FC repos" value={signals.resting_hr} unit="bpm" />
        <Signal label="Hydratation" value={signals.hydration_ml} unit="ml" />
      </dl>
    </div>
  );
}

function Signal({ label, value, unit }) {
  return (
    <div>
      <dt style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</dt>
      <dd style={{ margin: '2px 0 0', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
        {value == null ? '—' : `${value} ${unit}`}
      </dd>
    </div>
  );
}
