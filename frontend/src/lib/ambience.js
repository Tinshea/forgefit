// Ambiance : phase du jour et temps qu'il fait.
//
// Deux attributs posés sur la racine du document, que la feuille de
// style lit pour habiller le fond. Aucun rendu ici — seulement l'état.
//
// La PHASE DU JOUR se calcule sur l'horloge locale et ne demande donc
// aucune permission ni aucun réseau : le fond change avec l'heure même
// si la météo n'est jamais activée.

export const DAYPARTS = ['aube', 'jour', 'crepuscule', 'nuit'];

export function daypartOf(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return 'nuit';
  if (h < 10) return 'aube';
  if (h < 18) return 'jour';
  if (h < 22) return 'crepuscule';
  return 'nuit';
}

export const DAYPART_LABELS = {
  aube: 'Petit matin',
  jour: 'Journée',
  crepuscule: 'Soirée',
  nuit: 'Nuit',
};

const root = () => document.documentElement;

export function setDaypart(part) {
  root().setAttribute('data-daypart', part);
}

export function setWeather(group) {
  if (group) root().setAttribute('data-weather', group);
  else root().removeAttribute('data-weather');
}

// --- Consentement et position ------------------------------------------
//
// La météo est la SEULE fonctionnalité de l'application qui sorte du
// réseau local. Elle ne s'active donc jamais d'elle-même, et la
// position est conservée en local, arrondie — le serveur l'arrondit une
// seconde fois avant de la transmettre.

const KEY = 'forgefit.weather';

export function readConsent() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveConsent(coords) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      // Deux décimales ≈ 1 km. Inutile d'en stocker davantage pour une
      // température, et c'est autant de précision qu'on ne conserve pas.
      lat: Math.round(coords.lat * 100) / 100,
      lon: Math.round(coords.lon * 100) / 100,
      at: Date.now(),
    }));
  } catch { /* stockage indisponible : la météo ne survivra pas au rechargement */ }
}

export function forgetConsent() {
  try { localStorage.removeItem(KEY); } catch { /* rien à oublier */ }
}

/** Demande la position au navigateur. Rejette si refusée ou indisponible. */
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Ce navigateur ne sait pas donner de position.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(
        err.code === 1
          ? 'Position refusée. La météo restera désactivée.'
          : 'Position indisponible.',
      )),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 },
    );
  });
}
