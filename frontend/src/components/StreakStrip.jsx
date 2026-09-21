import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Régularité tenue, en semaines.
 *
 * ┌─ POURQUOI EN SEMAINES ET PAS EN JOURS ────────────────────────────┐
 * │ Une série quotidienne récompenserait s'entraîner tous les jours,  │
 * │ ce qu'aucun programme sérieux ne demande. À quatre séances par    │
 * │ semaine, trois jours de repos sont PRÉVUS : les afficher comme    │
 * │ des ruptures pousserait à aller contre son propre plan.           │
 * │                                                                    │
 * │ Le seuil n'est pas inventé non plus : c'est le nombre de jours    │
 * │ par semaine du programme actif. Sans programme, pas de série —    │
 * │ et le composant se tait plutôt que d'afficher un zéro accusateur. │
 * └────────────────────────────────────────────────────────────────────┘
 */
export default function StreakStrip() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    api.streak()
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || !(data.target_per_week > 0)) return null;

  const { current, best, weeks, this_week: thisWeek, target_per_week: target } = data;
  const remaining = data.remaining_this_week ?? 0;

  return (
    <div className="streak">
      <div className="streak-head">
        <span
          className={`streak-count${current > 0 ? ' pop-in' : ''}`}
          key={current}
        >
          {current}
        </span>
        <span className="streak-label">
          semaine{current > 1 ? 's' : ''} d’affilée
          {best > current && (
            <span className="streak-best"> · record {best}</span>
          )}
        </span>
      </div>

      <div className="streak-weeks" role="img" aria-label={data.note}>
        {weeks.map((w) => (
          <span
            key={w.week_start}
            className="streak-week"
            data-met={w.met ? '' : undefined}
            data-now={w.in_progress ? '' : undefined}
            title={`Semaine du ${w.week_start} : ${w.sessions} séance(s) sur ${w.target}`}
          >
            {/* La hauteur dit le volume, la couleur dit l'objectif. Une
                semaine à 3 sur 4 doit se voir comme un quasi-succès, pas
                comme un échec plat. */}
            <span
              className="streak-bar"
              style={{ height: `${Math.min(100, (w.sessions / Math.max(1, w.target)) * 100)}%` }}
            />
          </span>
        ))}
      </div>

      <p className="streak-note">
        {remaining > 0
          ? `Encore ${remaining} séance${remaining > 1 ? 's' : ''} cette semaine pour `
            + `${current > 0 ? 'prolonger' : 'lancer'} la série.`
          : `${thisWeek} séances sur ${target} cette semaine — objectif tenu.`}
      </p>
    </div>
  );
}
