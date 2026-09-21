import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import StreakStrip from './StreakStrip.jsx';

/**
 * Ce qu'il y a à faire aujourd'hui.
 *
 * L'application s'ouvre pour agir, pas pour lire. Sans cette carte, la
 * première question — « je fais quoi, là ? » — obligeait à passer par le
 * calendrier, à repérer la bonne colonne, puis à revenir : trois écrans
 * pour une réponse qui tient en une ligne.
 *
 * Elle ne s'affiche que lorsqu'aucune séance n'est en cours : pendant la
 * séance, c'est le journal qui compte.
 */

const FOCUS_LABELS = {
  push: 'Poussée', pull: 'Tirage', legs: 'Jambes', core: 'Tronc',
  mobility: 'Mobilité', endurance: 'Endurance', explosive: 'Explosivité',
};

const formatTime = (time) => (time ? String(time).slice(0, 5).replace(':', ' h ') : null);

export default function TodayCard({ onStart, onFreeSession, navigate }) {
  const [day, setDay] = useState(null);
  const [program, setProgram] = useState(null);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const today = new Date();
    // La date est calculée dans le fuseau du navigateur, comme la route
    // le fait côté serveur : un décalage ferait pointer « aujourd'hui »
    // sur hier une partie de la journée.
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 10);

    api.programCalendar({ from: iso, to: iso })
      .then((d) => {
        setDay(d.days?.[0] ?? null);
        setProgram(d.program ?? null);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  // Une erreur ici ne doit rien casser : le mode Terrain reste
  // utilisable sans programme, et une carte absente vaut mieux qu'un
  // bandeau d'erreur en haut de l'écran de saisie.
  if (state !== 'ready') return null;

  const planned = day?.planned ?? null;
  const done = day?.completed ?? false;

  const start = async () => {
    setBusy(true);
    try {
      await onStart(planned);
    } finally {
      setBusy(false);
    }
  };

  const heading = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div
      className="card"
      // Liseré = châssis, donc teinte de marque. Le bleu restait de
      // l'ancienne palette et jurait avec tout le reste.
      style={{ borderLeftColor: planned && !done ? 'var(--brand)' : undefined }}
    >
      <div className="stat-label" style={{ marginBottom: 6 }}>
        Aujourd’hui · {heading}
      </div>

      {planned ? (
        <>
          <h2 className="card-title" style={{ margin: 0 }}>{planned.title}</h2>
          <p className="card-sub" style={{ margin: '4px 0 0' }}>
            {planned.item_count} exercice{planned.item_count > 1 ? 's' : ''}
            {planned.focus ? ` · ${FOCUS_LABELS[planned.focus] ?? planned.focus}` : ''}
            {formatTime(planned.start_time) ? ` · prévu à ${formatTime(planned.start_time)}` : ''}
          </p>

          {done ? (
            <p style={{ fontSize: 13, color: 'var(--good)', margin: '12px 0 0' }}>
              ✓ Séance déjà faite aujourd’hui. Tu peux en relancer une si tu veux.
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" className="btn-primary" onClick={start} disabled={busy}>
              {busy ? 'Ouverture…' : done ? 'Refaire cette séance' : 'Démarrer la séance'}
            </button>
            <button type="button" className="btn-ghost" onClick={onFreeSession} disabled={busy}>
              Séance libre
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="card-title" style={{ margin: 0 }}>
            {program
              ? (day?.in_cycle ? 'Jour de repos' : 'Hors cycle du programme')
              : 'Aucun programme actif'}
          </h2>
          <p className="card-sub" style={{ margin: '4px 0 0' }}>
            {program
              ? (day?.in_cycle
                ? 'Rien de prévu. La récupération fait partie du programme — c’est elle '
                  + 'qui limite, pas l’envie.'
                : 'Ce jour tombe en dehors des semaines du programme.')
              : 'Choisis un modèle ou génères-en un pour voir tes séances ici.'}
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" className="btn-primary" onClick={onFreeSession}>
              Séance libre
            </button>
            {!program && (
              <button
                type="button" className="btn-ghost"
                onClick={() => navigate?.('entrainement', 'programme')}
              >
                Choisir un programme
              </button>
            )}
            {program && (
              <button
                type="button" className="btn-ghost"
                onClick={() => navigate?.('entrainement', 'calendrier')}
              >
                Voir la semaine
              </button>
            )}
          </div>
        </>
      )}

      {/* La série se lit APRÈS l'action du jour : elle motive, elle ne
          commande pas. Placée au-dessus, elle transformerait un jour de
          repos prévu en reproche. */}
      <StreakStrip />
    </div>
  );
}
