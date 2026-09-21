import { useEffect, useRef, useState } from 'react';

/**
 * Chronomètres de séance.
 *
 * Les deux comptent à partir d'un INSTANT, jamais en décrémentant un
 * compteur. C'est la seule forme qui survit au mode terrain : l'écran se
 * verrouille, l'onglet passe en arrière-plan, et le navigateur bride
 * alors `setInterval` à une fois par minute. Un compteur décrémenté
 * perdrait le temps écoulé ; un calcul sur horloge le retrouve.
 */

/** Horloge partagée : un seul intervalle pour tous les chronos. */
function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    // Revenir au premier plan doit remettre l'affichage à l'heure sans
    // attendre le prochain battement.
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [active]);
  return now;
}

export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

/** Temps écoulé depuis le début de la séance. */
export function SessionChrono({ startedAt }) {
  const now = useNow();
  const elapsed = (now - new Date(startedAt).getTime()) / 1000;

  return (
    <span
      style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 18 }}
      aria-label="Temps écoulé depuis le début de la séance"
    >
      {formatClock(elapsed)}
    </span>
  );
}

/**
 * Signal de fin de repos.
 *
 * Le téléphone est dans une poche ou posé à l'envers : un changement
 * visuel seul ne se remarque pas. Vibration ET bip court, chacun
 * silencieusement ignoré là où il n'existe pas.
 *
 * L'AudioContext est créé au premier appel, donc depuis un geste de
 * l'utilisateur — iOS refuse de le démarrer autrement.
 */
let audioContext = null;
function signalEnd() {
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch { /* non supporté : la vibration est un bonus */ }

  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;
    audioContext = audioContext ?? new Ctx();
    audioContext.resume?.();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
  } catch { /* son bloqué : le visuel et la vibration suffisent */ }
}

/**
 * Minuteur de repos.
 *
 * Les repos courts amputent les séries suivantes : c'est un paramètre
 * d'entraînement, pas un confort. Le programme fournit sa durée ; elle
 * reste ajustable à la volée.
 */
export function RestTimer({ endsAt, total, onAdjust, onStop }) {
  const now = useNow();
  const remaining = (endsAt - now) / 1000;
  const done = remaining <= 0;
  const signalled = useRef(false);

  useEffect(() => { signalled.current = false; }, [endsAt]);
  useEffect(() => {
    if (done && !signalled.current) {
      signalled.current = true;
      signalEnd();
    }
  }, [done]);

  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1;

  return (
    <div
      className="card"
      style={{
        position: 'sticky', top: 8, zIndex: 20,
        borderColor: done ? 'var(--good)' : 'var(--series-1)',
      }}
      role="timer"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stat-label">
            {done ? 'Repos terminé' : 'Repos en cours'}
          </div>
          <div style={{
            fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1, color: done ? 'var(--good)' : 'var(--text-primary)',
          }}>
            {done ? 'Prêt' : formatClock(remaining)}
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={onStop}>
          {done ? 'Masquer' : 'Passer'}
        </button>
      </div>

      <div className="gauge" style={{ height: 6, marginTop: 10 }}>
        <div
          className="gauge-fill"
          style={{
            width: `${progress * 100}%`,
            background: done ? 'var(--good)' : 'var(--series-1)',
            transition: 'width 0.5s linear',
          }}
        />
      </div>

      {!done && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn-ghost" onClick={() => onAdjust(-30)}>−30 s</button>
          <button type="button" className="btn-ghost" onClick={() => onAdjust(30)}>+30 s</button>
        </div>
      )}
    </div>
  );
}
