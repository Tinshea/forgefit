import { ICON_PATHS, ICON_VIEWBOX, ICON_NAMES } from '../lib/icons.js';

/**
 * Pictogrammes de l'interface.
 *
 * ┌─ POURQUOI PHOSPHOR PLUTÔT QUE MES TRACÉS ─────────────────────────┐
 * │ Les précédents étaient dessinés à la main : anguleux, cohérents   │
 * │ avec la direction artistique, mais franchement grossiers — un     │
 * │ nuage en polygone à huit côtés reste un polygone à huit côtés.    │
 * │                                                                    │
 * │ Phosphor est dessiné par des gens dont c'est le métier, sur une   │
 * │ grille commune, avec des jonctions et des épaisseurs réglées. La  │
 * │ graisse `fill` est pleine et massive : elle appartient au même    │
 * │ registre que le reste de l'interface, là où un jeu d'icônes en    │
 * │ traits fins jurerait.                                             │
 * │                                                                    │
 * │ Seuls les tracés employés sont repris (cf. generate-icons.mjs) :  │
 * │ la bibliothèque n'entre ni dans le lot ni dans l'image de         │
 * │ production, et l'interface ne dépend d'aucun paquet à l'exécution.│
 * └────────────────────────────────────────────────────────────────────┘
 */

export const GLYPHS = ICON_NAMES;

export default function Glyph({ name = 'app', size = 20, title }) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.inconnu;

  return (
    <svg
      className="glyph"
      width={size}
      height={size}
      viewBox={ICON_VIEWBOX}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
