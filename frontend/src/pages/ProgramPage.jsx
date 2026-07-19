import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Programme d'entraînement.
 *
 * Le programme est généré à partir du radar : les axes les plus faibles
 * reçoivent davantage d'exercices. On affiche le RAISONNEMENT (quels
 * axes, quels scores) — sans lui, l'utilisateur subit une boîte noire et
 * n'a aucune raison de suivre le plan.
 */

const GOALS = [
  { key: 'equilibre', label: 'Équilibré', hint: '4 × 8, repos 2 min' },
  { key: 'force', label: 'Force', hint: '5 × 4 à 85 %, repos 3 min' },
  { key: 'hypertrophie', label: 'Hypertrophie', hint: '4 × 10 à 70 %, repos 1 min 30' },
  { key: 'mobilite', label: 'Mobilité & santé', hint: '3 × 12, repos 1 min' },
];

const AXIS_LABELS = {
  push: 'Force Poussée', pull: 'Force Tirage', legs: 'Jambes',
  endurance: 'Endurance', mobility: 'Mobilité', flexibility: 'Souplesse',
  explosive: 'Explosivité', core: 'Gainage',
};

const FOCUS_LABELS = {
  push: 'Poussée', pull: 'Tirage', legs: 'Jambes',
  mobility: 'Mobilité', explosive: 'Explosivité', endurance: 'Endurance',
};

/**
 * Chaîne de décision du générateur.
 *
 * Sans elle, le programme est une liste d'exercices tombée du ciel. On
 * montre la règle, puis son application axe par axe : score mesuré →
 * règle déclenchée → volume obtenu.
 */
/** Repères de volume, rendus visuellement plutôt qu'en texte. */
function VolumeLandmarks({ landmarks }) {
  const max = landmarks.maximum_recoverable;
  const marks = [
    { at: landmarks.maintenance, label: 'Entretien', color: 'var(--text-muted)' },
    { at: landmarks.minimum_effective, label: 'Progression', color: 'var(--series-1)' },
    { at: landmarks.adaptive_range[1], label: 'Optimal', color: 'var(--good)' },
    { at: max, label: 'Plafond', color: 'var(--warning)' },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <div className="stat-label" style={{ marginBottom: 10 }}>
        Repères de volume (séries par muscle et par semaine)
      </div>
      <div style={{ position: 'relative', height: 10 }}>
        <div className="gauge" style={{ height: 10 }}>
          <div
            className="gauge-fill"
            style={{
              width: `${(landmarks.adaptive_range[1] / max) * 100}%`,
              background: 'linear-gradient(90deg, var(--surface-3), var(--series-1), var(--good))',
            }}
          />
        </div>
      </div>
      <div style={{ position: 'relative', height: 30, marginTop: 2 }}>
        {marks.map((m) => (
          <span
            key={m.label}
            style={{
              position: 'absolute', left: `${Math.min(97, (m.at / max) * 100)}%`,
              transform: 'translateX(-50%)', fontSize: 10, textAlign: 'center',
              color: m.color, whiteSpace: 'nowrap',
            }}
          >
            {m.at}
            <span style={{ display: 'block', color: 'var(--text-muted)' }}>{m.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HowItWorks({ rationale }) {
  const [open, setOpen] = useState(false);
  const table = rationale?.volume_table ?? [];
  const lm = rationale?.landmarks;

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h2 className="card-title">Comment ce programme a été construit</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {rationale?.total_weekly_sets} séries hebdomadaires · {rationale?.total_exercises} exercices
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>La méthode</div>
          <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13, lineHeight: 1.65 }}>
            {(rationale?.method ?? []).map((m, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{m}</li>
            ))}
          </ol>

          {lm && <VolumeLandmarks landmarks={lm} />}

          <div className="stat-label" style={{ margin: '18px 0 8px' }}>
            Volume hebdomadaire par axe
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <caption className="visually-hidden">
                Score, volume hebdomadaire visé et fréquence par axe
              </caption>
              <thead>
                <tr>
                  <th scope="col">Axe</th>
                  <th scope="col">Score</th>
                  <th scope="col">Séries/sem.</th>
                  <th scope="col">Séances</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.axis}>
                    <th scope="row" style={{ fontWeight: 500 }}>
                      {AXIS_LABELS[row.axis] ?? row.axis}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {row.exercises_per_session} exo × {row.sets_per_exercise} séries
                      </div>
                    </th>
                    <td style={{ fontWeight: 700 }}>{Math.round(row.score)}</td>
                    <td style={{ fontWeight: 700 }}>
                      {row.actual_weekly_sets}
                      {row.capped_by_frequency && (
                        <span style={{ color: 'var(--warning)' }} title="Limité par la fréquence">
                          {' '}▲
                        </span>
                      )}
                    </td>
                    <td style={{ color: row.meets_frequency ? 'var(--good)' : 'var(--warning)' }}>
                      {row.sessions_per_week}×
                    </td>
                    <td style={{ color: allocationColor(row.score), fontSize: 12 }}>
                      {row.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(rationale?.warnings ?? []).map((w, i) => (
            <p key={i} style={{
              fontSize: 12, color: 'var(--warning)', marginTop: 10, marginBottom: 0,
              lineHeight: 1.5,
            }}>
              ▲ {w}
            </p>
          ))}

          {rationale?.sources?.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--grid)' }}>
              <div className="stat-label" style={{ marginBottom: 8 }}>Sources</div>
              <ul style={{
                paddingLeft: 18, margin: 0, fontSize: 11,
                color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                {rationale.sources.map((s) => (
                  <li key={s.claim} style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.claim}</span>
                    {' — '}{s.source}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
            Les scores viennent du radar, calculé sur tes 90 derniers jours.
            Un axe sans données part de 0 et sera donc priorisé.
          </p>
        </div>
      )}
    </div>
  );
}

const allocationColor = (score) => (
  score < 30 ? 'var(--critical)' : score < 55 ? 'var(--warning)' : 'var(--text-secondary)'
);

/** Une ligne d'exercice, dépliable sur sa justification. */
function ProgramItem({ item }) {
  const [open, setOpen] = useState(false);
  const r = item.rationale ?? {};

  return (
    <li style={{ borderBottom: '1px solid var(--grid)' }}>
      <div className="log-line" style={{ alignItems: 'flex-start', borderBottom: 'none' }}>
        <span style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
          <img
            src={item.gif_url} alt="" loading="lazy" decoding="async"
            className="exercise-thumb" style={{ width: 38, height: 38 }}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
          <span style={{ minWidth: 0 }}>
            <span className="exercise-name">{item.name_fr}</span>
            <span className="exercise-meta">
              {item.target}
              {item.note ? ` · ${item.note}` : ''}
            </span>
          </span>
        </span>
        <span className="log-value" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {item.target_seconds
            ? `${item.target_sets} × ${item.target_seconds} s`
            : `${item.target_sets} × ${item.target_reps}`}
          {item.suggested_kg != null && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--series-1)' }}>
              {Number(item.suggested_kg)} kg
            </span>
          )}
        </span>
      </div>

      {r.why_here && (
        <>
          <button
            type="button"
            className="table-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ marginBottom: 8, fontSize: 12 }}
          >
            {open ? 'Masquer' : 'Pourquoi cet exercice ?'}
          </button>

          {open && (
            <dl style={{
              margin: '0 0 12px', fontSize: 12, display: 'grid', gap: 6,
              padding: '10px 12px', background: 'var(--surface-2)',
              borderRadius: 10, border: '1px solid var(--border)',
            }}>
              <Reason label="Axe visé">
                {AXIS_LABELS[r.axis] ?? r.axis}
                {r.axis_score != null && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}— ton score : {Math.round(r.axis_score)}/100
                  </span>
                )}
              </Reason>
              <Reason label="Volume attribué">
                {r.allocation} · {r.why_here}
              </Reason>
              {r.actual_weekly_sets != null && (
                <Reason label="Dose hebdomadaire">
                  {r.actual_weekly_sets} séries/semaine sur {r.sessions_per_week} séance(s)
                </Reason>
              )}
              <Reason label="Choix du mouvement">{r.why_this_one}</Reason>
              <Reason label="Charge">{r.load_basis}</Reason>
              {item.rest_seconds && (
                <Reason label="Repos">{item.rest_seconds} s entre les séries</Reason>
              )}
            </dl>
          )}
        </>
      )}
    </li>
  );
}

function Reason({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <dt style={{ color: 'var(--text-muted)', minWidth: 118, flex: 'none' }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{children}</dd>
    </div>
  );
}

function ProgramDay({ day }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="pill">Jour {day.day_index}</span>
        <h3 className="card-title" style={{ margin: 0, flex: 1 }}>{day.title}</h3>
        {day.focus && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {FOCUS_LABELS[day.focus] ?? day.focus}
          </span>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
        {day.items.map((it) => <ProgramItem key={it.id} item={it} />)}
      </ul>
    </div>
  );
}

export default function ProgramPage() {
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [goal, setGoal] = useState('equilibre');
  const [daysPerWeek, setDaysPerWeek] = useState(4);

  const load = () => {
    setLoading(true);
    api.activeProgram()
      .then(setProgram)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await api.generateProgram({
        goal, days_per_week: daysPerWeek, weeks: 4,
      });
      const full = await api.program(created.id);
      setProgram(full);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <p className="empty">Chargement du programme…</p>;

  const rationale = program?.rationale;

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2 className="card-title">Générer un programme</h2>
        <p className="card-sub">
          Le volume est réparti selon tes points faibles mesurés sur le radar.
        </p>

        <div className="field-block" style={{ marginTop: 8 }}>
          <label htmlFor="goal-select">Objectif</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GOALS.map((g) => (
              <button
                key={g.key} type="button" className="tab"
                aria-selected={goal === g.key} onClick={() => setGoal(g.key)}
                title={g.hint}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {GOALS.find((g) => g.key === goal)?.hint}
          </p>
        </div>

        <div className="field-block" style={{ marginTop: 10 }}>
          <label htmlFor="days-select">Jours par semaine</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[2, 3, 4, 5, 6].map((d) => (
              <button
                key={d} type="button" className="tab"
                aria-selected={daysPerWeek === d} onClick={() => setDaysPerWeek(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button" className="btn-primary"
          onClick={generate} disabled={generating}
        >
          {generating ? 'Génération…' : program ? 'Régénérer le programme' : 'Générer'}
        </button>

        {program && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Régénérer remplace le programme actif. L’historique des séances est
            conservé.
          </p>
        )}
      </div>

      {!program && (
        <div className="card">
          <p className="empty">
            Aucun programme actif. Choisis un objectif et génère-en un.
          </p>
        </div>
      )}

      {program && (
        <>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h2 className="card-title">{program.name}</h2>
                <p className="card-sub" style={{ margin: 0 }}>
                  {program.days_per_week} jours/semaine · {program.weeks} semaines
                </p>
              </div>
              <span className="pill" style={{ color: 'var(--good)' }}>Actif</span>
            </div>

            {rationale?.summary && (
              <p style={{ fontSize: 14, marginTop: 14, marginBottom: 0 }}>
                {rationale.summary}
              </p>
            )}

            {rationale?.weakest_axes?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="stat-label" style={{ marginBottom: 8 }}>
                  Axes renforcés
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {rationale.weakest_axes.map((w) => (
                    <div key={w.axis}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 13, marginBottom: 4,
                      }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {AXIS_LABELS[w.axis] ?? w.axis}
                        </span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(w.score)}/100
                        </strong>
                      </div>
                      <div className="gauge" style={{ height: 6 }}>
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${w.score}%`,
                            background: w.score < 30 ? 'var(--critical)'
                              : w.score < 55 ? 'var(--warning)' : 'var(--series-1)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <HowItWorks rationale={rationale} />

          {program.days.map((day) => <ProgramDay key={day.id} day={day} />)}
        </>
      )}
    </div>
  );
}
