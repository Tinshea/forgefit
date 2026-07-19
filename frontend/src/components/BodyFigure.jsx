import { useId } from 'react';
import {
  FRONT, BACK, DECOR, VIEWBOX, muscleLabel,
} from '../lib/anatomy.js';

/**
 * Rendu du mannequin anatomique, partagé par la heatmap et les fiches.
 *
 * Les tracés viennent de react-muscle-highlighter (MIT) — voir
 * `lib/anatomy.js`. Le relief vient de trois couches superposées :
 * décor (tête, mains, pieds) sous les muscles, muscles porteurs de la
 * donnée, puis un dégradé de volume par-dessus.
 *
 * Une région peut correspondre à PLUSIEURS muscles de notre catalogue
 * quand le modèle source ne les sépare pas. `paint` reçoit donc la liste
 * des clés et décide, ce qui laisse à l'appelant le soin d'agréger comme
 * il l'entend (maximum pour une fatigue, priorité pour un surlignage).
 */
export default function BodyFigure({
  view = 'front',
  paint,
  onHover,
  hoveredKeys = null,
  interactive = false,
  maxWidth = 300,
  ariaLabel,
}) {
  // Identifiants de dégradé uniques par instance : deux figures sur la
  // même page partageraient sinon leurs `defs`.
  const uid = useId().replace(/:/g, '');
  const regions = view === 'front' ? FRONT : BACK;
  const decor = DECOR[view];
  // Un cadre par vue : les deux figures n'occupent pas la même zone du
  // canevas d'origine. Un cadre unique rognait la vue de dos à gauche.
  const box = VIEWBOX[view];
  const isHovered = (keys) => !!hoveredKeys && keys.some((k) => hoveredKeys.includes(k));

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      style={{ width: '100%', maxWidth, height: 'auto', display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={ariaLabel ?? `Silhouette anatomique, vue de ${view === 'front' ? 'face' : 'dos'}`}
    >
      <defs>
        {/* Volume : lumière venant du haut-gauche, comme une planche
            d'anatomie. En superposition, il fonctionne quelle que soit
            la couleur de données en dessous. */}
        <linearGradient id={`vol-${uid}`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.26" />
        </linearGradient>
      </defs>

      {/* 1. Décor : tête, cou, mains, pieds — jamais interactif */}
      <g fill="var(--surface-3)" stroke="var(--axis)" strokeWidth="1.5" aria-hidden="true">
        {decor.map((d, i) => <path key={`d-${i}`} d={d} />)}
      </g>

      {/* 2. Muscles — porteurs de la donnée */}
      <g strokeLinejoin="round">
        {regions.map((region, i) => {
          const { fill, opacity = 1 } = paint(region.keys) ?? {};
          const hot = isHovered(region.keys);
          return (
            <path
              key={`m-${i}`}
              d={region.d}
              fill={fill}
              fillOpacity={opacity}
              stroke={hot ? 'var(--text-primary)' : 'var(--plane)'}
              strokeWidth={hot ? 4 : 1.5}
              style={interactive
                ? { cursor: 'pointer', transition: 'stroke 120ms ease' }
                : undefined}
              onMouseEnter={interactive ? () => onHover?.(region.keys) : undefined}
              onMouseLeave={interactive ? () => onHover?.(null) : undefined}
              onFocus={interactive ? () => onHover?.(region.keys) : undefined}
              onBlur={interactive ? () => onHover?.(null) : undefined}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : undefined}
              aria-label={interactive
                ? region.keys.map(muscleLabel).join(' / ')
                : undefined}
            >
              <title>{region.keys.map(muscleLabel).join(' / ')}</title>
            </path>
          );
        })}
      </g>

      {/* 3. Volume — décoratif, jamais porteur de sens */}
      <g pointerEvents="none" aria-hidden="true">
        {regions.map((region, i) => (
          <path key={`v-${i}`} d={region.d} fill={`url(#vol-${uid})`} />
        ))}
      </g>
    </svg>
  );
}
