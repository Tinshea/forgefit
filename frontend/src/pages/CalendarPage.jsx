import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import CalendarSubscribe from '../components/CalendarSubscribe.jsx';

/**
 * Calendrier d'entraînement.
 *
 * Croise le PLAN et le FAIT. Les deux sont nécessaires : un calendrier
 * qui n'affiche que le programme ne dit pas si on l'a suivi, et un
 * historique seul ne dit pas ce qui était prévu.
 *
 * L'unité d'affichage est la SEMAINE, pas le mois : un programme se
 * raisonne en séries hebdomadaires par muscle, et c'est la semaine qui
 * se remplit ou non.
 */

const FOCUS_LABELS = {
  push: 'Poussée', pull: 'Tirage', legs: 'Jambes', core: 'Tronc',
  mobility: 'Mobilité', endurance: 'Endurance', explosive: 'Explosivité',
};

const DAY_MS = 86_400_000;

/** Lundi de la semaine contenant `date`, en ISO. */
function mondayOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return new Date(d.getTime() - (iso - 1) * DAY_MS).toISOString().slice(0, 10);
}

const addDays = (date, n) => new Date(
  new Date(`${date}T00:00:00Z`).getTime() + n * DAY_MS,
).toISOString().slice(0, 10);

const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});

/**
 * Grille ou liste ?
 *
 * Sept colonnes ne tiennent pas sur un téléphone, et un défilement
 * horizontal par semaine oblige à balayer pour savoir ce qu'il y a
 * jeudi. Sous 760 px, la semaine devient une LISTE verticale : plus
 * longue, mais lisible d'un pouce.
 */
function useNarrow(breakpoint = 760) {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return narrow;
}

const formatTime = (time) => (time ? String(time).slice(0, 5).replace(':', ' h ') : null);

const duration = (from, to) => {
  const min = Math.round((new Date(to) - new Date(from)) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
};

/** Une journée de la grille hebdomadaire. */
function DayCell({
  day, weekdayLabel, isToday, hasProgram, onStart, onDelete, starting, narrow,
}) {
  const planned = day.planned;
  const done = day.completed;

  // En liste, une journée vide n'occupe qu'une ligne : la masquer
  // ferait sauter des dates et casserait la lecture de la semaine.
  return (
    <div
      className="cal-day"
      data-today={isToday ? '' : undefined}
      data-off={!day.in_cycle && !day.sessions.length ? '' : undefined}
      data-planned={planned ? '' : undefined}
      data-done={done ? '' : undefined}
    >
      {/* En-tête : le JOUR en grand sur son bandeau, la date dessous.
          C'est le rapport d'échelle qui fait la lecture, pas la
          couleur — on repère un jour d'un coup d'œil sans lire. */}
      <div className="cal-head">
        {/* Le badge vit DANS l'en-tête, pas en débordement : la carte
            porte une découpe d'angle qui rognait un élément positionné
            en négatif. Et il ne fait pas double emploi avec l'aplat
            rouge — c'est lui qui nomme « aujourd'hui » pour qui ne
            distingue pas les couleurs. */}
        {isToday && <span className="cal-badge">AUJ.</span>}
        <span className="cal-dow">{weekdayLabel}</span>
        <span className="cal-num">{Number(day.date.slice(8, 10))}</span>
      </div>

      {planned ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: done ? 'var(--good)' : 'var(--text-muted)' }}>
              {done ? '✓' : '○'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{planned.title}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {planned.item_count} exercice{planned.item_count > 1 ? 's' : ''}
            {planned.focus ? ` · ${FOCUS_LABELS[planned.focus] ?? planned.focus}` : ''}
            {formatTime(planned.start_time) ? ` · ${formatTime(planned.start_time)}` : ''}
          </div>
          {!done && (
            <button
              type="button" className="btn-ghost"
              style={{ marginTop: 8, width: '100%' }}
              onClick={() => onStart(planned)}
              disabled={starting}
            >
              {starting ? 'Ouverture…' : 'Démarrer'}
            </button>
          )}
        </div>
      ) : (
        // Sans programme actif, « hors programme » sur chaque case ne
        // dirait rien que l'en-tête ne dise déjà, sept fois par semaine.
        hasProgram && (
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', marginTop: narrow ? 0 : 10,
          }}>
            {day.in_cycle ? 'Repos' : 'Hors cycle'}
          </div>
        )
      )}

      {day.sessions.map((s) => (
        <div
          key={s.id}
          style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--grid)',
            fontSize: 11, color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
              {s.title ?? 'Séance'}
            </span>
            {/* Une séance ouverte par erreur fausse les statistiques :
                il faut pouvoir la retirer là où on la voit. */}
            <button
              type="button" className="btn-ghost"
              onClick={() => onDelete(s)}
              aria-label={`Supprimer ${s.title ?? 'cette séance'}`}
              style={{ color: 'var(--critical)', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          {s.set_count} série{s.set_count > 1 ? 's' : ''}
          {Number(s.volume_kg) > 0 && ` · ${Math.round(Number(s.volume_kg)).toLocaleString('fr-FR')} kg`}
          {s.ended_at
            ? ` · ${duration(s.started_at, s.ended_at)}`
            : <span style={{ color: 'var(--warning)' }}> · en cours</span>}
        </div>
      ))}
    </div>
  );
}

export default function CalendarPage({ navigate }) {
  const [anchor, setAnchor] = useState(() => mondayOf(new Date().toISOString().slice(0, 10)));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(null);
  const narrow = useNarrow();

  // Trois semaines d'un coup : la précédente pour le contexte, la
  // courante, la suivante pour anticiper. Un aller-retour réseau par
  // changement de semaine serait inutile.
  const load = useCallback(() => {
    api.programCalendar({ from: addDays(anchor, -7), to: addDays(anchor, 20) })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [anchor]);

  useEffect(load, [load]);

  const remove = async (session) => {
    const label = session.title ?? 'cette séance';
    // Une séance efface aussi ses séries : la confirmation n'est pas du
    // zèle, l'action n'est pas réversible.
    if (!window.confirm(
      `Supprimer « ${label} » et ses ${session.set_count} série(s) ? Cette action est définitive.`,
    )) return;
    try {
      await api.deleteSession(session.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const start = async (planned) => {
    setStarting(planned.id);
    try {
      // La séance est ouverte ICI, puis le mode Terrain la reprend via
      // /api/workouts/open : il n'y a pas d'état à faire transiter entre
      // les deux écrans, donc rien à désynchroniser.
      await api.createSession({ program_day_id: planned.id });
      navigate?.('entrainement', 'seance');
    } catch (e) {
      setError(e.message);
      setStarting(null);
    }
  };

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="empty">Chargement du calendrier…</p>;

  const byDate = new Map(data.days.map((d) => [d.date, d]));
  // La semaine précédente sert de contexte sur grand écran. En liste,
  // elle imposerait de défiler sept lignes avant d'atteindre la semaine
  // en cours : le bouton « Semaine précédente » suffit alors.
  const weeks = (narrow ? [0, 7, 14] : [-7, 0, 7, 14])
    .map((offset) => addDays(anchor, offset));

  return (
    <div className="grid">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="card-title">Calendrier</h2>
            {data.program ? (
              <p className="card-sub" style={{ margin: 0 }}>
                {data.program.name} · {data.program.weeks} semaines, du{' '}
                {shortDate(data.program.starts_on)} au {shortDate(data.program.ends_on)}
              </p>
            ) : (
              <p className="card-sub" style={{ margin: 0 }}>
                Aucun programme actif : seules les séances enregistrées apparaissent.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" onClick={() => setAnchor(addDays(anchor, -7))}>
            ← Semaine précédente
          </button>
          <button
            type="button" className="btn-ghost"
            onClick={() => setAnchor(mondayOf(data.today))}
          >
            Cette semaine
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAnchor(addDays(anchor, 7))}>
            Semaine suivante →
          </button>
        </div>

        {data.program?.unscheduled_days?.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 12, marginBottom: 0 }}>
            ▲ {data.program.unscheduled_days.map((d) => d.title).join(', ')} : séance(s) sans
            jour attribué, donc absente(s) du calendrier. Attribue-leur un jour depuis
            l’éditeur de programme.
          </p>
        )}
      </div>

      <CalendarSubscribe />

      {weeks.map((weekStart) => {
        const days = data.weekdays.map((w, i) => byDate.get(addDays(weekStart, i)))
          .filter(Boolean);
        if (!days.length) return null;
        // La semaine du LUNDI, pas du premier jour en cycle : sinon une
        // semaine qui ne touche le programme que par son dimanche
        // s'annoncerait comme « semaine 1 ».
        const week = days[0]?.in_cycle ? days[0].program_week : null;

        return (
          <div key={weekStart}>
            <div className="stat-label" style={{ margin: '4px 0 8px' }}>
              Semaine du {shortDate(weekStart)}
              {week ? ` · semaine ${week} du programme` : ''}
            </div>
            {/* Sur grand écran, sept colonnes : une semaine est une
                semaine, et une grille auto-ajustée renverrait le
                dimanche à la ligne. Sur téléphone, une liste verticale :
                un défilement horizontal obligerait à balayer pour savoir
                ce qu'il y a jeudi. */}
            <div style={{
              display: 'grid', gap: 8,
              gridTemplateColumns: narrow ? '1fr' : 'repeat(7, minmax(0, 1fr))',
            }}>
              {days.map((day, i) => (
                <DayCell
                  key={day.date}
                  day={day}
                  weekdayLabel={data.weekdays[i]?.short ?? ''}
                  isToday={day.date === data.today}
                  hasProgram={!!data.program}
                  onStart={start}
                  onDelete={remove}
                  starting={starting === day.planned?.id}
                  narrow={narrow}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
