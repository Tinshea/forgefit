import { useEffect, useState } from 'react';

/**
 * Effet de changement d'écran.
 *
 * ┌─ POURQUOI UN COMPOSANT ET PLUS UN PSEUDO-ÉLÉMENT ─────────────────┐
 * │ La première version vivait dans `.page-enter::before`. Une lame   │
 * │ de 38 % de large, translatée de 140 %.                            │
 * │                                                                    │
 * │ Or `translateX` en pourcentage se calcule sur la largeur de       │
 * │ L'ÉLÉMENT, pas sur celle de l'écran : 140 % de 38 % font 53 % de  │
 * │ l'écran. La lame finissait donc sa course EN PLEIN MILIEU, et le  │
 * │ remplissage `forwards` l'y figeait — un bandeau rouge posé en     │
 * │ travers de l'écran, définitivement.                               │
 * │                                                                    │
 * │ Les distances sont désormais en `vw`, où il n'y a rien à          │
 * │ interpréter. Et l'effet se démonte tout seul : plus rien ne peut  │
 * │ rester à l'écran, même si une animation échoue.                   │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Le registre vient des jeux Atlus : une lame qui balaie, une pluie
 * d'étincelles, et l'écran qui plonge vers l'avant.
 */

/** Durée totale, au-delà de laquelle l'effet se retire du DOM. */
const LIFETIME_MS = 700;

/** Étincelles : positions figées, pour que l'effet soit reproductible. */
const SPARKS = [
  { top: 18, left: 12, size: 26, delay: 40, spin: -25 },
  { top: 64, left: 22, size: 16, delay: 110, spin: 30 },
  { top: 34, left: 38, size: 34, delay: 0, spin: 12 },
  { top: 78, left: 47, size: 20, delay: 160, spin: -18 },
  { top: 12, left: 58, size: 22, delay: 90, spin: 22 },
  { top: 52, left: 69, size: 30, delay: 50, spin: -12 },
  { top: 84, left: 78, size: 15, delay: 190, spin: 28 },
  { top: 26, left: 88, size: 24, delay: 130, spin: -20 },
];

export default function RouteFx({ token }) {
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    setAlive(true);
    const t = setTimeout(() => setAlive(false), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [token]);

  if (!alive) return null;

  return (
    // Purement décoratif : hors du pointeur, et invisible aux lecteurs
    // d'écran, qui annoncent déjà le changement de page par le titre.
    //
    // La CLÉ est indispensable : sans elle, une seconde navigation
    // survenant pendant que la lame passe réutiliserait les mêmes nœuds
    // du DOM, et l'animation ne rejouerait pas. On navigue justement
    // vite entre onglets voisins — c'est le cas le plus fréquent.
    <div className="routefx" aria-hidden="true" key={token}>
      <span className="routefx-blade" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="routefx-spark"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}ms`,
            '--spin': `${s.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
