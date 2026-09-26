/**
 * Les quatre personnages du hub.
 *
 * ┌─ POURQUOI DESSINÉS À LA MAIN, ET ANGULEUX ────────────────────────┐
 * │ Un domaine de vie n'a pas de pictogramme évident : « Mental » ne  │
 * │ se réduit pas à un cerveau, « Social » pas à deux bonshommes.     │
 * │ Une FIGURE, elle, se retient — on finit par dire « le liseur »    │
 * │ ou « celui qui pousse », et c'est ce qu'on veut d'un repère.      │
 * │                                                                    │
 * │ Aplats, angles francs, aucune courbe molle : les personnages      │
 * │ obéissent à la même règle que le reste du dessin de              │
 * │ l'application, sans quoi ils auraient l'air collés.               │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Deux plans par figure : la SILHOUETTE, qui porte la lecture, et
 * l'ACCENT, une pièce claire qui dit de quoi il s'agit — la barre, les
 * ondes, le second visage, le livre. Les couleurs viennent du thème,
 * jamais d'ici : le hub est en laiton, un module pourrait s'en saisir
 * dans sa propre teinte.
 */

const FIGURES = {
  // Celui qui pousse : barre au-dessus de la tête, bras verrouillés.
  corps: {
    silhouette: [
      // Les bras encadrent la tête sans la toucher : dessinés à la même
      // hauteur et au même remplissage, ils fusionnaient avec elle et
      // la silhouette devenait une tache.
      'M30,34 L42,34 L46,84 L34,84 Z',
      'M78,34 L90,34 L86,84 L74,84 Z',
      'M60,52 m-14,0 a14,14 0 1,0 28,0 a14,14 0 1,0 -28,0',
      'M54,62 L66,62 L66,80 L54,80 Z',
      'M36,78 L84,78 L77,132 L43,132 Z',
    ],
    accent: ['M14,24 L106,24 L106,33 L14,33 Z', 'M9,19 L18,19 L18,38 L9,38 Z',
             'M102,19 L111,19 L111,38 L102,38 Z'],
  },

  // Le calme : tête de face, et ce qui monte au-dessus d'elle.
  //
  // Un profil aurait été plus expressif, mais tenu en aplat il n'était
  // qu'une tache : sans trait ni modelé, un nez et un menton ne se
  // distinguent pas. De face, la tête se lit tout de suite, et ce sont
  // les ondes qui portent le sens.
  mental: {
    silhouette: [
      'M60,66 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0',
      'M41,86 L79,86 L92,140 L28,140 Z',
    ],
    accent: [
      'M34,46 Q60,26 86,46',
      'M24,40 Q60,12 96,40',
      'M15,34 Q60,2 105,34',
    ],
    accentTrait: true,
  },

  // Les autres : trois figures, et ce qui les relie.
  //
  // Les deux compagnons étaient peints en laiton, comme des objets
  // tenus à bout de bras. Ce sont des GENS : ils passent en silhouette,
  // et l'accent ne garde que le lien, qui est le vrai sujet.
  social: {
    silhouette: [
      'M26,68 m-11,0 a11,11 0 1,0 22,0 a11,11 0 1,0 -22,0',
      'M6,90 L46,90 L42,124 L2,124 Z',
      'M94,68 m-11,0 a11,11 0 1,0 22,0 a11,11 0 1,0 -22,0',
      'M74,90 L114,90 L118,124 L78,124 Z',
      'M60,52 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0',
      'M38,76 L82,76 L92,140 L28,140 Z',
    ],
    // Une seule arche, qui passe AU-DESSUS des trois têtes. La
    // première rasait le crâne du milieu, et les deux traits de
    // liaison ajoutés en renfort ressemblaient à des rayures.
    accent: ['M14,58 Q60,4 106,58'],
    accentTrait: true,
  },

  // Le liseur : tête penchée, livre ouvert tenu devant.
  savoir: {
    silhouette: [
      'M60,40 m-14,0 a14,14 0 1,0 28,0 a14,14 0 1,0 -28,0',
      'M40,62 L80,62 L88,104 L32,104 Z',
    ],
    accent: [
      'M16,102 L58,92 L58,128 L16,134 Z',
      'M62,92 L104,102 L104,134 L62,128 Z',
    ],
  },
};

export const FIGURE_NAMES = Object.keys(FIGURES);

export default function Portrait({ figure, className }) {
  const f = FIGURES[figure];
  if (!f) return null;

  return (
    <svg
      className={className}
      viewBox="0 0 120 150"
      // Purement illustratif : le nom du domaine est écrit juste à côté,
      // et le répéter ici le ferait annoncer deux fois.
      aria-hidden="true"
      focusable="false"
    >
      <g className="portrait-silhouette">
        {f.silhouette.map((d, i) => <path key={`s-${i}`} d={d} />)}
      </g>
      <g className={f.accentTrait ? 'portrait-accent portrait-accent-trait' : 'portrait-accent'}>
        {f.accent.map((d, i) => <path key={`a-${i}`} d={d} />)}
      </g>
    </svg>
  );
}
