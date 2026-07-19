import { useMemo, useState } from 'react';
import BodyFigure from './BodyFigure.jsx';
import { muscleLabel } from '../lib/anatomy.js';

/**
 * Carte corporelle interactive (face / dos).
 *
 * Chaque région porte la clé `target` du dataset ("pectorals", "lats"…),
 * normalisée à l'ingestion : la jointure avec /api/stats/bodymap est
 * donc directe, sans table de correspondance intermédiaire.
 *
 * La coloration est une rampe SÉQUENTIELLE à teinte unique dont la
 * luminance croît depuis la surface : sur fond sombre, « non travaillé »
 * se confond avec le fond et la fatigue émerge. Monotonie vérifiée.
 */

/** Paliers de fatigue : la légende les reprend telle quelle. */
const BUCKETS = [
  { max: 0.0001, varName: '--fatigue-0', label: 'Non travaillé' },
  { max: 0.2, varName: '--fatigue-1', label: 'Très faible' },
  { max: 0.4, varName: '--fatigue-2', label: 'Faible' },
  { max: 0.6, varName: '--fatigue-3', label: 'Modérée' },
  { max: 0.8, varName: '--fatigue-4', label: 'Élevée' },
  { max: Infinity, varName: '--fatigue-5', label: 'Très élevée' },
];

const bucketOf = (fatigue) => BUCKETS.find((b) => (fatigue ?? 0) <= b.max) ?? BUCKETS[0];

export default function BodyMap({ data }) {
  const [view, setView] = useState('front');
  const [hovered, setHovered] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const byMuscle = useMemo(() => {
    const map = new Map();
    for (const m of data?.muscles ?? []) map.set(m.muscle, m);
    return map;
  }, [data]);

  // Une région couvrant plusieurs muscles prend la fatigue LA PLUS
  // ÉLEVÉE : sous-estimer une charge serait plus trompeur que
  // l'inverse sur une carte de récupération.
  const paint = (keys) => {
    const worst = Math.max(...keys.map((k) => byMuscle.get(k)?.fatigue ?? 0));
    return { fill: `var(${bucketOf(worst).varName})` };
  };

  // Le panneau de détail montre le muscle le plus chargé de la région.
  const active = hovered
    ? hovered
      .map((k) => byMuscle.get(k))
      .filter(Boolean)
      .sort((a, b) => b.fatigue - a.fatigue)[0] ?? null
    : null;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Charge musculaire</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Fatigue relative · décroissance sur 48 h
          </p>
        </div>
        <div className="tabs" role="tablist" aria-label="Vue du corps">
          <button
            type="button" role="tab" className="tab"
            aria-selected={view === 'front'} onClick={() => setView('front')}
          >
            Face
          </button>
          <button
            type="button" role="tab" className="tab"
            aria-selected={view === 'back'} onClick={() => setView('back')}
          >
            Dos
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <BodyFigure
          view={view}
          paint={paint}
          hoveredKeys={hovered}
          onHover={setHovered}
          interactive
          maxWidth={260}
          ariaLabel={`Carte de fatigue musculaire, vue de ${view === 'front' ? 'face' : 'dos'}`}
        />

        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          {active ? (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {muscleLabel(active.muscle)}
              </div>
              <dl style={{ margin: '10px 0 0', fontSize: 13, display: 'grid', gap: 6 }}>
                <Row label="Fatigue" value={`${Math.round(active.fatigue * 100)} %`} />
                <Row label="Volume 14 j" value={`${active.volume_14d.toLocaleString('fr-FR')} kg`} />
                <Row label="Séries" value={active.set_count} />
                <Row
                  label="Dernier travail"
                  value={active.hours_since != null ? `il y a ${active.hours_since} h` : '—'}
                />
              </dl>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Survole ou sélectionne un muscle pour le détail.
              {data?.trained_muscles
                ? ` ${data.trained_muscles} groupes travaillés sur 14 jours.`
                : ''}
            </p>
          )}
        </div>
      </div>

      <div className="legend" aria-hidden="true">
        {BUCKETS.map((b) => (
          <span className="legend-item" key={b.label}>
            <span className="legend-swatch" style={{ background: `var(${b.varName})` }} />
            {b.label}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="table-toggle"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
      >
        {showTable ? 'Masquer' : 'Afficher'} le tableau
      </button>

      {showTable && (
        <table className="data-table" style={{ marginTop: 10 }}>
          <caption className="visually-hidden">
            Fatigue et volume par groupe musculaire
          </caption>
          <thead>
            <tr>
              <th scope="col">Muscle</th>
              <th scope="col">Fatigue</th>
              <th scope="col">Volume 14 j</th>
              <th scope="col">Séries</th>
            </tr>
          </thead>
          <tbody>
            {(data?.muscles ?? []).map((m) => (
              <tr key={m.muscle}>
                <th scope="row" style={{ fontWeight: 500 }}>{muscleLabel(m.muscle)}</th>
                <td>{Math.round(m.fatigue * 100)} %</td>
                <td>{m.volume_14d.toLocaleString('fr-FR')} kg</td>
                <td>{m.set_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {value}
      </dd>
    </div>
  );
}
