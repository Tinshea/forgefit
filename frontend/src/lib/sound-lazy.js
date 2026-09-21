// Chargement différé du moteur de son.
//
// ┌─ POURQUOI CE FICHIER EXISTE ──────────────────────────────────────┐
// │ `sound.js` porte tout le moteur : table d'ondes, réverbération    │
// │ par convolution, répertoire. Rien de cela n'est utile avant le    │
// │ PREMIER GESTE — et les navigateurs interdisent de toute façon de  │
// │ jouer quoi que ce soit avant.                                     │
// │                                                                    │
// │ Ce module ne contient que le strict nécessaire pour décider s'il  │
// │ faut charger le reste : la lecture du réglage. Le moteur arrive   │
// │ au premier clic, en arrière-plan, et le son de ce clic-là est le  │
// │ seul à pouvoir être manqué.                                       │
// └────────────────────────────────────────────────────────────────────┘

const STORAGE_KEY = 'forgefit.sound';

export function isMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch { /* le réglage ne survivra pas au rechargement */ }
}

let enginePromise = null;
let engine = null;

/** Charge le moteur une seule fois, et seulement si le son est actif. */
function loadEngine() {
  if (engine) return Promise.resolve(engine);
  if (!enginePromise) {
    enginePromise = import('./sound.js')
      .then((m) => { engine = m; return m; })
      // Un moteur de son absent ne doit jamais casser une interface.
      .catch(() => null);
  }
  return enginePromise;
}

/**
 * Joue un son, en chargeant le moteur si besoin.
 *
 * Synchrone quand le moteur est déjà là — c'est le cas dès le second
 * geste, donc la latence ne se remarque qu'une fois.
 */
export function playLater(name, opts) {
  if (isMuted()) return;
  if (engine) { engine.play(name, opts); return; }
  loadEngine().then((m) => m?.play(name, opts));
}

/** Précharge le moteur sans rien jouer. */
export function warmUpLater() {
  if (isMuted()) return;
  loadEngine().then((m) => m?.warmUp());
}
