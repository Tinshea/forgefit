import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TemplateGallery from '../components/TemplateGallery.jsx';
import ProgramEditor from '../components/ProgramEditor.jsx';
import EvidenceBadge from '../components/EvidenceBadge.jsx';
import { muscleLabel } from '../lib/anatomy.js';
import { dec } from '../lib/format.js';
import ProgramMuscleMap from '../components/ProgramMuscleMap.jsx';
import ExerciseSheet from '../components/ExerciseSheet.jsx';

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

const WEEKDAY_LABELS = {
  1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi',
  5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche',
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

/**
 * Tableau de volume d'un programme issu d'un modèle.
 *
 * Le générateur raisonne par AXE (il part du radar), un modèle par
 * GROUPE MUSCULAIRE (il part de la dose-réponse). Les deux tableaux ne
 * portent donc pas sur la même chose, et les fondre en un seul ferait
 * croire à une équivalence qui n'existe pas.
 */
function MuscleVolumeTable({ muscles }) {
  const targeted = muscles.filter((m) => m.is_targeted);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <caption className="visually-hidden">
          Volume hebdomadaire et fréquence par groupe musculaire
        </caption>
        <thead>
          <tr>
            <th scope="col">Muscle</th>
            <th scope="col">Séries/sem.</th>
            <th scope="col">Séances</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {targeted.map((m) => (
            <tr key={m.muscle}>
              <th scope="row" style={{ fontWeight: 500 }}>{m.label}</th>
              <td style={{ fontWeight: 700 }}>{m.weekly_sets}</td>
              <td style={{ color: m.meets_frequency ? 'var(--good)' : 'var(--warning)' }}>
                {m.sessions_per_week}×
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {m.volume_label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HowItWorks({ rationale }) {
  const [open, setOpen] = useState(false);
  const table = rationale?.volume_table ?? [];
  const muscles = rationale?.volume?.muscles ?? null;
  const lm = rationale?.landmarks ?? rationale?.volume?.landmarks;
  const totalSets = rationale?.total_weekly_sets ?? rationale?.volume?.total_weekly_sets;
  const totalExercises = rationale?.total_exercises ?? rationale?.volume?.total_exercises;
  const warnings = rationale?.warnings ?? rationale?.volume?.warnings ?? [];

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
            {totalSets} séries hebdomadaires · {totalExercises} exercices
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
            {muscles ? 'Volume hebdomadaire par muscle' : 'Volume hebdomadaire par axe'}
          </div>
          {muscles ? <MuscleVolumeTable muscles={muscles} /> : (
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
          )}

          {warnings.map((w, i) => (
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
                {rationale.sources.map((s, i) => (
                  <li key={s.key ?? s.claim ?? i} style={{ marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.claim}</span>
                    {/* Le générateur porte `source`, un modèle porte la
                        citation complète dans `citation`. */}
                    {s.source ? ` — ${s.source}` : <><br />{s.citation}</>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
            {table.length
              ? 'Les scores viennent du radar, calculé sur tes 90 derniers jours. '
                + 'Un axe sans données part de 0 et sera donc priorisé.'
              : 'Le dosage est celui du modèle au moment où il a été instancié. '
                + 'Si tu as modifié le programme depuis, ce tableau ne reflète plus '
                + 'son contenu.'}
          </p>
        </div>
      )}
    </div>
  );
}

const allocationColor = (score) => (
  score < 30 ? 'var(--critical)' : score < 55 ? 'var(--warning)' : 'var(--text-secondary)'
);

/** Une ligne d'exercice, dépliable sur sa justification et sa fiche. */
function ProgramItem({ item }) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
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
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="exercise-name">{item.name_fr}</span>
              <EvidenceBadge tier={item.evidence_tier} compact />
            </span>
            <span className="exercise-meta">
              {muscleLabel(item.target)}
              {item.note ? ` · ${item.note}` : ''}
            </span>
          </span>
        </span>
        <span className="log-value" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {item.target_seconds
            ? `${item.target_sets} × ${item.target_seconds} s`
            : `${item.target_sets} × ${item.target_reps}`
              + (item.target_reps_max ? `–${item.target_reps_max}` : '')}
          {item.suggested_kg != null && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--series-1)' }}>
              {Number(item.suggested_kg)} kg
            </span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Deux questions différentes : « pourquoi celui-là » relève du
            raisonnement du générateur, « quels muscles, comment » de
            l'exercice lui-même. Les mélanger sous un seul bouton
            obligeait à déplier l'un pour atteindre l'autre. */}
        <button
          type="button"
          className="table-toggle"
          onClick={() => setSheet((v) => !v)}
          aria-expanded={sheet}
          style={{ marginBottom: 8, fontSize: 12 }}
        >
          {sheet ? 'Masquer la fiche' : 'Muscles et exécution'}
        </button>
        {(r.why_here || r.why_this_one) && (
          <button
            type="button"
            className="table-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ marginBottom: 8, fontSize: 12 }}
          >
            {open ? 'Masquer' : 'Pourquoi cet exercice ?'}
          </button>
        )}
      </div>

      {sheet && (
        <div className="sheet" style={{ marginBottom: 12 }}>
          <ExerciseSheet
            exercise={{ id: item.exercise_id, ...item }}
            compact
            showEvidence={false}
          />
        </div>
      )}

      {(r.why_here || r.why_this_one) && (
        <>

          {open && (
            <dl style={{
              margin: '0 0 12px', fontSize: 12, display: 'grid', gap: 6,
              padding: '10px 12px', background: 'var(--surface-2)',
              borderRadius: 10, border: '1px solid var(--border)',
            }}>
              {r.axis && (
                <Reason label="Axe visé">
                  {AXIS_LABELS[r.axis] ?? r.axis}
                  {r.axis_score != null && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}— ton score : {Math.round(r.axis_score)}/100
                    </span>
                  )}
                </Reason>
              )}
              {r.why_here && (
                <Reason label="Volume attribué">
                  {r.allocation ? `${r.allocation} · ` : ''}{r.why_here}
                </Reason>
              )}
              {r.actual_weekly_sets != null && (
                <Reason label="Dose hebdomadaire">
                  {r.actual_weekly_sets} séries/semaine sur {r.sessions_per_week} séance(s)
                </Reason>
              )}
              {r.pattern_label && (
                <Reason label="Patron de mouvement">{r.pattern_label}</Reason>
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
        <span className="pill">
          {WEEKDAY_LABELS[day.weekday] ?? `Jour ${day.day_index}`}
        </span>
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

const ORIGIN_LABEL = {
  generated: 'Généré depuis le radar',
  template: 'Issu d’un modèle',
  manual: 'Composé à la main',
};

const TABS = [
  { key: 'actif', label: 'Actif' },
  { key: 'modeles', label: 'Modèles' },
  { key: 'generer', label: 'Générer' },
  { key: 'mes-programmes', label: 'Mes programmes' },
];

/** Formulaire du générateur, extrait pour tenir dans son propre onglet. */
function GeneratorForm({ hasProgram, onGenerated }) {
  const [goal, setGoal] = useState('equilibre');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [editAfter, setEditAfter] = useState(true);
  const [error, setError] = useState(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await api.generateProgram({
        goal, days_per_week: daysPerWeek, weeks: 4,
      });
      // Un programme généré est un POINT DE DÉPART : on l'ouvre
      // directement en édition plutôt que de laisser croire qu'il est à
      // prendre tel quel.
      await onGenerated(created.id, { edit: editAfter });
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="card">
      {error && <div className="error-banner">{error}</div>}
      <h2 className="card-title">Générer depuis ton radar</h2>
      <p className="card-sub">
        À la différence d’un modèle, le volume est réparti selon tes points faibles
        mesurés — il faut donc des séances déjà enregistrées pour que ce soit utile.
      </p>

      <div className="field-block" style={{ marginTop: 8 }}>
        <label htmlFor="goal-select">Objectif</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} id="goal-select">
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
        <div style={{ display: 'flex', gap: 6 }} id="days-select">
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

      <label style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
        color: 'var(--text-secondary)', margin: '6px 0 12px',
      }}>
        <input
          type="checkbox" checked={editAfter}
          onChange={(e) => setEditAfter(e.target.checked)}
        />
        Ouvrir l’éditeur après la génération
      </label>

      <button
        type="button" className="btn-primary"
        onClick={generate} disabled={generating}
      >
        {generating ? 'Génération…' : hasProgram ? 'Régénérer le programme' : 'Générer'}
      </button>

      {hasProgram && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          Le programme généré devient le programme actif. Le précédent est conservé
          dans « Mes programmes », et l’historique des séances n’est pas touché.
        </p>
      )}
    </div>
  );
}

/** Liste des programmes enregistrés : activer, dupliquer, supprimer. */
function ProgramList({ onOpened }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = () => api.programs()
    .then((d) => setItems(d.items))
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const createBlank = async () => {
    if (!newName.trim()) return;
    await act(async () => {
      const created = await api.createProgram({
        name: newName.trim(), days_per_week: 3, weeks: 8, activate: true,
      });
      setNewName('');
      setCreating(false);
      // Un programme vide n'a rien à montrer : on ouvre l'éditeur.
      await onOpened(created.id, { edit: true });
    });
  };

  if (error) return <div className="error-banner">{error}</div>;
  if (!items) return <p className="empty">Chargement…</p>;

  return (
    <div className="grid">
      <div className="card">
        <h2 className="card-title">Partir de zéro</h2>
        <p className="card-sub">
          Un programme vide, à remplir séance par séance. Rien n’est calculé :
          les séries, répétitions et charges sont celles que tu saisis.
        </p>
        {creating ? (
          <div style={{ marginTop: 12 }}>
            <div className="field-block">
              <label htmlFor="new-program-name">Nom</label>
              <input
                id="new-program-name" value={newName} autoFocus
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Mon programme"
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button" className="btn-primary"
                onClick={createBlank} disabled={!newName.trim()}
              >
                Créer
              </button>
              <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button" className="btn-ghost" style={{ marginTop: 12 }}
            onClick={() => setCreating(true)}
          >
            + Nouveau programme vide
          </button>
        )}
      </div>

      {!items.length && (
        <div className="card">
          <p className="empty">
            Aucun programme enregistré. Choisis un modèle ou pars de zéro.
          </p>
        </div>
      )}

      {items.map((p) => (
        <div className="card" key={p.id}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 className="card-title">{p.name}</h3>
              <p className="card-sub" style={{ margin: 0 }}>
                {p.days_per_week} j/sem · {p.weeks} sem. · {p.day_count} séance(s) ·{' '}
                {p.item_count} exercice(s)
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                {ORIGIN_LABEL[p.origin] ?? p.origin}
                {p.template_key ? ` · ${p.template_key}` : ''}
              </p>
            </div>
            {p.is_active && (
              <span className="pill" style={{ color: 'var(--good)' }}>Actif</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn-ghost" onClick={() => onOpened(p.id)}>
              Ouvrir
            </button>
            <button
              type="button" className="btn-ghost"
              onClick={() => onOpened(p.id, { edit: true })}
            >
              Modifier
            </button>
            {!p.is_active && (
              <button
                type="button" className="btn-ghost"
                onClick={() => act(() => api.updateProgram(p.id, { is_active: true }))}
              >
                Activer
              </button>
            )}
            <button
              type="button" className="btn-ghost"
              onClick={() => act(() => api.duplicateProgram(p.id))}
            >
              Dupliquer
            </button>
            <button
              type="button" className="btn-ghost" style={{ color: 'var(--critical)' }}
              onClick={() => act(() => api.deleteProgram(p.id))}
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProgramPage() {
  const [tab, setTab] = useState('actif');
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  // Le programme affiché n'est pas toujours l'actif : ouvrir une entrée
  // de la liste doit pouvoir montrer un programme inactif sans forcer à
  // l'activer d'abord.
  const [openedId, setOpenedId] = useState(null);

  const load = async (id = openedId) => {
    setLoading(true);
    try {
      const p = id ? await api.program(id) : await api.activeProgram();
      setProgram(p);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [openedId]);

  const openProgram = async (id, { edit = false } = {}) => {
    setOpenedId(id);
    setEditing(edit);
    setTab('actif');
  };

  if (tab === 'modeles') {
    return (
      <div className="grid">
        <TabBar tab={tab} setTab={setTab} />
        <TemplateGallery
          onUse={async (body) => {
            const created = await api.useTemplate(body);
            await openProgram(created.id, { edit: body.edit === true });
          }}
        />
      </div>
    );
  }

  if (tab === 'generer') {
    return (
      <div className="grid">
        <TabBar tab={tab} setTab={setTab} />
        <GeneratorForm hasProgram={!!program} onGenerated={openProgram} />
      </div>
    );
  }

  if (tab === 'mes-programmes') {
    return (
      <div className="grid">
        <TabBar tab={tab} setTab={setTab} />
        <ProgramList onOpened={openProgram} />
      </div>
    );
  }

  const rationale = program?.rationale;

  return (
    <div className="grid">
      <TabBar tab={tab} setTab={setTab} />
      {error && <div className="error-banner">{error}</div>}

      {loading && <p className="empty">Chargement du programme…</p>}

      {!loading && !program && (
        <div className="card">
          <p className="empty">
            Aucun programme actif. Choisis un modèle, génère-en un depuis ton
            radar, ou pars de zéro.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={() => setTab('modeles')}>
              Voir les modèles
            </button>
            <button type="button" className="btn-ghost" onClick={() => setTab('generer')}>
              Générer depuis le radar
            </button>
          </div>
        </div>
      )}

      {!loading && program && (
        <>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="card-title">{program.name}</h2>
                <p className="card-sub" style={{ margin: 0 }}>
                  {program.days_per_week} jours/semaine · {program.weeks} semaines
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  {ORIGIN_LABEL[program.origin] ?? program.origin}
                </p>
              </div>
              {program.is_active
                ? <span className="pill" style={{ color: 'var(--good)' }}>Actif</span>
                : <span className="pill">Inactif</span>}
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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <button
                type="button" className={editing ? 'btn-ghost' : 'btn-primary'}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? 'Terminer la modification' : 'Modifier ce programme'}
              </button>
              {!program.is_active && (
                <button
                  type="button" className="btn-ghost"
                  onClick={async () => {
                    try {
                      await api.updateProgram(program.id, { is_active: true });
                      await load(program.id);
                    } catch (e) { setError(e.message); }
                  }}
                >
                  Rendre actif
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <ProgramEditor program={program} onChanged={() => load(program.id)} />
          ) : (
            <>
              {program.muscle_volume?.muscles?.length > 0 && (
                <div className="card">
                  <h2 className="card-title">Ce que ce programme travaille</h2>
                  <p className="card-sub">
                    {dec(program.muscle_volume.total_sets)} séries par semaine, réparties
                    sur {program.muscle_volume.muscles.length} muscles
                  </p>
                  <ProgramMuscleMap volume={program.muscle_volume} title="" />
                </div>
              )}
              {(rationale?.method?.length > 0 || rationale?.volume_table) && (
                <HowItWorks rationale={rationale} />
              )}
              {program.days.map((day) => <ProgramDay key={day.id} day={day} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TabBar({ tab, setTab }) {
  return (
    <div className="tabs" role="tablist" aria-label="Vue du programme">
      {TABS.map((t) => (
        <button
          key={t.key} type="button" className="tab" role="tab"
          aria-selected={tab === t.key} onClick={() => setTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
