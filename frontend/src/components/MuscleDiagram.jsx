import { useMemo, useState } from 'react';
import BodyFigure from './BodyFigure.jsx';
import { muscleLabel, bestViewFor, FRONT_KEYS, BACK_KEYS } from '../lib/anatomy.js';

/**
 * Schéma anatomique d'un exercice : quels muscles il sollicite.
 *
 * Trois états seulement — principal / secondaire / non sollicité. Une
 * échelle continue serait fausse : le dataset fournit une liste de
 * muscles secondaires, pas une pondération.
 *
 * La liste sous la figure n'est pas décorative. La silhouette montre
 * OÙ ça travaille, la liste dit QUOI — un aplat bleu sur le torse ne
 * distingue pas le grand pectoral du dentelé antérieur. Survoler ou
 * activer une entrée fait clignoter la région correspondante, ce qui
 * relie les deux sans que personne ait à deviner.
 */
export default function MuscleDiagram({
  primary,
  secondary = [],
  maxWidth = 210,
  showToggle = true,
  showList = true,
}) {
  const all = useMemo(
    () => [primary, ...secondary].filter(Boolean),
    [primary, secondary],
  );
  const [view, setView] = useState(() => bestViewFor(all));
  const [hovered, setHovered] = useState(null);
  const secondarySet = new Set(secondary);

  // Une région peut couvrir plusieurs muscles : le principal l'emporte
  // sur le secondaire, qui l'emporte sur l'inactif.
  const paint = (keys) => {
    if (keys.includes(primary)) return { fill: 'var(--muscle)', opacity: 1 };
    if (keys.some((k) => secondarySet.has(k))) {
      // Hiérarchie portée par l'opacité, pas par une seconde teinte :
      // une autre couleur se lirait comme une autre catégorie.
      return { fill: 'var(--muscle)', opacity: 0.42 };
    }
    return { fill: 'var(--muscle-off)', opacity: 1 };
  };

  // Un muscle absent de la vue affichée ne s'allumera pas : on bascule
  // la figure plutôt que de laisser l'utilisateur devant une silhouette
  // inerte en croyant l'application cassée.
  const focus = (key) => {
    setHovered(key);
    if (!key) return;
    const onFront = FRONT_KEYS.has(key);
    const onBack = BACK_KEYS.has(key);
    if (onFront && !onBack) setView('front');
    else if (onBack && !onFront) setView('back');
  };

  const entries = [
    ...(primary ? [{ key: primary, role: 'principal' }] : []),
    ...secondary.map((key) => ({ key, role: 'secondaire' })),
  ];

  return (
    <div>
      <BodyFigure
        view={view}
        paint={paint}
        maxWidth={maxWidth}
        hoveredKeys={hovered ? [hovered] : null}
        animate
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

      {showList && entries.length > 0 && (
        <ul className="muscle-chips">
          {entries.map(({ key, role }) => (
            <li key={key}>
              <button
                type="button"
                className="muscle-chip"
                data-role={role}
                aria-pressed={hovered === key}
                onMouseEnter={() => focus(key)}
                onMouseLeave={() => focus(null)}
                onFocus={() => focus(key)}
                onBlur={() => focus(null)}
                onClick={() => focus(hovered === key ? null : key)}
              >
                <span className="muscle-chip-dot" aria-hidden="true" />
                {muscleLabel(key)}
                <span className="visually-hidden"> — {role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* La couleur seule ne porte jamais l'information. */}
      <div className="legend" style={{ justifyContent: 'center', marginTop: 8 }}>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--muscle)' }} />
          Principal
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{ background: 'var(--muscle)', opacity: 0.42 }}
          />
          Secondaire
        </span>
      </div>
    </div>
  );
}
