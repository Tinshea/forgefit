// Vérifie la projection des tuiles.
//
//   npm run check:map
//
// Une erreur de projection ne casse rien visiblement : la carte
// s'affiche, les tuiles se chargent, et les pions sont simplement AU
// MAUVAIS ENDROIT. C'est exactement le genre de défaut qu'on ne voit
// pas — d'où ces contrôles sur des repères connus.

import {
  TILE, lonToX, latToY, xToLon, yToLat, visibleTiles, project, unproject,
  panBy, MAX_LAT,
} from '../src/lib/mercator.js';

let problems = 0;
const fail = (m) => { console.log(`  ÉCHEC  ${m}`); problems += 1; };
const ok = (m) => console.log(`  ok     ${m}`);
const near = (a, b, tol, m) => (Math.abs(a - b) <= tol ? ok(m) : fail(`${m} — ${a} vs ${b}`));

console.log('\n=== Repères connus ===');
{
  // Au zoom 0, le monde tient dans une tuile : son centre est en 0,5.
  near(lonToX(0, 0), 0.5, 1e-9, 'méridien de Greenwich au centre du plan');
  near(latToY(0, 0), 0.5, 1e-9, 'équateur au centre du plan');

  // Paris, zoom 12 : tuile 2074/1409 (vérifiable sur openstreetmap.org).
  const px = Math.floor(lonToX(2.3522, 12));
  const py = Math.floor(latToY(48.8566, 12));
  if (px === 2074 && py === 1409) ok('Paris tombe sur la tuile 2074/1409 au zoom 12');
  else fail(`Paris → ${px}/${py}, attendu 2074/1409`);

  // Hémisphère sud et ouest : les signes doivent suivre.
  if (lonToX(-70, 5) < lonToX(0, 5)) ok('une longitude ouest est à gauche');
  else fail('longitude ouest mal placée');
  if (latToY(-34, 5) > latToY(0, 5)) ok('une latitude sud est en bas');
  else fail('latitude sud mal placée');
}

console.log('\n=== Réversibilité ===');
{
  // Une projection non réversible décale les pions d'autant plus qu'on
  // zoome — et le défaut passe inaperçu aux faibles zooms.
  let worst = 0;
  for (const z of [3, 8, 12, 16, 19]) {
    for (const [lat, lon] of [[48.8566, 2.3522], [-33.8688, 151.2093], [64.14, -21.94], [0, 0]]) {
      worst = Math.max(
        worst,
        Math.abs(yToLat(latToY(lat, z), z) - lat),
        Math.abs(xToLon(lonToX(lon, z), z) - lon),
      );
    }
  }
  near(worst, 0, 1e-9, 'aller-retour exact à tous les zooms');
}

console.log('\n=== Bornes ===');
{
  // Mercator diverge aux pôles : sans bornage, la carte partirait à
  // l'infini au lieu de s'arrêter.
  const top = latToY(89.9, 4);
  const bornee = latToY(MAX_LAT, 4);
  near(top, bornee, 1e-9, 'au-delà de 85,05° la latitude est bornée');
  if (Number.isFinite(top)) ok('aucune valeur infinie près du pôle');
  else fail('la projection diverge au pôle');
}

console.log('\n=== Cadrage ===');
{
  const view = { lat: 48.8566, lon: 2.3522, zoom: 13 };
  const { tiles } = visibleTiles(view, 600, 400);

  // 600×400 sur des tuiles de 256 : au plus 4×3 tuiles.
  if (tiles.length >= 6 && tiles.length <= 12) ok(`${tiles.length} tuiles pour un cadre 600×400`);
  else fail(`${tiles.length} tuiles — hors de la plage attendue`);

  const span = 2 ** 13;
  if (tiles.every((t) => t.x >= 0 && t.x < span && t.y >= 0 && t.y < span)) {
    ok('aucune tuile hors du plan');
  } else fail('une tuile sort du plan');

  // Le centre de la vue doit retomber au centre du cadre.
  const c = project({ lat: view.lat, lon: view.lon }, view, 600, 400);
  near(c.left, 300, 1e-6, 'le centre géographique est au centre du cadre');
  near(c.top, 200, 1e-6, 'le centre géographique est au milieu en hauteur');

  // Projeter puis dé-projeter doit redonner le même point.
  const back = unproject({ left: 137, top: 291 }, view, 600, 400);
  const again = project(back, view, 600, 400);
  near(again.left, 137, 1e-6, 'projection et inverse se referment (x)');
  near(again.top, 291, 1e-6, 'projection et inverse se referment (y)');
}

console.log('\n=== Enroulement ===');
{
  // Le monde s'enroule : en faisant défiler vers l'est depuis le
  // 180e méridien, on doit retomber sur le premier, pas sur du vide.
  const east = panBy({ lat: 0, lon: 179.5, zoom: 4 }, -TILE * 4, 0, 400, 300);
  if (east.lon >= -180 && east.lon <= 180) ok(`la longitude s'enroule (${east.lon.toFixed(1)}°)`);
  else fail(`longitude hors bornes après défilement : ${east.lon}`);

  const north = panBy({ lat: 84, lon: 0, zoom: 4 }, 0, TILE * 6, 400, 300);
  if (north.lat <= MAX_LAT) ok('la latitude reste bornée vers le nord');
  else fail(`latitude hors bornes : ${north.lat}`);
}

console.log(problems ? `\n=== ${problems} PROBLÈME(S) ===` : '\n=== PROJECTION VALIDE ===');
process.exit(problems ? 1 : 0);
