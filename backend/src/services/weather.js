// Météo — interprétation, pas récupération.
//
// ┌─ CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────┐
// │ Aucun appel réseau ici. Le fichier ne contient que la traduction  │
// │ des codes météo et ce qu'ils impliquent pour l'entraînement, ce   │
// │ qui le rend testable sans réseau ni base.                         │
// │                                                                    │
// │ La récupération vit dans `routes/weather.js`, côté SERVEUR et non │
// │ dans le navigateur — voir le commentaire là-bas pour la raison,   │
// │ qui est une raison de vie privée.                                 │
// └────────────────────────────────────────────────────────────────────┘

/**
 * Codes WMO 4677, tels que les publie Open-Meteo.
 *
 * `outdoor` dit si une séance dehors reste raisonnable. Ce n'est pas un
 * interdit : c'est ce que l'interface affiche pour qu'on décide en
 * connaissance de cause plutôt que de le découvrir dehors.
 */
export const WEATHER_CODES = {
  0: { label: 'Ciel dégagé', icon: '☀', group: 'clear', outdoor: true },
  1: { label: 'Peu nuageux', icon: '🌤', group: 'clear', outdoor: true },
  2: { label: 'Partiellement nuageux', icon: '⛅', group: 'cloud', outdoor: true },
  3: { label: 'Couvert', icon: '☁', group: 'cloud', outdoor: true },
  45: { label: 'Brouillard', icon: '🌫', group: 'fog', outdoor: false },
  48: { label: 'Brouillard givrant', icon: '🌫', group: 'fog', outdoor: false },
  51: { label: 'Bruine légère', icon: '🌦', group: 'rain', outdoor: true },
  53: { label: 'Bruine', icon: '🌦', group: 'rain', outdoor: true },
  55: { label: 'Bruine dense', icon: '🌧', group: 'rain', outdoor: false },
  56: { label: 'Bruine verglaçante', icon: '🌧', group: 'rain', outdoor: false },
  57: { label: 'Bruine verglaçante dense', icon: '🌧', group: 'rain', outdoor: false },
  61: { label: 'Pluie faible', icon: '🌦', group: 'rain', outdoor: true },
  63: { label: 'Pluie', icon: '🌧', group: 'rain', outdoor: false },
  65: { label: 'Pluie forte', icon: '🌧', group: 'rain', outdoor: false },
  66: { label: 'Pluie verglaçante', icon: '🌧', group: 'rain', outdoor: false },
  67: { label: 'Pluie verglaçante forte', icon: '🌧', group: 'rain', outdoor: false },
  71: { label: 'Neige faible', icon: '🌨', group: 'snow', outdoor: true },
  73: { label: 'Neige', icon: '🌨', group: 'snow', outdoor: false },
  75: { label: 'Neige forte', icon: '❄', group: 'snow', outdoor: false },
  77: { label: 'Grains de neige', icon: '🌨', group: 'snow', outdoor: false },
  80: { label: 'Averses faibles', icon: '🌦', group: 'rain', outdoor: true },
  81: { label: 'Averses', icon: '🌧', group: 'rain', outdoor: false },
  82: { label: 'Averses violentes', icon: '⛈', group: 'rain', outdoor: false },
  85: { label: 'Averses de neige', icon: '🌨', group: 'snow', outdoor: false },
  86: { label: 'Averses de neige fortes', icon: '❄', group: 'snow', outdoor: false },
  95: { label: 'Orage', icon: '⛈', group: 'storm', outdoor: false },
  96: { label: 'Orage et grêle', icon: '⛈', group: 'storm', outdoor: false },
  99: { label: 'Orage et forte grêle', icon: '⛈', group: 'storm', outdoor: false },
};

export const describeCode = (code) => WEATHER_CODES[code]
  ?? { label: 'Conditions inconnues', icon: '•', group: 'unknown', outdoor: true };

/**
 * Références des seuils d'entraînement par temps chaud ou froid.
 *
 * Comme partout ailleurs dans cette application : un seuil sans sa
 * source n'est qu'une opinion.
 */
export const REFERENCES = {
  heat: {
    citation: 'Racinais S et al. (2015), Consensus recommendations on training '
      + 'and competing in the heat. Scand J Med Sci Sports 25(S1):6-19.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25943653/',
  },
  hydration: {
    citation: 'Sawka MN et al. (2007), ACSM Position Stand: Exercise and Fluid '
      + 'Replacement. Med Sci Sports Exerc 39(2):377-390.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/17277604/',
  },
  cold: {
    citation: 'Castellani JW & Tipton MJ (2016), Cold Stress Effects on Exposure '
      + 'Tolerance and Exercise Performance. Compr Physiol 6(1):443-469.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26756640/',
  },
};

/**
 * Ce que le temps change à la séance du jour.
 *
 * ┌─ CE QUI EST DIT, ET CE QUI NE L'EST PAS ──────────────────────────┐
 * │ On SIGNALE, on ne décide pas. Aucun objectif n'est modifié en     │
 * │ silence — surtout pas la cible d'hydratation, qui est calculée    │
 * │ ailleurs sur le poids et la durée d'entraînement. Changer un      │
 * │ chiffre sans le dire serait pire qu'utile : on ne saurait plus    │
 * │ d'où il vient.                                                    │
 * │                                                                    │
 * │ La température RESSENTIE prime sur la température brute : à       │
 * │ l'effort, c'est l'humidité et le vent qui décident si le corps    │
 * │ arrive à évacuer sa chaleur.                                      │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * @returns {Array<{level, text, source}>}
 */
export function trainingNotes({
  apparent, temperature, windKmh, precipitationMm, code, isDay,
} = {}) {
  const notes = [];
  const feels = apparent ?? temperature;
  const { group, outdoor, label } = describeCode(code);

  if (feels != null && feels >= 30) {
    notes.push({
      level: 'alerte',
      text: `${Math.round(feels)} °C ressentis : la capacité d’endurance chute `
        + 'nettement au-dessus de 30 °C. Décale la séance tôt le matin ou en '
        + 'soirée, allonge les récupérations et bois davantage.',
      source: REFERENCES.heat.citation,
    });
  } else if (feels != null && feels >= 25) {
    notes.push({
      level: 'attention',
      text: `${Math.round(feels)} °C ressentis : prévois plus à boire qu’à `
        + 'l’habitude et n’attends pas d’avoir soif.',
      source: REFERENCES.hydration.citation,
    });
  } else if (feels != null && feels <= 0) {
    notes.push({
      level: 'attention',
      text: `${Math.round(feels)} °C ressentis : échauffement plus long, et `
        + 'couvre les extrémités. Le froid réduit la force disponible et la '
        + 'coordination fine.',
      source: REFERENCES.cold.citation,
    });
  }

  if (windKmh != null && windKmh >= 30) {
    notes.push({
      level: 'info',
      text: `Vent à ${Math.round(windKmh)} km/h : une sortie vélo coûtera bien `
        + 'plus cher que la distance ne le laisse croire. Juge à l’effort, pas '
        + 'à la vitesse.',
    });
  }

  if (!outdoor) {
    notes.push({
      level: group === 'storm' ? 'alerte' : 'info',
      text: group === 'storm'
        ? `${label} : aucune séance dehors, y compris sous un abri léger.`
        : `${label} : une séance dehors est compromise. Bascule en salle ou `
          + 'décale.',
    });
  } else if (precipitationMm > 0 && precipitationMm < 1) {
    notes.push({
      level: 'info',
      text: 'Quelques gouttes seulement : rien qui empêche de sortir.',
    });
  }

  if (isDay === false) {
    notes.push({
      level: 'info',
      text: 'Il fait nuit : pense à être visible si tu sors courir ou rouler.',
    });
  }

  return notes;
}

/**
 * Phase du jour, pour l'ambiance visuelle.
 *
 * ┌─ LE PIÈGE DE `Number(null)` ──────────────────────────────────────┐
 * │ `Number(null)` vaut 0, et `Number('')` aussi. Un simple test      │
 * │ `Number.isFinite` les laisse donc passer, et une heure MANQUANTE  │
 * │ devenait minuit — soit « Nuit » affiché en plein midi.            │
 * │                                                                    │
 * │ Le cas se produisait pour de vrai : la route dérive l'heure d'une │
 * │ chaîne d'horodatage, et une réponse sans horodatage donnait une   │
 * │ chaîne vide. On rejette donc l'absence AVANT de convertir.        │
 * └────────────────────────────────────────────────────────────────────┘
 */
export function daypartOf(hour) {
  if (hour == null || hour === '') return 'jour';
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) return 'jour';
  if (h < 6) return 'nuit';
  if (h < 10) return 'aube';
  if (h < 18) return 'jour';
  if (h < 22) return 'crepuscule';
  return 'nuit';
}

export const DAYPARTS = {
  aube: { label: 'Petit matin' },
  jour: { label: 'Journée' },
  crepuscule: { label: 'Soirée' },
  nuit: { label: 'Nuit' },
};
