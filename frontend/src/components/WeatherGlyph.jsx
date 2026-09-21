import Glyph from './Glyph.jsx';

/**
 * Pictogramme météo.
 *
 * Simple aiguillage du groupe météo vers une icône du jeu commun : les
 * icônes de temps n'ont aucune raison de venir d'ailleurs que le reste,
 * et un second jeu se serait vu au premier coup d'œil.
 */
const BY_GROUP = {
  clear: 'soleil',
  cloud: 'nuage',
  rain: 'pluie',
  snow: 'neige',
  fog: 'brume',
  storm: 'orage',
  unknown: 'inconnu',
};

export default function WeatherGlyph({ group = 'unknown', size = 18, title }) {
  return <Glyph name={BY_GROUP[group] ?? 'inconnu'} size={size} title={title} />;
}
