import { useState } from 'react';

/**
 * Énoncé de la base statistique.
 *
 * Un percentile affiché sans sa population de référence emprunte
 * l'autorité d'une mesure alors qu'il n'est qu'un modèle. Le repli est
 * fermé par défaut pour ne pas alourdir la lecture, mais l'avertissement
 * principal — « ce n'est pas un classement mondial » — reste toujours
 * visible, car c'est lui qui corrige le contresens.
 */
export default function ReferenceNote({ reference, compact = false }) {
  const [open, setOpen] = useState(false);
  if (!reference) return null;

  return (
    <div
      style={{
        marginTop: compact ? 10 : 16,
        paddingTop: 12,
        borderTop: '1px solid var(--grid)',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        Comparaison face aux <strong style={{ color: 'var(--text-secondary)' }}>
          {reference.label.toLowerCase()}
        </strong>.{' '}
        <span style={{ color: 'var(--warning)' }}>
          Ce n’est pas un classement mondial.
        </span>
      </p>

      <button
        type="button"
        className="table-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ marginTop: 6 }}
      >
        {open ? 'Masquer' : 'D’où vient ce chiffre ?'}
      </button>

      {open && (
        <div style={{ marginTop: 10, lineHeight: 1.6 }}>
          <Block title="Source">{reference.basis}</Block>
          <Block title="Modèle">{reference.model}</Block>

          <Block title="Biais connus">
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {reference.biases.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </Block>

          <Block title="Portée">
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              {reference.caveat}
            </p>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {reference.useful_for.map((u) => <li key={u}>{u}</li>)}
            </ul>
          </Block>
        </div>
      )}
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        textTransform: 'uppercase', letterSpacing: '0.04em',
        fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600,
      }}>
        {title}
      </div>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}
