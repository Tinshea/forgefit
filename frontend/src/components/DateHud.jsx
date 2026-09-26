import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Où j'en suis — affiché en permanence, comme dans les menus Atlus.
 *
 * ┌─ POURQUOI DANS LA BARRE ET PAS SUR UNE PAGE ──────────────────────┐
 * │ Une page « calendrier » répond à « quand est ma prochaine         │
 * │ séance ». Elle ne répond pas à « où j'en suis », parce qu'il faut │
 * │ y aller pour le savoir — et on n'y va pas.                        │
 * │                                                                    │
 * │ Les jeux Persona affichent la date en permanence, dans un coin.   │
 * │ Ce n'est pas décoratif : c'est ce qui donne le sentiment d'une    │
 * │ progression qui avance pendant qu'on joue. Le bloc ci-dessous     │
 * │ tient dans la barre du haut, donc il ne coûte aucune hauteur et   │
 * │ ne disparaît jamais au défilement.                                │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Trois informations, dans cet ordre de lisibilité : le JOUR (énorme),
 * la DATE, puis la position dans le cycle du programme.
 */

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
};

/**
 * `bare` : la date SEULE, sans rien de ForgeFit.
 *
 * Le bandeau lit le programme d'entraînement et mène à son calendrier :
 * c'est du contenu de module, et il n'a rien à faire au-dessus des
 * quatre domaines. Sur le hub on garde ce qui est vrai partout — le
 * jour et la date — et on n'appelle même pas l'API.
 */
export default function DateHud({ navigate, bare = false }) {
  const [day, setDay] = useState(null);
  const [program, setProgram] = useState(null);

  useEffect(() => {
    if (bare) return undefined;
    const iso = todayIso();
    let alive = true;
    api.programCalendar({ from: iso, to: iso })
      .then((d) => {
        if (!alive) return;
        setDay(d.days?.[0] ?? null);
        setProgram(d.program ?? null);
      })
      // Un bandeau décoratif ne signale pas son échec : il se réduit à
      // la date, qui n'a besoin de personne.
      .catch(() => {});
    return () => { alive = false; };
  }, [bare]);

  const now = new Date();
  const weekday = DAYS[now.getDay()];
  const dayNum = now.getDate();
  const month = now.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

  const week = day?.program_week ?? null;
  const weeks = program?.weeks ?? null;
  const inCycle = day?.in_cycle ?? false;

  // Avancement dans le cycle entier, pas dans la semaine : c'est la
  // question « où j'en suis », pas « qu'est-ce que je fais aujourd'hui ».
  const progress = week && weeks ? Math.min(1, week / weeks) : 0;

  const phase = (() => {
    if (!program) return 'Aucun programme';
    if (!inCycle) return 'Hors cycle';
    if (day?.completed) return 'Séance faite';
    if (day?.planned) return day.planned.title;
    return 'Repos';
  })();

  const status = day?.completed ? 'fait' : day?.planned ? 'prevu' : 'repos';

  if (bare) {
    return (
      <div className="hud hud-bare">
        <span className="hud-day">{weekday}</span>
        <span className="hud-body">
          <span className="hud-date">{dayNum} {month}</span>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="hud"
      // Le bandeau est une PORTE vers le calendrier : on y clique
      // naturellement quand on veut en savoir plus.
      onClick={() => navigate?.('entrainement', 'calendrier')}
      title="Voir le calendrier"
    >
      <span className="hud-day">{weekday}</span>

      <span className="hud-body">
        <span className="hud-date">{dayNum} {month}</span>
        <span className="hud-cycle">
          {week && weeks
            ? `Semaine ${week} / ${weeks}`
            : program ? 'Hors cycle' : 'Sans programme'}
        </span>
        {week && weeks && (
          <span className="hud-bar">
            <span className="hud-bar-fill" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </span>

      <span className="hud-phase" data-status={status}>{phase}</span>
    </button>
  );
}
