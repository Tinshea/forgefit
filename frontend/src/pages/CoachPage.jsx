import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Aujourd'hui — ce que le coach propose, et pourquoi.
 *
 * ┌─ LA RAISON EST AUSSI IMPORTANTE QUE LA CONSIGNE ──────────────────┐
 * │ Un écran qui dirait seulement « technique, 60 min » serait un     │
 * │ oracle : on l'applique ou on l'ignore, sans pouvoir le discuter.  │
 * │                                                                    │
 * │ Les raisons sont donc affichées AU MÊME RANG que la consigne, et  │
 * │ l'état qui a servi à décider — charge, plan de la semaine, ce qui │
 * │ est déjà fait — est consultable juste en dessous. On doit pouvoir │
 * │ dire « non » en sachant à quoi on dit non.                        │
 * └────────────────────────────────────────────────────────────────────┘
 */

const GRADES = [
  { kyu: 9, label: '9e kyu — blanche' }, { kyu: 8, label: '8e kyu — jaune' },
  { kyu: 7, label: '7e kyu — orange' }, { kyu: 6, label: '6e kyu — verte' },
  { kyu: 5, label: '5e kyu — bleue' }, { kyu: 4, label: '4e kyu — violette' },
  { kyu: 3, label: '3e kyu — marron' }, { kyu: 2, label: '2e kyu — marron' },
  { kyu: 1, label: '1er kyu — marron' },
];

export default function CoachPage({ navigate }) {
  const [data, setData] = useState(null);
  const [disciplines, setDisciplines] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [reglage, setReglage] = useState(false);
  const [demarrage, setDemarrage] = useState(false);

  /**
   * Ouvre la séance prévue, puis va au journal.
   *
   * Si une séance est déjà en cours, on ne la double pas : l'écran
   * Séance la retrouvera de lui-même.
   */
  const demarrer = async () => {
    setDemarrage(true);
    try {
      const enCours = await api.openSession().catch(() => null);
      if (!enCours) {
        const jour = data?.session?.program_day_id;
        await api.createSession(jour ? { program_day_id: jour } : {});
      }
    } catch (e) {
      setErreur(e.message);
    } finally {
      setDemarrage(false);
      navigate?.('entrainement', 'seance');
    }
  };

  const charger = () => api.coachToday()
    .then(setData)
    .catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
    api.coachGoal().then((d) => setDisciplines(d.disciplines ?? [])).catch(() => {});
  }, []);

  if (erreur) return <div className="error-banner">{erreur}</div>;
  if (!data) return <p className="empty">Chargement…</p>;

  // Rien de prévu et aucun objectif : il n'y a rien à dire, et le dire
  // vaut mieux qu'inventer une séance.
  if (!data.session && !data.goal) {
    return (
      <Objectif
        disciplines={disciplines}
        actuel={null}
        onFait={() => { setReglage(false); charger(); }}
        onAnnuler={null}
      />
    );
  }

  if (reglage) {
    return (
      <Objectif
        disciplines={disciplines}
        actuel={data.goal}
        onFait={() => { setReglage(false); charger(); }}
        onAnnuler={data.goal ? () => setReglage(false) : null}
      />
    );
  }

  const { session, etat, sources } = data;
  if (!session) return <p className="empty">Rien de prévu aujourd’hui.</p>;
  const prevue = session.nature === 'prevue';

  return (
    <div className="grid">
      <div className={`card coach-card${session.prioritaire ? ' coach-prioritaire' : ''}`}>
        <div className="coach-head">
          <div>
            <div className="stat-label">
              {prevue ? 'Aujourd’hui · à ton programme' : 'Aujourd’hui · proposition'}
            </div>
            <h2 className="card-title" style={{ margin: '4px 0 0' }}>{session.label}</h2>
          </div>
          {session.minutes > 0 && (
            <div className="coach-duree">{session.minutes}<span> min</span></div>
          )}
        </div>

        {session.prioritaire && (
          <p className="coach-alerte">
            Ceci passe avant le plan de la semaine.
          </p>
        )}

        {/* Les alertes de charge sur une séance PRÉVUE : elles informent,
            elles ne remplacent pas le plan. C'est à toi de décider de
            repousser, avec de quoi décider. */}
        {prevue && session.alertes?.length > 0 && session.alertes.map((a) => (
          <p className="coach-alerte" key={a.texte}>
            {a.texte}
            {' '}<strong>La séance reste à ton programme — à toi de voir.</strong>
          </p>
        ))}

        {/* Les raisons, au même rang que la consigne. */}
        <ul className="coach-raisons">
          {session.raisons.map((r) => (
            <li key={r.texte}>
              {r.texte}
              {r.source && sources?.[r.source] && (
                <span className="coach-source" title={sources[r.source]}>
                  {sources[r.source].split('(')[0].trim()}
                </span>
              )}
            </li>
          ))}
        </ul>

        {session.contenu && (
          <div className="coach-blocs">
            {session.contenu.blocs.map((b) => (
              <div className="coach-bloc" key={b.label}>
                <div className="coach-bloc-tete">
                  <strong>{b.label}</strong>
                  <span>{b.minutes} min</span>
                </div>
                <p className="coach-bloc-detail">{b.detail}</p>
                {b.note && <p className="coach-bloc-note">{b.note}</p>}
                {b.cles?.length > 0 && (
                  <ul className="coach-cles">
                    {b.cles.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {session.contenu?.avertissement && (
          <p className="coach-avertissement">{session.contenu.avertissement}</p>
        )}

        {prevue && (
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            {/* ┌─ LE BOUTON DÉMARRE VRAIMENT ────────────────────────┐
                │ Il se contentait de naviguer vers l'écran Séance, où │
                │ il fallait recliquer sur la même séance. Il ouvre    │
                │ maintenant la séance prévue, puis navigue : l'écran  │
                │ la retrouve au montage, en cours.                    │
                └─────────────────────────────────────────────────────┘ */}
            <button
              type="button" className="btn-primary" disabled={demarrage}
              onClick={demarrer}
            >
              {demarrage ? 'Ouverture…' : 'Démarrer la séance'}
            </button>
            <button
              type="button" className="btn-ghost"
              onClick={() => navigate?.('entrainement', 'calendrier')}
            >
              Voir la semaine
            </button>
          </div>
        )}
      </div>

      <Etat
        etat={etat} goal={data.goal} disciplines={disciplines}
        onRegler={() => setReglage(true)}
      />
    </div>
  );
}

/** L'état qui a servi à décider. Sans lui, la recommandation est à croire. */
function Etat({ etat, goal, onRegler, disciplines = [] }) {
  const nom = goal
    ? disciplines.find((d) => d.key === goal.discipline)?.label ?? goal.discipline
    : null;
  const lignes = [
    ['Objectif', goal
      ? `${nom} · ${goal.grade}e kyu · ${goal.seances} séances par semaine`
      : 'aucun — le coach suit ton programme'],
    ['Charge récente', etat.acwr != null
      ? `${etat.acwr.toFixed(2)} × ta charge habituelle`
      : etat.acwr_note ?? 'pas encore mesurable'],
    ['Monotonie', etat.monotonie != null
      ? etat.monotonie.toFixed(2)
      : etat.monotonie_note ?? 'pas encore mesurable'],
    ['Séances sur 28 jours', String(etat.seances_28j)],
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Ce qui a décidé</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Tu peux dire non — mais en sachant à quoi.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onRegler}>
          {goal ? 'Changer d’objectif' : 'Fixer un objectif'}
        </button>
      </div>

      <dl className="coach-etat">
        {lignes.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {etat.plan && (
        <>
          <div className="stat-label" style={{ marginTop: 16, marginBottom: 8 }}>
            La semaine
          </div>
          <div className="coach-semaine">
            {Object.entries(etat.plan).map(([nature, prevu]) => {
              const fait = etat.fait?.[nature] ?? 0;
              return (
                <div className="coach-part" key={nature}>
                  <div className="coach-part-tete">
                    <span>{nature}</span>
                    <strong>{fait} / {prevu}</strong>
                  </div>
                  <div className="gauge" style={{ height: 8 }}>
                    <div
                      className="gauge-fill"
                      style={{
                        width: `${Math.min(100, prevu ? (fait / prevu) * 100 : 0)}%`,
                        background: fait >= prevu ? 'var(--good)' : 'var(--brand)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Objectif({ disciplines, actuel, onFait, onAnnuler }) {
  const [discipline, setDiscipline] = useState(actuel?.discipline ?? 'karate');
  const [grade, setGrade] = useState(actuel?.grade ?? 9);
  const [seances, setSeances] = useState(actuel?.seances ?? 3);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const enregistrer = async (e) => {
    e.preventDefault();
    setOccupe(true);
    setErreur(null);
    try {
      await api.setCoachGoal({ discipline, grade: Number(grade), sessions_per_week: Number(seances) });
      await onFait();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Ton objectif</h2>
      <p className="card-sub">
        Tu le poses une fois. Ensuite, c’est l’application qui dit quoi faire.
      </p>

      {erreur && <div className="error-banner">{erreur}</div>}

      <form onSubmit={enregistrer}>
        <div className="field-block">
          <label htmlFor="coach-discipline">Discipline</label>
          <select
            id="coach-discipline" value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          >
            {disciplines.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>

        <div className="field-block">
          <label htmlFor="coach-grade">Grade actuel</label>
          <select id="coach-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => <option key={g.kyu} value={g.kyu}>{g.label}</option>)}
          </select>
        </div>

        <div className="field-block">
          <label htmlFor="coach-seances">Séances par semaine</label>
          <select id="coach-seances" value={seances} onChange={(e) => setSeances(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n} séance{n > 1 ? 's' : ''}</option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Ce à quoi tu t’engages vraiment, pas ce que tu voudrais. Le plan
            s’équilibre sur ce nombre.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn-primary" disabled={occupe}>
            {occupe ? 'Un instant…' : 'Enregistrer'}
          </button>
          {onAnnuler && (
            <button type="button" className="btn-ghost" onClick={onAnnuler}>Annuler</button>
          )}
        </div>
      </form>
    </div>
  );
}
