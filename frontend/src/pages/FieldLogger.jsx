import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import HydrationCard from '../components/HydrationCard.jsx';

/**
 * Mode Terrain (mobile-first).
 *
 * Contrainte : entre deux series, l'utilisateur est essouffle, une main
 * prise, parfois avec des gants. Tout se joue en trois gestes --
 * choisir, ajuster, valider. Les valeurs sont preremplies avec la
 * derniere performance connue : le cas courant devient un seul tap.
 */

const DISCIPLINES = [
  { key: '', label: 'Tout' },
  { key: 'musculation', label: 'Muscu' },
  { key: 'callisthenie', label: 'Callisthénie' },
  { key: 'mobilite', label: 'Mobilité' },
  { key: 'souplesse', label: 'Souplesse' },
  { key: 'cardio', label: 'Cardio' },
];

/** Ces disciplines se chronomètrent ; les autres se comptent en reps. */
const TIMED_DISCIPLINES = new Set(['mobilite', 'souplesse']);

export default function FieldLogger() {
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [seconds, setSeconds] = useState(45);
  const [log, setLog] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const searchTimer = useRef(null);

  // Recherche debouncee : chaque frappe ne doit pas declencher une
  // requete, le reseau en salle est souvent mediocre.
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      api.exercises({ q: query || undefined, discipline: discipline || undefined, limit: 30 })
        .then((d) => setResults(d.items))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [query, discipline]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const ensureSession = useCallback(async () => {
    if (session) return session;
    const created = await api.createSession({
      title: `Séance du ${new Date().toLocaleDateString('fr-FR')}`,
    });
    setSession(created);
    return created;
  }, [session]);

  const selectExercise = async (exercise) => {
    setSelected(exercise);
    setError(null);
    try {
      // Prerempli avec la derniere perf : l'utilisateur confirme au lieu
      // de saisir.
      const last = await api.lastPerformance(exercise.id);
      if (last) {
        if (last.weight_kg != null) setWeight(Number(last.weight_kg));
        if (last.reps != null) setReps(Number(last.reps));
        showToast(`Dernière fois : ${last.weight_kg ?? '—'} kg × ${last.reps ?? '—'}`);
      }
    } catch {
      // Absence d'historique : on garde les valeurs courantes.
    }
  };

  const submitSet = async () => {
    if (!selected) return;
    setError(null);
    try {
      const current = await ensureSession();
      const isTimed = TIMED_DISCIPLINES.has(selected.discipline);
      const isBodyweight = selected.discipline === 'callisthenie';

      // Un étirement tenu n'a ni charge ni répétitions : envoyer reps=10
      // fausserait le volume ET le score de souplesse, qui se calcule
      // sur le temps cumulé.
      const payload = isTimed
        ? { exercise_id: selected.id, duration_s: seconds }
        : {
          exercise_id: selected.id,
          weight_kg: isBodyweight && weight === 0 ? null : weight,
          reps,
        };

      const saved = await api.logSet(current.id, payload);
      setLog((l) => [
        { ...saved, name_fr: selected.name_fr, set_index: saved.set_index },
        ...l,
      ]);
      showToast(`Série ${saved.set_index} enregistrée`);
    } catch (e) {
      setError(e.message);
    }
  };

  const finish = async () => {
    if (!session) return;
    try {
      await api.updateSession(session.id, { ended_at: new Date().toISOString() });
      setSession(null);
      setLog([]);
      showToast('Séance clôturée');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 className="card-title">
              {session ? 'Séance en cours' : 'Nouvelle séance'}
            </h2>
            <p className="card-sub" style={{ margin: 0 }}>
              {session
                ? `${log.length} série${log.length > 1 ? 's' : ''} enregistrée${log.length > 1 ? 's' : ''}`
                : 'La séance démarre à la première série.'}
            </p>
          </div>
          {session && (
            <button type="button" className="btn-ghost" onClick={finish}>
              Terminer
            </button>
          )}
        </div>

        <input
          className="field-search"
          type="search"
          inputMode="search"
          placeholder="Rechercher un exercice…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher un exercice"
        />

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {DISCIPLINES.map((d) => (
            <button
              key={d.key}
              type="button"
              className="tab"
              aria-selected={discipline === d.key}
              onClick={() => setDiscipline(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {loading && results.length === 0 ? (
          <p className="empty">Chargement…</p>
        ) : (
          <ul className="exercise-list">
            {results.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  className="exercise-item"
                  aria-pressed={selected?.id === ex.id}
                  onClick={() => selectExercise(ex)}
                >
                  <img
                    className="exercise-thumb"
                    src={ex.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    // Les medias sont servis depuis GitHub : une URL
                    // morte ne doit pas casser la liste.
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <span style={{ flex: 1 }}>
                    <span className="exercise-name">{ex.name_fr}</span>
                    <span className="exercise-meta">
                      {ex.target} · {ex.equipment}
                    </span>
                  </span>
                  <span className="pill">{ex.discipline.slice(0, 5)}</span>
                </button>
              </li>
            ))}
            {!loading && results.length === 0 && (
              <li className="empty">Aucun exercice trouvé.</li>
            )}
          </ul>
        )}
      </div>

      {selected && (
        <div className="card">
          <h2 className="card-title">{selected.name_fr}</h2>
          <p className="card-sub">{selected.target} · {selected.equipment}</p>

          {TIMED_DISCIPLINES.has(selected.discipline) ? (
            <div className="numpad-row" style={{ gridTemplateColumns: '1fr' }}>
              <Stepper
                label="Durée (secondes)" value={seconds} step={15} min={5}
                onChange={setSeconds}
              />
            </div>
          ) : (
            <div className="numpad-row">
              <Stepper
                label="Charge (kg)" value={weight} step={2.5} min={0}
                onChange={setWeight}
              />
              <Stepper
                label="Répétitions" value={reps} step={1} min={1}
                onChange={setReps}
              />
            </div>
          )}

          <button type="button" className="btn-primary" onClick={submitSet}>
            Valider la série
          </button>
        </div>
      )}

      {log.length > 0 && (
        <div className="card">
          <h2 className="card-title">Journal</h2>
          <div style={{ marginTop: 8 }}>
            {log.map((s) => (
              <div className="log-line" key={s.id}>
                <span>
                  {s.name_fr}
                  <span className="log-meta"> · série {s.set_index}</span>
                </span>
                <span className="log-value">
                  {s.duration_s
                    ? `${s.duration_s} s`
                    : `${s.weight_kg ? `${Number(s.weight_kg)} kg × ` : ''}${s.reps}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <HydrationCard compact />

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Stepper({ label, value, step, min, onChange }) {
  const bump = (delta) => onChange(Math.max(min, Math.round((value + delta) * 100) / 100));

  return (
    <div className="field-block">
      <label htmlFor={`stepper-${label}`}>{label}</label>
      <div className="stepper">
        <button type="button" onClick={() => bump(-step)} aria-label={`Diminuer ${label}`}>
          −
        </button>
        <input
          id={`stepper-${label}`}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button type="button" onClick={() => bump(step)} aria-label={`Augmenter ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
