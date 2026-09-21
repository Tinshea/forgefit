import { useState } from 'react';
import { api } from '../lib/api.js';
import EvidenceBadge from './EvidenceBadge.jsx';
import { muscleLabel } from '../lib/anatomy.js';
import ExercisePicker from './ExercisePicker.jsx';

/**
 * Édition d'un programme.
 *
 * Tout programme est modifiable, quelle que soit sa provenance : généré,
 * issu d'un modèle ou composé de zéro. Le raisonnement d'origine est
 * conservé tel quel dans `rationale` — il dit pourquoi le programme
 * était ainsi AU DÉPART, pas ce qu'il est devenu. Le confondre avec
 * l'état courant serait mentir sur la suite.
 *
 * Chaque écriture recharge le programme complet depuis l'API plutôt que
 * de rapiécer l'état local : les positions, l'ordre et les contraintes
 * de la base font autorité, pas l'optimisme du navigateur.
 */

/** 1 = lundi … 7 = dimanche, comme côté serveur (ISO 8601). */
const WEEKDAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

const FOCUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'push', label: 'Poussée' },
  { value: 'pull', label: 'Tirage' },
  { value: 'legs', label: 'Jambes' },
  { value: 'core', label: 'Tronc' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'endurance', label: 'Endurance' },
];

/** Champ numérique compact, vidable. */
function NumField({ label, value, onCommit, min = 0, step = 1, suffix }) {
  const [draft, setDraft] = useState(value ?? '');

  return (
    <label style={{ display: 'grid', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" min={min} step={step} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // On valide à la sortie du champ, pas à chaque frappe : une
          // requête par caractère saisi saturerait l'API pour rien.
          onBlur={() => {
            const next = draft === '' ? null : Number(draft);
            if (next !== (value ?? null)) onCommit(next);
          }}
          style={{ width: 62, padding: '4px 6px', fontSize: 13 }}
        />
        {suffix && <span>{suffix}</span>}
      </span>
    </label>
  );
}

function EditableItem({ programId, item, onChanged, onError }) {
  const [open, setOpen] = useState(false);
  const r = item.rationale ?? {};

  const patch = async (body) => {
    try {
      await api.updateProgramItem(programId, item.id, body);
      await onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  const remove = async () => {
    try {
      await api.deleteProgramItem(programId, item.id);
      await onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  const isTimed = item.target_seconds != null;

  return (
    <li style={{ borderBottom: '1px solid var(--grid)', padding: '10px 0' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <img
          src={item.gif_url} alt="" loading="lazy" decoding="async"
          className="exercise-thumb" style={{ width: 38, height: 38 }}
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="exercise-name">{item.name_fr}</span>
            <EvidenceBadge tier={item.evidence_tier} />
          </div>
          <span className="exercise-meta">{muscleLabel(item.target)}</span>
        </div>
        <button
          type="button" className="btn-ghost"
          onClick={remove}
          aria-label={`Retirer ${item.name_fr}`}
          style={{ color: 'var(--critical)', padding: '2px 8px' }}
        >
          ✕
        </button>
      </div>

      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, marginLeft: 48,
      }}>
        <NumField
          label="Séries" value={item.target_sets} min={1}
          onCommit={(v) => patch({ target_sets: v })}
        />
        {isTimed ? (
          <NumField
            label="Durée" value={item.target_seconds} min={1} suffix="s"
            onCommit={(v) => patch({ target_seconds: v })}
          />
        ) : (
          <>
            <NumField
              label="Reps min" value={item.target_reps} min={1}
              onCommit={(v) => patch({ target_reps: v })}
            />
            <NumField
              label="Reps max" value={item.target_reps_max} min={1}
              onCommit={(v) => patch({ target_reps_max: v })}
            />
            <NumField
              label="Charge" value={item.suggested_kg} step={2.5} suffix="kg"
              onCommit={(v) => patch({ suggested_kg: v })}
            />
          </>
        )}
        <NumField
          label="Repos" value={item.rest_seconds} step={15} suffix="s"
          onCommit={(v) => patch({ rest_seconds: v })}
        />
      </div>

      {(r.why_this_one || r.why_here) && (
        <>
          <button
            type="button" className="table-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ marginTop: 8, marginLeft: 48, fontSize: 12 }}
          >
            {open ? 'Masquer' : 'Pourquoi cet exercice ?'}
          </button>
          {open && (
            <div style={{
              margin: '8px 0 0 48px', fontSize: 12, padding: '10px 12px',
              background: 'var(--surface-2)', borderRadius: 10,
              border: '1px solid var(--border)', lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              {r.pattern_label && (
                <p style={{ margin: '0 0 6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Patron : </span>
                  {r.pattern_label}
                </p>
              )}
              {r.why_this_one && <p style={{ margin: '0 0 6px' }}>{r.why_this_one}</p>}
              {r.why_here && <p style={{ margin: '0 0 6px' }}>{r.why_here}</p>}
              {r.load_basis && (
                <p style={{ margin: '0 0 6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Charge : </span>
                  {r.load_basis}
                </p>
              )}
              {(item.evidence_sources ?? []).length > 0 && (
                <ul style={{ paddingLeft: 16, margin: '8px 0 0', fontSize: 11 }}>
                  {item.evidence_sources.map((s) => (
                    <li key={s.key} style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                      {s.citation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function EditableDay({ programId, day, onChanged, onError }) {
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(day.title);

  const move = async (index, direction) => {
    const ids = day.items.map((i) => i.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await api.reorderProgramItems(programId, day.id, ids);
      await onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  const addExercise = async (exercise) => {
    try {
      // Les étirements et le gainage se dosent en secondes, les séries
      // en répétitions : proposer « 3 × 10 » pour un étirement ferait
      // saisir une valeur qui n'a pas de sens.
      const timed = ['souplesse', 'mobilite'].includes(exercise.discipline);
      await api.addProgramItem(programId, day.id, {
        exercise_id: exercise.id,
        target_sets: 3,
        ...(timed ? { target_seconds: 40 } : { target_reps: 8, target_reps_max: 12 }),
        rest_seconds: timed ? 45 : 120,
      });
      setPicking(false);
      await onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  const removeDay = async () => {
    try {
      await api.deleteProgramDay(programId, day.id);
      await onChanged();
    } catch (e) {
      onError(e.message);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="pill">Jour {day.day_index}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={async () => {
            if (title.trim() && title !== day.title) {
              try {
                await api.updateProgramDay(programId, day.id, { title: title.trim() });
                await onChanged();
              } catch (e) { onError(e.message); }
            }
          }}
          aria-label="Titre de la séance"
          style={{ flex: 1, minWidth: 140, fontWeight: 600, padding: '4px 8px' }}
        />
        {/* Le jour de la semaine, pas l'ordre : l'espacement fait partie
            du dosage, puisque c'est la récupération qui limite. Déplacer
            une séance sur un jour déjà pris échange les deux. */}
        <select
          value={day.weekday ?? ''}
          aria-label="Jour de la semaine"
          onChange={async (e) => {
            try {
              await api.updateProgramDay(programId, day.id, {
                weekday: e.target.value ? Number(e.target.value) : null,
              });
              await onChanged();
            } catch (err) { onError(err.message); }
          }}
          style={{ padding: '4px 8px', fontSize: 13 }}
        >
          <option value="">Non planifié</option>
          {WEEKDAYS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
        <select
          value={day.focus ?? ''}
          aria-label="Dominante de la séance"
          onChange={async (e) => {
            try {
              await api.updateProgramDay(programId, day.id, { focus: e.target.value || null });
              await onChanged();
            } catch (err) { onError(err.message); }
          }}
          style={{ padding: '4px 8px', fontSize: 13 }}
        >
          {FOCUS_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button
          type="button" className="btn-ghost" onClick={removeDay}
          style={{ color: 'var(--critical)' }}
        >
          Supprimer
        </button>
      </div>

      {/* Heure et durée : un agenda externe ne sait pas afficher
          « lundi », il lui faut un début et une fin. Ces deux champs
          sont ce que l'export iCalendar transporte. */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <label style={{ display: 'grid', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
          Heure
          <input
            type="time" defaultValue={(day.start_time ?? '18:00:00').slice(0, 5)}
            onBlur={async (e) => {
              if (!e.target.value) return;
              try {
                await api.updateProgramDay(programId, day.id, { start_time: e.target.value });
                await onChanged();
              } catch (err) { onError(err.message); }
            }}
            style={{ padding: '4px 6px', fontSize: 13 }}
          />
        </label>
        <NumField
          label="Durée" value={day.duration_minutes} min={5} step={5} suffix="min"
          onCommit={async (v) => {
            if (v == null) return;
            try {
              await api.updateProgramDay(programId, day.id, { duration_minutes: v });
              await onChanged();
            } catch (err) { onError(err.message); }
          }}
        />
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {day.items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: 2, paddingTop: 12 }}>
              <button
                type="button" className="btn-ghost" onClick={() => move(i, -1)}
                disabled={i === 0} aria-label="Monter"
                style={{ padding: '0 6px', lineHeight: 1.4 }}
              >
                ▲
              </button>
              <button
                type="button" className="btn-ghost" onClick={() => move(i, 1)}
                disabled={i === day.items.length - 1} aria-label="Descendre"
                style={{ padding: '0 6px', lineHeight: 1.4 }}
              >
                ▼
              </button>
            </div>
            <EditableItem
              programId={programId} item={item}
              onChanged={onChanged} onError={onError}
            />
          </div>
        ))}
      </ul>

      {!day.items.length && (
        <p className="empty" style={{ margin: '12px 0' }}>
          Séance vide. Ajoute un premier exercice.
        </p>
      )}

      {picking ? (
        <div style={{ marginTop: 12 }}>
          <ExercisePicker onPick={addExercise} onCancel={() => setPicking(false)} />
        </div>
      ) : (
        <button
          type="button" className="btn-ghost"
          onClick={() => setPicking(true)}
          style={{ marginTop: 12 }}
        >
          + Ajouter un exercice
        </button>
      )}
    </div>
  );
}

export default function ProgramEditor({ program, onChanged }) {
  const [error, setError] = useState(null);
  const [name, setName] = useState(program.name);

  const addDay = async () => {
    try {
      await api.addProgramDay(program.id, {
        title: `Séance ${(program.days?.length ?? 0) + 1}`,
      });
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="field-block">
          <label htmlFor="program-name">Nom du programme</label>
          <input
            id="program-name" value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              if (name.trim() && name !== program.name) {
                try {
                  await api.updateProgram(program.id, { name: name.trim() });
                  await onChanged();
                } catch (e) { setError(e.message); }
              }
            }}
          />
        </div>
        <div className="field-block">
          <label htmlFor="program-start">Début du cycle</label>
          <input
            id="program-start" type="date" value={program.starts_on ?? ''}
            onChange={async (e) => {
              if (!e.target.value) return;
              try {
                await api.updateProgram(program.id, { starts_on: e.target.value });
                await onChanged();
              } catch (err) { setError(err.message); }
            }}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Détermine la semaine du programme affichée au calendrier, et la date
            de fin ({program.weeks} semaines).
          </p>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Les modifications sont enregistrées dès que tu quittes un champ. Le
          raisonnement d’origine reste affiché tel quel : il dit pourquoi le
          programme était ainsi au départ, pas ce qu’il est devenu.
        </p>
      </div>

      {(program.days ?? []).map((day) => (
        <EditableDay
          key={day.id} programId={program.id} day={day}
          onChanged={onChanged} onError={setError}
        />
      ))}

      <div className="card">
        <button type="button" className="btn-primary" onClick={addDay}>
          + Ajouter une séance
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
          Sept séances au maximum : au-delà, la semaine est pleine.
        </p>
      </div>
    </div>
  );
}
