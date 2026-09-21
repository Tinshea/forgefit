// Projection de Mercator sphérique — celle des tuiles web.
//
// ┌─ POURQUOI ÉCRIRE CES QUINZE LIGNES PLUTÔT QU'IMPORTER LEAFLET ────┐
// │ Leaflet est excellent, et c'est précisément le problème : il      │
// │ apporte son propre DOM, sa propre feuille de style et son propre  │
// │ vocabulaire visuel, qu'il faudrait ensuite défaire pièce par      │
// │ pièce pour le faire entrer dans cette direction artistique.       │
// │                                                                    │
// │ Or tout ce dont on a besoin tient en quatre fonctions : passer    │
// │ d'une longitude à une abscisse de tuile, et retour. Les écrire    │
// │ coûte moins que de dompter une bibliothèque, se teste sans        │
// │ navigateur, et n'ajoute aucune dépendance à une application qui   │
// │ doit rester auto-hébergeable et hors ligne.                       │
// └────────────────────────────────────────────────────────────────────┘

/** Côté d'une tuile, en pixels. Standard de fait du web. */
export const TILE = 256;

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Longitude → abscisse, en tuiles (fractionnaire). */
export const lonToX = (lon, z) => ((lon + 180) / 360) * 2 ** z;

/**
 * Latitude → ordonnée, en tuiles.
 *
 * `asinh(tan(φ))` est la forme compacte de `ln(tan φ + sec φ)`, qui est
 * l'intégrale de la sécante — le cœur de Mercator. Elle diverge aux
 * pôles, d'où le bornage à ±85,0511° : la latitude où la carte devient
 * carrée, et la limite retenue par toutes les cartes en tuiles.
 */
export const MAX_LAT = 85.05112878;

export function latToY(lat, z) {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return ((1 - Math.asinh(Math.tan(rad(clamped))) / Math.PI) / 2) * 2 ** z;
}

/** Abscisse de tuile → longitude. */
export const xToLon = (x, z) => (x / 2 ** z) * 360 - 180;

/** Ordonnée de tuile → latitude. */
export const yToLat = (y, z) => deg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))));

/**
 * Tuiles visibles pour une vue donnée.
 *
 * @param {object} view  {lat, lon, zoom}
 * @param {number} width  largeur du cadre, en pixels
 * @param {number} height hauteur du cadre, en pixels
 * @returns {{tiles: Array<{x,y,z,left,top,key}>, centerPx: {x,y}}}
 */
export function visibleTiles({ lat, lon, zoom }, width, height) {
  const z = Math.round(zoom);
  const span = 2 ** z;

  // Centre de la vue, en pixels du plan entier.
  const cx = lonToX(lon, z) * TILE;
  const cy = latToY(lat, z) * TILE;

  // Coin haut-gauche de la vue, dans le même repère.
  const originX = cx - width / 2;
  const originY = cy - height / 2;

  const firstX = Math.floor(originX / TILE);
  const firstY = Math.floor(originY / TILE);
  const lastX = Math.floor((originX + width) / TILE);
  const lastY = Math.floor((originY + height) / TILE);

  const tiles = [];
  for (let ty = firstY; ty <= lastY; ty += 1) {
    // Hors du plan verticalement : il n'existe rien au-dessus du pôle.
    if (ty < 0 || ty >= span) continue;
    for (let tx = firstX; tx <= lastX; tx += 1) {
      // Le monde s'enroule horizontalement : à droite du dernier
      // méridien, on retombe sur le premier. Sans ce modulo, la carte
      // se terminerait par du vide en faisant défiler vers l'est.
      const wrapped = ((tx % span) + span) % span;
      tiles.push({
        x: wrapped,
        y: ty,
        z,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
        key: `${z}/${wrapped}/${ty}/${tx}`,
      });
    }
  }

  return { tiles, centerPx: { x: cx, y: cy } };
}

/** Position d'un point géographique dans le cadre, en pixels. */
export function project({ lat, lon }, view, width, height) {
  const z = Math.round(view.zoom);
  const cx = lonToX(view.lon, z) * TILE;
  const cy = latToY(view.lat, z) * TILE;
  return {
    left: lonToX(lon, z) * TILE - cx + width / 2,
    top: latToY(lat, z) * TILE - cy + height / 2,
  };
}

/** Coordonnées géographiques d'un point du cadre. */
export function unproject({ left, top }, view, width, height) {
  const z = Math.round(view.zoom);
  const cx = lonToX(view.lon, z) * TILE;
  const cy = latToY(view.lat, z) * TILE;
  return {
    lon: xToLon((cx + left - width / 2) / TILE, z),
    lat: yToLat((cy + top - height / 2) / TILE, z),
  };
}

/** Décalage de la vue de `dx`, `dy` pixels. */
export function panBy(view, dx, dy, width, height) {
  const center = unproject({ left: width / 2 - dx, top: height / 2 - dy }, view, width, height);
  return {
    ...view,
    lat: Math.max(-MAX_LAT, Math.min(MAX_LAT, center.lat)),
    // La longitude s'enroule : au-delà de 180°, on repart de −180.
    lon: ((((center.lon + 180) % 360) + 360) % 360) - 180,
  };
}
