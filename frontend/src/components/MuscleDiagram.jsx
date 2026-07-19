import { useState } from 'react';
import BodyFigure from './BodyFigure.jsx';
import { muscleLabel, bestViewFor } from '../lib/anatomy.js';

/**
 * Schéma anatomique d'un exercice : quels muscles il sollicite.
 *
 * Trois états seulement — principal / secondaire / non sollicité. Une
 * échelle continue serait fausse : le dataset fournit une liste de
 * muscles secondaires, pas une pondération.
 */
export default function MuscleDiagram({
  primary,
  secondary = [],
  maxWidth = 210,
  showToggle = true,
}) {
  const all = [primary, ...secondary].filter(Boolean);
  const [view, setView] = useState(() => bestViewFor(all));
  const secondarySet = new Set(secondary);

  // Une région peut couvrir plusieurs muscles : le principal l'emporte
  // sur le secondaire, qui l'emporte sur l'inactif.
  const paint = (keys) => {
    if (keys.includes(primary)) return { fill: 'var(--series-1)', opacity: 1 };
    if (keys.some((k) => secondarySet.has(k))) {
      // Hiérarchie portée par l'opacité, pas par une seconde teinte :
      // une autre couleur se lirait comme une autre catégorie.
      return { fill: 'var(--series-1)', opacity: 0.4 };
    }
    return { fill: 'var(--surface-2)', opacity: 1 };
  };

  return (
    <div>
      <BodyFigure
        view={view}
        paint={paint}
        maxWidth={maxWidth}
        ariaLabel={
          `Muscles sollicités, vue de ${view === 'front' ? 'face' : 'dos'} : `
          + `${muscleLabel(primary)} en principal`
          + (secondary.length ? `, ${secondary.map(muscleLabel).join(', ')} en secondaire` : '')
        }
      />

      {showToggle && (
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
      )}

      {/* La couleur seule ne porte jamais l'information. */}
      <div className="legend" style={{ justifyContent: 'center', marginTop: 6 }}>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
          Principal
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{ background: 'var(--series-1)', opacity: 0.4 }}
          />
          Secondaire
        </span>
      </div>
    </div>
  );
}
