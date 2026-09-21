import { useEffect } from 'react';
import { playLater as play, warmUpLater as warmUp } from '../lib/sound-lazy.js';

/**
 * Étincelles au point de contact.
 *
 * ┌─ CE QUE CET EFFET DOIT RESPECTER ─────────────────────────────────┐
 * │ 1. Ne jamais retarder l'action. Les étincelles sont peintes APRÈS │
 * │    que le clic a été traité : elles décorent, elles n'attendent   │
 * │    rien.                                                          │
 * │                                                                    │
 * │ 2. Ne pas intercepter le pointeur. Tout est en                    │
 * │    `pointer-events: none` dans une couche fixe au-dessus de       │
 * │    l'interface.                                                   │
 * │                                                                    │
 * │ 3. Se nettoyer. Chaque salve se retire d'elle-même ; sans cela,   │
 * │    une session d'une heure laisserait des milliers de nœuds morts │
 * │    dans le document.                                              │
 * │                                                                    │
 * │ 4. Se taire quand on le lui demande. `prefers-reduced-motion` est │
 * │    lu À CHAQUE CLIC, pas une fois au montage : le réglage système │
 * │    peut changer pendant que l'application tourne.                 │
 * └────────────────────────────────────────────────────────────────────┘
 */

/**
 * Quel son pour quel élément.
 *
 * ┌─ POURQUOI HUIT SONS ET PAS UN ────────────────────────────────────┐
 * │ Un retour sonore unique ne dit qu'une chose : « c'est pris ».     │
 * │ Un vocabulaire dit CE QUI est pris. Valider et annuler ne peuvent │
 * │ pas sonner pareil : la seconde doit descendre là où la première   │
 * │ monte, sinon l'oreille n'apprend rien et le son n'est plus qu'un  │
 * │ bruit d'accompagnement.                                           │
 * │                                                                    │
 * │ La détection se fait sur ce que l'élément EST (classe, rôle,      │
 * │ état) puis, en dernier recours seulement, sur son libellé — un    │
 * │ texte change plus souvent qu'une classe.                          │
 * └────────────────────────────────────────────────────────────────────┘
 */
const CANCEL_WORDS = /^(fermer|annuler|retour|masquer|sans noter|continuer)/i;

function soundFor(el) {
  if (el.classList.contains('btn-primary')) return 'confirm';
  if (el.classList.contains('tab') || el.classList.contains('subtab')) return 'nav';
  if (el.classList.contains('rpe-dot') || el.classList.contains('muscle-chip')) return 'tick';
  if (el.classList.contains('exercise-item') || el.classList.contains('sport-chip')) return 'select';

  // Une bascule a deux sons, et c'est l'état APRÈS le clic qui compte :
  // `aria-pressed` vaut encore l'ancien état à cet instant.
  const pressed = el.getAttribute('aria-pressed');
  if (pressed === 'true') return 'toggleOff';
  if (pressed === 'false') return 'toggleOn';

  if (CANCEL_WORDS.test(el.textContent?.trim() ?? '')) return 'cancel';
  return 'select';
}

const SPARK_COUNT = 7;
const LIFETIME_MS = 520;
/** Au-delà, on cesse d'ajouter : un clic frénétique ne doit rien coûter. */
const MAX_LIVE = 6;

export default function ClickBurst() {
  useEffect(() => {
    const layer = document.createElement('div');
    layer.className = 'burst-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const onPointerDown = (e) => {
      // Seuls les éléments ACTIONNABLES réagissent. Une étincelle sur
      // une sélection de texte serait du bruit.
      const target = e.target.closest?.(
        'button, a, [role="button"], .tab, .subtab, .card-clickable',
      );
      if (!target) return;

      // Le son, lui, ne dépend PAS de `prefers-reduced-motion` : ce
      // réglage porte sur le mouvement, pas sur l'audio. Quelqu'un qui
      // réduit les animations n'a pas demandé le silence, et le son a
      // son propre interrupteur.
      warmUp();
      play(soundFor(target), { x: e.clientX });

      if (reduced()) return;
      if (layer.childElementCount >= MAX_LIVE) return;

      const burst = document.createElement('span');
      burst.className = 'burst';
      burst.style.left = `${e.clientX}px`;
      burst.style.top = `${e.clientY}px`;

      for (let i = 0; i < SPARK_COUNT; i += 1) {
        const spark = document.createElement('span');
        spark.className = 'burst-spark';
        // Réparties en éventail, avec une irrégularité : un cercle
        // parfait se lit comme un chargement, pas comme un impact.
        const angle = (360 / SPARK_COUNT) * i + (Math.random() * 26 - 13);
        const distance = 26 + Math.random() * 26;
        spark.style.setProperty('--angle', `${angle}deg`);
        spark.style.setProperty('--distance', `${distance}px`);
        spark.style.setProperty('--size', `${6 + Math.random() * 7}px`);
        spark.style.animationDelay = `${Math.random() * 40}ms`;
        burst.appendChild(spark);
      }

      const ring = document.createElement('span');
      ring.className = 'burst-ring';
      burst.appendChild(ring);

      layer.appendChild(burst);
      setTimeout(() => burst.remove(), LIFETIME_MS);
    };

    document.addEventListener('pointerdown', onPointerDown);

    // ┌─ L'ERREUR S'ENTEND ─────────────────────────────────────────┐
    // │ Un bandeau d'erreur qui apparaît en haut d'une page longue  │
    // │ peut passer complètement inaperçu : on regarde le bouton    │
    // │ qu'on vient d'actionner, pas le sommet de l'écran. Un son   │
    // │ le signale sans exiger qu'on regarde au bon endroit.        │
    // │                                                              │
    // │ C'est la seule dissonance de tout le répertoire — une       │
    // │ seconde mineure — donc elle est impossible à confondre.     │
    // └──────────────────────────────────────────────────────────────┘
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.classList?.contains('error-banner')
            || node.querySelector?.('.error-banner')) {
            play('error');
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      observer.disconnect();
      layer.remove();
    };
  }, []);

  return null;
}
