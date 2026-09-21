import { useMemo, useState } from 'react';
import BodyFigure from './BodyFigure.jsx';
import { muscleLabel } from '../lib/anatomy.js';
import { dec } from '../lib/format.js';

/**
 * Ce qu'un programme travaille vraiment, muscle par muscle.
 *
 * ┌─ CE QUE CET ÉCRAN CORRIGE ────────────────────────────────────────┐
 * │ Une liste d'exercices ne dit pas ce qu'elle dose. « Jambes »      │
 * │ trois fois par semaine peut laisser les ischio-jambiers sous le   │
 * │ seuil d'entretien pendant que les fessiers dépassent le plafond   │
 * │ de récupération — et rien dans la liste ne le montre.             │
 * │                                                                    │
 * │ La silhouette répond d'un coup d'œil, la table répond en détail.  │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Les paliers de couleur sont ceux de la dose-réponse, pas une échelle
 * continue inventée : sous l'entretien, entretien, fenêtre d'adaptation,
 * volume haut, au-dessus du plafond.
 */

const LEVEL_STYLE = {
  // Le dosage normal se lit sur une rampe de TISSU : du saumon éteint
  // au saumon plein. C'est la couleur réelle du muscle, et l'intensité
  // dit la dose.
  'sous-entretien': { fill: 'var(--muscle)', opacity: 0.24, swatch: 0.24 },
  entretien: { fill: 'var(--muscle)', opacity: 0.5, swatch: 0.5 },
  adaptation: { fill: 'var(--muscle)', opacity: 1, swatch: 1 },
  // Au-delà, ce n'est plus « plus de saumon » : c'est un autre régime.
  // Une teinte de STATUT le dit, l'opacité ne le dirait pas — et elle
  // reste franchement distincte de la couleur du tissu.
  haut: { fill: 'var(--warning)', opacity: 0.85, swatch: 0.85 },
  plafond: { fill: 'var(--critical)', opacity: 0.95, swatch: 0.95 },
};

const LEGEND = [
  ['adaptation', 'Fenêtre d’adaptation'],
  ['entretien', 'Entretien'],
  ['sous-entretien', 'Sous l’entretien'],
  ['haut', 'Volume haut'],
  ['plafond', 'Au-dessus du plafond'],
];

export default function ProgramMuscleMap({ volume, title = 'Ce que ça travaille' }) {
  const [view, setView] = useState('front');
  const [hovered, setHovered] = useState(null);

  const byMuscle = useMemo(
    () => new Map((volume?.muscles ?? []).map((m) => [m.muscle, m])),
    [volume],
  );

  if (!volume?.muscles?.length) return null;

  // Une région couvre parfois plusieurs muscles : on retient le plus
  // sollicité, sinon un muscle bien dosé disparaîtrait derrière un
  // voisin qui ne l'est pas.
  const paint = (keys) => {
    const rows = keys.map((k) => byMuscle.get(k)).filter(Boolean);
    if (!rows.length) return { fill: 'var(--surface-2)', opacity: 1 };
    const top = rows.reduce((a, b) => (b.weekly_sets > a.weekly_sets ? b : a));
    const style = LEVEL_STYLE[top.level] ?? LEVEL_STYLE.entretien;
    return { fill: style.fill, opacity: style.opacity };
  };

  const thresholds = volume.thresholds ?? {};

  return (
    <div>
      <div className="stat-label" style={{ marginBottom: 8 }}>{title}</div>

      <div className="muscle-map">
        <div>
          <BodyFigure
            view={view}
            paint={paint}
            hoveredKeys={hovered ? [hovered] : null}
            maxWidth={210}
            animate
            ariaLabel={`Volume hebdomadaire par muscle, vue de ${view === 'front' ? 'face' : 'dos'}`}
          />
          <div className="tabs" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button
              type="button" className="tab" aria-selected={view === 'front'}
              onClick={() => setView('front')}
            >
              Face
            </button>
            <button
              type="button" className="tab" aria-selected={view === 'back'}
              onClick={() => setView('back')}
            >
              Dos
            </button>
          </div>
        </div>

        <div className="muscle-table-wrap">
          <table className="muscle-table">
            <thead>
              <tr>
                <th scope="col">Muscle</th>
                <th scope="col">Séries/sem.</th>
                <th scope="col">Jours</th>
                <th scope="col">Dosage</th>
              </tr>
            </thead>
            <tbody>
              {volume.muscles.map((m) => (
                <tr
                  key={m.muscle}
                  onMouseEnter={() => setHovered(m.muscle)}
                  onMouseLeave={() => setHovered(null)}
                  data-hot={hovered === m.muscle ? '' : undefined}
                >
                  <th scope="row">
                    <span
                      className="legend-swatch"
                      style={{
                        background: (LEVEL_STYLE[m.level] ?? LEVEL_STYLE.entretien).fill,
                        opacity: (LEVEL_STYLE[m.level] ?? LEVEL_STYLE.entretien).swatch,
                        marginRight: 7,
                      }}
                      aria-hidden="true"
                    />
                    {muscleLabel(m.muscle)}
                  </th>
                  <td>
                    <span className="num">{dec(m.weekly_sets)}</span>
                    {m.secondary_sets > 0 && (
                      // Un muscle qui n'atteint son volume qu'en
                      // accompagnement n'est pas entraîné, il est
                      // sollicité — le masquer donnerait un faux confort.
                      <span className="muscle-secondary">
                        {' '}dont {dec(m.secondary_sets)} en secondaire
                      </span>
                    )}
                  </td>
                  <td><span className="num">{m.sessions_per_week}</span></td>
                  <td>
                    <span className="muscle-verdict" data-level={m.level}>{m.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="legend" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {LEGEND.map(([level, label]) => (
          <span className="legend-item" key={level}>
            <span
              className="legend-swatch"
              style={{
                background: LEVEL_STYLE[level].fill,
                opacity: LEVEL_STYLE[level].swatch,
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {volume.warnings?.length > 0 && (
        <ul className="volume-warnings">
          {volume.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      <p className="muscle-method">
        Une série compte 1 pour le muscle principal et{' '}
        {dec(thresholds.secondary_weight ?? 0.4)} pour chaque muscle secondaire — même
        pondération que la carte de charge. Seuils : entretien à partir de{' '}
        {thresholds.maintenance ?? 6} séries, effet net à partir de{' '}
        {thresholds.minimum_effective ?? 10}, plafond de récupération vers{' '}
        {thresholds.maximum_recoverable ?? 22} (Schoenfeld, Ogborn &amp; Krieger, 2017).
      </p>
    </div>
  );
}
