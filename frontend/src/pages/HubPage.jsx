import { useEffect, useRef, useState } from 'react';
import { hubBoard } from '../lib/constellations.js';
import { APP } from '../lib/modules.js';
import Portrait from '../components/Portrait.jsx';
import { playLater } from '../lib/sound-lazy.js';

/**
 * Le hub — quatre domaines de vie, en constellations.
 *
 * ┌─ POURQUOI DES ÉTOILES, ET PAS QUATRE TUILES ──────────────────────┐
 * │ Une tuile dit « voici une application ». Une constellation dit    │
 * │ « voici un domaine, et quelqu'un l'habite » — ce qui est le vrai  │
 * │ propos : les modules vont et viennent, les domaines restent.      │
 * │                                                                    │
 * │ C'est aussi ce qui permet de montrer un domaine VIDE sans mentir. │
 * │ Une tuile grise qui n'ouvre rien est une promesse non tenue ;     │
 * │ une constellation éteinte se lit immédiatement pour ce qu'elle    │
 * │ est — un ciel où rien ne brille encore.                           │
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Durée du plongeon. Au-delà, on navigue, que l'animation ait fini ou non. */
const DIVE_MS = 620;

export default function HubPage({ navigate }) {
  const [diving, setDiving] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const enter = (item) => {
    if (!item.lit || diving) return;
    playLater('confirm');

    // Le mouvement est un ornement, jamais un péage : qui l'a désactivé
    // arrive au même endroit, tout de suite.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      navigate(item.route.section, item.route.page);
      return;
    }

    setDiving(item.key);
    timer.current = setTimeout(
      () => navigate(item.route.section, item.route.page),
      DIVE_MS,
    );
  };

  const board = hubBoard();

  return (
    <div className={`hub${diving ? ' hub-diving' : ''}`}>
      <header className="hub-head">
        <h1 className="hub-title">{APP.name}</h1>
        <p className="hub-sub">
          {APP.tagline} · deux sont habités, deux attendent le leur.
        </p>
      </header>

      <div className="hub-board">
        {board.map((item) => (
          <Constellation
            key={item.key}
            item={item}
            diving={diving}
            onEnter={() => enter(item)}
          />
        ))}
      </div>
    </div>
  );
}

function Constellation({ item, diving, onEnter }) {
  const state = diving === item.key ? 'plonge'
    : diving ? 'recule'
      : item.lit ? 'allumee' : 'eteinte';

  // Une constellation éteinte n'est pas un bouton : elle n'ouvre rien.
  // L'annoncer comme tel enverrait un lecteur d'écran sur une impasse.
  const Tag = item.lit ? 'button' : 'div';

  return (
    <Tag
      type={item.lit ? 'button' : undefined}
      className={`constellation constellation-${state}`}
      onClick={item.lit ? onEnter : undefined}
      aria-label={item.lit
        ? `${item.label} — ouvrir ${item.module.label}`
        : undefined}
      aria-disabled={item.lit ? undefined : 'true'}
    >
      {/* ┌─ LE TABLEAU ────────────────────────────────────────────┐
          │ Le personnage est DANS le cadre, sur le ciel du domaine. │
          │ La constellation n'a pas disparu : elle est devenue le   │
          │ fond de la toile, derrière la figure — c'est ce qui      │
          │ relie chaque portrait au ciel de la page.                │
          └──────────────────────────────────────────────────────────┘ */}
      <span className="frame">
        <svg className="frame-sky" viewBox="0 0 100 100" aria-hidden="true">
          {item.edges.map(([a, b]) => (
            <line
              key={`e-${a}-${b}`}
              className="frame-edge"
              x1={item.stars[a][0]} y1={item.stars[a][1]}
              x2={item.stars[b][0]} y2={item.stars[b][1]}
            />
          ))}
          {item.stars.map(([x, y], i) => (
            <circle
              key={`s-${i}`}
              className="frame-star"
              cx={x} cy={y}
              r={i === 0 ? 2.6 : 1.7}
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </svg>

        <Portrait figure={item.key} className="portrait" />
      </span>

      {/* Les textes sont groupés : sur téléphone la carte passe en
          rangée, le tracé à gauche et ce bloc à droite. Sans lui, nom,
          description et état deviendraient trois colonnes voisines. */}
      <span className="constellation-text">
        <span className="constellation-name">{item.label}</span>
        <span className="constellation-tagline">{item.tagline}</span>
        <span className="constellation-state">
          {item.lit ? item.module.label : 'Aucun module'}
        </span>
      </span>
    </Tag>
  );
}
