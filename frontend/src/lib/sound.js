// Moteur de sons d'interface.
//
// ┌─ POURQUOI TOUT EST SYNTHÉTISÉ ────────────────────────────────────┐
// │ 1. LICENCE. Un bruitage trouvé en ligne est rarement libre de     │
// │    droits pour de bon, et un son extrait d'un jeu ne l'est        │
// │    jamais. Synthétiser, c'est créer.                              │
// │ 2. HORS LIGNE. Zéro octet téléchargé : tout naît de l'oscillateur │
// │    du navigateur au moment où le son est joué.                    │
// │ 3. POIDS. Une poignée de WAV pèserait plus que tout le bundle.    │
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ CE QUI MANQUAIT À LA PREMIÈRE VERSION ───────────────────────────┐
// │ Elle empilait un oscillateur et un bruit, et c'était tout. Quatre │
// │ défauts, dans l'ordre où l'oreille les remarque :                 │
// │                                                                    │
// │ — AUCUNE VARIATION. Deux clics produisaient exactement le même    │
// │   signal. Rien ne fatigue plus vite : le cerveau repère la        │
// │   répétition parfaite et la classe comme un défaut.               │
// │                                                                    │
// │ — AUCUN ESPACE. Sans réverbération, un son est collé au           │
// │   haut-parleur. Une queue de 300 ms suffit à le poser dans une    │
// │   pièce.                                                           │
// │                                                                    │
// │ — AUCUNE LARGEUR. Tout au centre. Placer chaque son là où l'on a  │
// │   cliqué relie le geste au retour sonore.                         │
// │                                                                    │
// │ — AUCUNE DYNAMIQUE. Trois sons simultanés saturaient ; un seul    │
// │   paraissait faible.                                              │
// └────────────────────────────────────────────────────────────────────┘

const STORAGE_KEY = 'forgefit.sound';

/** Volume maître. Bas : le son accompagne, il n'annonce rien. */
const MASTER = 0.09;

/** Intervalle minimal entre deux déclenchements. */
const THROTTLE_MS = 45;

/** Voix simultanées. Au-delà, on laisse tomber plutôt que de saturer. */
const MAX_VOICES = 10;

/**
 * Gamme pentatonique mineure de la, sur quatre octaves.
 *
 * ┌─ POURQUOI UNE GAMME ET PAS DES FRÉQUENCES AU HASARD ─────────────┐
 * │ La pentatonique mineure n'a AUCUN demi-ton : deux de ses notes   │
 * │ jouées ensemble ou l'une après l'autre restent consonantes,      │
 * │ quelles qu'elles soient. Une navigation rapide enchaîne des sons │
 * │ dans un ordre imprévisible ; avec une gamme ordinaire, deux      │
 * │ notes voisines produiraient une seconde mineure — l'intervalle   │
 * │ le plus dur de la musique occidentale. Ici, c'est impossible.    │
 * └────────────────────────────────────────────────────────────────────┘
 */
const SCALE = [
  220.00, 261.63, 293.66, 329.63, 392.00,
  440.00, 523.25, 587.33, 659.25, 783.99,
  880.00, 1046.50, 1174.66, 1318.51, 1567.98,
  1760.00,
];

const degree = (i) => SCALE[Math.max(0, Math.min(SCALE.length - 1, i))];

let ctx = null;
let master = null;
let reverbSend = null;
let lastPlayed = 0;
let voices = 0;

/** Progression mélodique : les clics rapprochés montent la gamme. */
let comboStep = 0;
let comboAt = 0;
/** Au-delà, la série est finie et la mélodie repart du bas. */
const COMBO_WINDOW_MS = 550;
const COMBO_MAX = 6;

/**
 * Réponse impulsionnelle synthétique.
 *
 * Un bruit qui décroît exponentiellement : c'est le modèle le plus
 * simple d'une petite pièce, et il suffit largement ici. Les deux
 * canaux sont tirés indépendamment — c'est ce qui donne la largeur
 * stéréo, un bruit identique à gauche et à droite s'entendrait mono.
 *
 * 0,32 s : assez pour poser le son dans un espace, assez court pour ne
 * pas traîner sur le clic suivant.
 */
function buildRoom(c) {
  const seconds = 0.32;
  const frames = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(2, frames, c.sampleRate);

  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < frames; i += 1) {
      const t = i / frames;
      // Exposant 2,6 : décroissance rapide au début, longue traîne.
      // Une décroissance linéaire sonnerait comme une porte de bruit.
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** 2.6;
    }
  }
  return buffer;
}

/**
 * Courbe de saturation douce.
 *
 * Arrondit les crêtes au lieu de les écrêter. C'est ce qui donne du
 * corps à une attaque sans la rendre agressive — et ce qui évite le
 * craquement d'un signal qui dépasse.
 */
function saturationCurve(amount = 12) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function audio() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;

  try {
    ctx = new Ctor();

    // Chaîne maîtresse : saturation douce → limiteur → sortie.
    const shaper = ctx.createWaveShaper();
    shaper.curve = saturationCurve(6);
    shaper.oversample = '2x';

    // Le limiteur n'est pas un effet : c'est un garde-fou. Sans lui,
    // trois sons déclenchés ensemble dépassent 0 dBFS et craquent.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    master = ctx.createGain();
    master.gain.value = MASTER;

    master.connect(shaper);
    shaper.connect(limiter);
    limiter.connect(ctx.destination);

    // Bus de réverbération, alimenté en départ par chaque voix.
    const convolver = ctx.createConvolver();
    convolver.buffer = buildRoom(ctx);
    // Coupe-bas sur la queue : les graves réverbérés embourbent tout.
    const tilt = ctx.createBiquadFilter();
    tilt.type = 'highpass';
    tilt.frequency.value = 600;

    reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    reverbSend.connect(tilt);
    tilt.connect(convolver);
    convolver.connect(master);
  } catch {
    ctx = null;
  }
  return ctx;
}

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
  } catch { /* le réglage ne survivra pas au rechargement, tant pis */ }
}

/** ±`cents` d'écart aléatoire : deux clics ne sonnent jamais pareil. */
const jitter = (cents) => (Math.random() * 2 - 1) * cents;

/**
 * Une voix complète : oscillateur, enveloppe, panoramique, départ vers
 * la réverbération.
 */
function voice({
  type = 'square', from, to, at, duration,
  gain = 1, detune = 0, pan = 0, send = 0.16,
  filter = null,
}) {
  const c = audio();
  if (!c || voices >= MAX_VOICES) return;

  voices += 1;

  const osc = c.createOscillator();
  const env = c.createGain();
  const panner = c.createStereoPanner?.();

  osc.type = type;
  osc.detune.value = detune + jitter(14);
  osc.frequency.setValueAtTime(from, at);
  if (to && to !== from) {
    // Glissando EXPONENTIEL : l'oreille perçoit la hauteur en
    // logarithme, un balayage linéaire s'entendrait accélérer.
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration);
  }

  // Attaque très courte puis extinction exponentielle : c'est
  // l'enveloppe qui fait le grain percussif, pas la forme d'onde.
  const peak = gain * (0.88 + Math.random() * 0.24);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(peak, at + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  let node = osc;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type ?? 'lowpass';
    f.frequency.setValueAtTime(filter.from, at);
    if (filter.to) {
      f.frequency.exponentialRampToValueAtTime(Math.max(40, filter.to), at + duration);
    }
    f.Q.value = filter.q ?? 1;
    osc.connect(f);
    node = f;
  }

  node.connect(env);

  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    env.connect(panner);
    panner.connect(master);
  } else {
    env.connect(master);
  }

  if (send > 0 && reverbSend) {
    const s = c.createGain();
    s.gain.value = send;
    env.connect(s);
    s.connect(reverbSend);
  }

  osc.onended = () => { voices = Math.max(0, voices - 1); };
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

/**
 * Transitoire de bruit : le « tchak » d'attaque.
 *
 * Sans lui, un blip d'oscillateur sonne mou et électronique. Avec, il a
 * un point d'impact. Le filtre passe-bande choisit sa couleur : haut et
 * fin pour un effleurement, plus bas et large pour une validation.
 */
function transient(at, {
  gain = 0.5, duration = 0.035, freq = 3200, q = 0.7, pan = 0, send = 0.1,
} = {}) {
  const c = audio();
  if (!c) return;

  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq * (0.92 + Math.random() * 0.16);
  band.Q.value = q;

  const env = c.createGain();
  env.gain.value = gain;

  const panner = c.createStereoPanner?.();

  src.connect(band);
  band.connect(env);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    env.connect(panner);
    panner.connect(master);
  } else {
    env.connect(master);
  }

  if (send > 0 && reverbSend) {
    const s = c.createGain();
    s.gain.value = send;
    env.connect(s);
    s.connect(reverbSend);
  }

  src.start(at);
}

/**
 * Le répertoire.
 *
 * Chaque son reçoit `pan` (position du geste à l'écran) et `step` (rang
 * dans la série de clics rapprochés). Huit entrées, parce que huit
 * intentions différentes méritent huit retours différents : valider et
 * annuler ne peuvent pas sonner pareil.
 */
const SOUNDS = {
  /** Déplacement : onglet, élément de liste. Monte avec la série. */
  nav: (t, { pan, step }) => {
    const root = 8 + step;
    transient(t, { gain: 0.3, duration: 0.022, freq: 5200, q: 1.2, pan });
    voice({
      type: 'triangle', from: degree(root), to: degree(root + 2),
      at: t, duration: 0.07, gain: 0.55, pan, send: 0.2,
    });
  },

  /** Ouverture d'un panneau, choix d'un élément. */
  select: (t, { pan, step }) => {
    const root = 6 + Math.min(step, 3);
    transient(t, { gain: 0.38, duration: 0.03, freq: 3800, pan });
    voice({
      type: 'square', from: degree(root), to: degree(root + 3),
      at: t, duration: 0.085, gain: 0.5, pan, send: 0.18,
      filter: { type: 'lowpass', from: 5200, to: 2600, q: 1.1 },
    });
  },

  /**
   * Validation : le seul son qui porte du GRAVE.
   *
   * C'est ce qui le distingue de tout le reste sans être plus fort —
   * la séparation se fait en fréquence, pas en volume. Un son de
   * validation qui ne serait qu'un « tap » plus fort fatiguerait.
   */
  confirm: (t, { pan }) => {
    transient(t, { gain: 0.5, duration: 0.04, freq: 2600, q: 0.6, pan });
    voice({ type: 'sine', from: 110, to: 82, at: t, duration: 0.16, gain: 0.55, pan, send: 0.1 });
    voice({ type: 'square', from: degree(5), to: degree(9), at: t, duration: 0.1, gain: 0.42, pan });
    // Tierce retardée : deux notes font un accord, une seule fait un bip.
    voice({
      type: 'triangle', from: degree(9), to: degree(11),
      at: t + 0.045, duration: 0.14, gain: 0.3, pan, send: 0.3,
    });
  },

  /** Annulation, fermeture : descend, et rien ne descend d'autre. */
  cancel: (t, { pan }) => {
    transient(t, { gain: 0.26, duration: 0.028, freq: 2200, pan });
    voice({
      type: 'square', from: degree(7), to: degree(3),
      at: t, duration: 0.11, gain: 0.4, pan, send: 0.2,
      filter: { type: 'lowpass', from: 3400, to: 900 },
    });
  },

  /** Changement d'écran : plus large, plus long, avec un balayage. */
  swipe: (t, { pan = 0 }) => {
    transient(t, { gain: 0.3, duration: 0.05, freq: 1800, q: 0.4, pan, send: 0.25 });
    voice({
      type: 'sawtooth', from: 180, to: 700, at: t, duration: 0.2, gain: 0.24,
      pan: -0.35, send: 0.3,
      filter: { type: 'lowpass', from: 700, to: 4200, q: 3 },
    });
    voice({
      type: 'triangle', from: degree(12), to: degree(9),
      at: t + 0.03, duration: 0.15, gain: 0.2, pan: 0.35, send: 0.35,
    });
  },

  /** Bascule activée. */
  toggleOn: (t, { pan }) => {
    transient(t, { gain: 0.3, duration: 0.02, freq: 4200, pan });
    voice({ type: 'square', from: degree(6), at: t, duration: 0.05, gain: 0.4, pan });
    voice({ type: 'square', from: degree(10), at: t + 0.05, duration: 0.07, gain: 0.35, pan, send: 0.25 });
  },

  /** Bascule désactivée : les deux notes, dans l'autre sens. */
  toggleOff: (t, { pan }) => {
    transient(t, { gain: 0.24, duration: 0.02, freq: 3000, pan });
    voice({ type: 'square', from: degree(10), at: t, duration: 0.05, gain: 0.35, pan });
    voice({ type: 'square', from: degree(6), at: t + 0.05, duration: 0.07, gain: 0.3, pan, send: 0.2 });
  },

  /**
   * Réussite : un arpège ascendant.
   *
   * Réservé aux événements rares — distinction obtenue, niveau gagné.
   * L'employer pour une action ordinaire en userait l'effet en deux
   * jours.
   */
  success: (t, { pan = 0 }) => {
    transient(t, { gain: 0.4, duration: 0.05, freq: 3000, pan, send: 0.3 });
    voice({ type: 'sine', from: 110, at: t, duration: 0.3, gain: 0.4, send: 0.15 });
    [5, 7, 9, 11].forEach((d, i) => {
      voice({
        type: 'triangle', from: degree(d), at: t + i * 0.055,
        duration: 0.26 - i * 0.02, gain: 0.34, send: 0.4,
        pan: pan + (i - 1.5) * 0.12,
      });
    });
  },

  /**
   * Erreur : une seconde mineure, le seul intervalle dissonant de tout
   * le répertoire. Il n'apparaît nulle part ailleurs, donc il ne peut
   * pas être confondu.
   */
  error: (t, { pan = 0 }) => {
    transient(t, { gain: 0.3, duration: 0.035, freq: 1400, q: 0.5, pan });
    voice({ type: 'square', from: 233.08, at: t, duration: 0.16, gain: 0.34, pan, send: 0.2 });
    voice({ type: 'square', from: 220.00, at: t, duration: 0.16, gain: 0.34, pan, send: 0.2 });
  },

  /** Incrément : très court, très discret. Pour les pas à pas. */
  tick: (t, { pan, step }) => {
    transient(t, { gain: 0.18, duration: 0.014, freq: 6400, q: 1.6, pan, send: 0.05 });
    voice({
      type: 'triangle', from: degree(11 + (step % 3)),
      at: t, duration: 0.035, gain: 0.22, pan, send: 0.08,
    });
  },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

/**
 * Joue un son.
 *
 * @param {string} name
 * @param {object} [opts]
 * @param {number} [opts.x] abscisse du geste, en pixels écran. Elle
 *   positionne le son dans le champ stéréo : cliquer à droite s'entend
 *   à droite.
 */
export function play(name, { x = null } = {}) {
  if (isMuted()) return;
  // Onglet caché : personne n'écoute, et jouer coûterait de la batterie.
  if (typeof document !== 'undefined' && document.hidden) return;

  const now = performance.now();
  if (now - lastPlayed < THROTTLE_MS) return;

  // Série : des clics rapprochés montent la gamme, puis elle repart du
  // bas après un silence. C'est ce qui empêche une liste parcourue vite
  // de sonner comme une machine à écrire.
  comboStep = now - comboAt < COMBO_WINDOW_MS
    ? Math.min(comboStep + 1, COMBO_MAX)
    : 0;
  comboAt = now;
  lastPlayed = now;

  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') c.resume?.();

  const pan = x == null || !window.innerWidth
    // ±0,55 et pas ±1 : un son totalement à gauche disparaît d'une
    // oreille, ce qui se remarque plus que ça n'aide.
    ? 0
    : ((x / window.innerWidth) * 2 - 1) * 0.55;

  try {
    SOUNDS[name]?.(c.currentTime + 0.001, { pan, step: comboStep });
  } catch { /* un son raté ne doit jamais remonter jusqu'à l'interface */ }
}

/** Réveille le contexte au premier geste, pour que le son ne rate pas. */
export function warmUp() {
  if (isMuted()) return;
  const c = audio();
  if (c?.state === 'suspended') c.resume?.();
}
