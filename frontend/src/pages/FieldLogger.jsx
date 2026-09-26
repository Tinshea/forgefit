import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import HydrationCard from '../components/HydrationCard.jsx';
import EvidenceBadge from '../components/EvidenceBadge.jsx';
import { SessionChrono, RestTimer, formatClock } from '../components/SessionTimers.jsx';
import TodayCard from '../components/TodayCard.jsx';
import ExerciseSheet from '../components/ExerciseSheet.jsx';
import { playLater as play } from '../lib/sound-lazy.js';
import { muscleLabel } from '../lib/anatomy.js';
import Glyph from '../components/Glyph.jsx';

/**
 * Mode Terrain (mobile-first).
 *
 * Contrainte : entre deux séries, on est essoufflé, une main prise,
 * parfois avec des gants. Tout se joue en trois gestes — choisir,
 * ajuster, valider.
 *
 * Deux façons d'entrer :
 *  - une séance PROGRAMMÉE, ouverte depuis le calendrier : les exercices
 *    et leurs cibles sont déjà là, il n'y a qu'à exécuter ;
 *  - une séance LIBRE : on cherche dans tout le catalogue.
 * Les deux coexistent dans la même séance — ajouter un exercice hors
 * programme ne doit pas obliger à en ouvrir une autre.
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

/** Repos par défaut, quand aucun programme ne le fixe. */
const DEFAULT_REST_S = 120;

/** Clé de reprise du minuteur : l'écran se verrouille entre deux séries. */
const REST_KEY = 'forgefit.rest';

const readStoredRest = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null');
    // Un repos expiré depuis longtemps n'a plus à réapparaître : on ne
    // reprend que ce qui court encore.
    return raw?.endsAt > Date.now() ? raw : null;
  } catch {
    return null;
  }
};

export default function FieldLogger({ navigate }) {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);

  const [query, setQuery] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  const [selected, setSelected] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [closing, setClosing] = useState(false);
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [seconds, setSeconds] = useState(45);

  const [rest, setRest] = useState(readStoredRest);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  const searchTimer = useRef(null);

  // Le catalogue est déplié d'emblée en séance libre — c'est le seul
  // moyen de choisir quoi que ce soit — et replié quand un programme
  // fournit déjà la liste des exercices.
  const plan = session?.plan ?? null;
  const showBrowser = browsing || !plan;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  // Reprise de la séance en cours. Sans cela, revenir sur l'onglet après
  // un verrouillage d'écran ouvrirait une SECONDE séance et couperait
  // l'historique en deux.
  useEffect(() => {
    api.openSession()
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    try {
      if (rest) localStorage.setItem(REST_KEY, JSON.stringify(rest));
      else localStorage.removeItem(REST_KEY);
    } catch { /* stockage indisponible : le minuteur reste en mémoire */ }
  }, [rest]);

  // Recherche débouncée : chaque frappe ne doit pas déclencher une
  // requête, le réseau en salle est souvent médiocre.
  useEffect(() => {
    if (!showBrowser) return undefined;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearching(true);
      api.exercises({ q: query || undefined, discipline: discipline || undefined, limit: 40 })
        .then((d) => setResults(d.items))
        .catch((e) => setError(e.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [query, discipline, showBrowser]);

  /** Séries dures déjà faites, par exercice. L'échauffement ne compte pas. */
  const doneByExercise = useMemo(() => {
    const map = new Map();
    for (const s of session?.sets ?? []) {
      if (s.is_warmup) continue;
      map.set(s.exercise_id, (map.get(s.exercise_id) ?? 0) + 1);
    }
    return map;
  }, [session]);

  const planItemFor = useCallback(
    (exerciseId) => plan?.items?.find((i) => i.exercise_id === exerciseId) ?? null,
    [plan],
  );

  const ensureSession = useCallback(async () => {
    if (session) return session;
    const created = await api.createSession({
      title: `Séance du ${new Date().toLocaleDateString('fr-FR')}`,
    });
    const full = await api.session(created.id);
    setSession(full);
    return full;
  }, [session]);

  /**
   * Sélectionne un exercice et préremplit la saisie.
   *
   * Priorité à la CIBLE du programme quand il y en a une : c'est ce
   * qu'on est venu faire. À défaut, la dernière performance connue —
   * confirmer vaut mieux que saisir.
   */
  const selectExercise = async (exercise) => {
    setSelected(exercise);
    setError(null);

    const item = planItemFor(exercise.id);
    if (item) {
      if (item.target_reps != null) setReps(item.target_reps);
      if (item.target_seconds != null) setSeconds(item.target_seconds);
      if (item.suggested_kg != null) setWeight(Number(item.suggested_kg));
    }

    try {
      const last = await api.lastPerformance(exercise.id);
      if (!last) return;
      // La charge réelle prime sur la charge conseillée : elle tient
      // compte de ce qui a effectivement été soulevé.
      if (last.weight_kg != null) setWeight(Number(last.weight_kg));
      if (!item && last.reps != null) setReps(Number(last.reps));
      showToast(`Dernière fois : ${last.weight_kg ?? '—'} kg × ${last.reps ?? '—'}`);
    } catch {
      // Absence d'historique : on garde les valeurs courantes.
    }
  };

  const startRest = (durationS) => {
    const total = Math.max(5, Math.round(durationS));
    setRest({ endsAt: Date.now() + total * 1000, total });
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

      // On ajoute localement plutôt que de recharger : une requête de
      // plus par série sur le réseau d'une salle se paie cash.
      setSession((s) => ({
        ...s,
        sets: [...(s?.sets ?? []), {
          ...saved,
          name_fr: selected.name_fr,
          gif_url: selected.gif_url,
          target: selected.target,
        }],
      }));

      const item = planItemFor(selected.id);
      startRest(item?.rest_seconds ?? DEFAULT_REST_S);
      showToast(`Série ${saved.set_index} enregistrée`);
    } catch (e) {
      setError(e.message);
    }
  };

  /**
   * Clôture avec ressenti.
   *
   * Sans RPE, une séance ne pèse RIEN dans la charge d'entraînement, et
   * donc ni dans la progression ni dans la monotonie : c'est une donnée
   * manquante, pas un effort nul. Poser la question une fois, à la fin,
   * coûte trois secondes et rend tout le module Sports utilisable pour
   * la musculation aussi.
   */
  const finish = async (rpe) => {
    if (!session) return;
    try {
      await api.updateSession(session.id, {
        ended_at: new Date().toISOString(),
        ...(rpe ? { perceived_exertion: rpe } : null),
      });
      setSession(null);
      setSelected(null);
      setRest(null);
      setClosing(false);
      // Le seul endroit de l'application où l'arpège de réussite se
      // déclenche. Réservé à un vrai accomplissement : l'employer pour
      // une action ordinaire en userait l'effet en deux jours.
      play('success');
      showToast(rpe ? `Séance clôturée · ${rpe * 1}/10 de ressenti` : 'Séance clôturée');
    } catch (e) {
      setError(e.message);
    }
  };

  /** Ouvre une séance, programmée ou libre, et l'affiche aussitôt. */
  const openSession = async (planned) => {
    try {
      const created = await api.createSession(
        planned
          ? { program_day_id: planned.id }
          : { title: `Séance du ${new Date().toLocaleDateString('fr-FR')}` },
      );
      setSession(await api.session(created.id));
      if (!planned) setBrowsing(true);
    } catch (e) {
      setError(e.message);
    }
  };

  if (booting) return <p className="empty">Chargement de la séance…</p>;

  /**
   * Supprime une série.
   *
   * Confirmation demandée : c'est destructif et irréversible, et le
   * bouton est à quelques pixels de la valeur qu'on vient de lire.
   */
  const supprimerSerie = async (s) => {
    const quoi = s.duration_s
      ? `${s.duration_s} s`
      : `${s.weight_kg ? `${Number(s.weight_kg)} kg × ` : ''}${s.reps}`;
    if (!window.confirm(`Supprimer la série ${s.set_index} de ${s.name_fr} (${quoi}) ?`)) return;
    try {
      await api.deleteSet(session.id, s.id);
      setSession((prev) => ({ ...prev, sets: prev.sets.filter((x) => x.id !== s.id) }));
      showToast('Série supprimée');
    } catch (e) {
      showToast(`Suppression impossible : ${e.message}`);
    }
  };

  const sets = session?.sets ?? [];
  const totalVolume = sets.reduce((n, s) => n + Number(s.volume_kg ?? 0), 0);

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      {/* Tant qu'aucune séance n'est ouverte, la première question est
          « je fais quoi aujourd'hui ? » — et elle doit trouver sa
          réponse ici, pas deux écrans plus loin. */}
      {!session && (
        <TodayCard
          onStart={openSession}
          onFreeSession={() => openSession(null)}
          navigate={navigate}
        />
      )}

      {rest && (
        <RestTimer
          endsAt={rest.endsAt}
          total={rest.total}
          onAdjust={(delta) => setRest((r) => ({
            endsAt: r.endsAt + delta * 1000,
            total: Math.max(5, r.total + delta),
          }))}
          onStop={() => setRest(null)}
        />
      )}

      {/* En-tête de séance : inutile tant qu'aucune n'est ouverte, la
          carte « Aujourd'hui » dit déjà quoi faire et comment démarrer. */}
      {session && (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="card-title">
              {session.title ?? 'Séance en cours'}
            </h2>
            <p className="card-sub" style={{ margin: 0 }}>
              {`${sets.length} série${sets.length > 1 ? 's' : ''}`}
              {totalVolume > 0
                && ` · ${Math.round(totalVolume).toLocaleString('fr-FR')} kg de volume`}
            </p>
            {plan && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Séance programmée · {plan.program_name}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <SessionChrono startedAt={session.started_at} />
            <div>
              <button
                type="button" className="btn-ghost"
                onClick={() => setClosing(true)}
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {closing && (
        <FinishPanel
          onCancel={() => setClosing(false)}
          onFinish={finish}
        />
      )}

      {plan && (
        <PlannedWork
          plan={plan}
          doneByExercise={doneByExercise}
          selectedId={selected?.id}
          onSelect={selectExercise}
        />
      )}

      {selected && (
        <div className="card" style={{ borderLeftColor: 'var(--brand)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="card-title">{selected.name_fr}</h2>
              <p className="card-sub" style={{ margin: 0 }}>
                {muscleLabel(selected.target)}
                {selected.equipment ? ` · ${selected.equipment}` : ''}
              </p>
            </div>
            {/* Replié par défaut : en séance, la saisie passe d'abord.
                Mais la question « je le sens au mauvais endroit, c'est
                normal ? » se pose ICI, pas dans la bibliothèque. */}
            <button
              type="button" className="btn-ghost"
              aria-expanded={showSheet}
              onClick={() => setShowSheet((v) => !v)}
            >
              {showSheet ? 'Masquer la fiche' : 'Muscles et exécution'}
            </button>
          </div>

          {showSheet && (
            <div className="sheet" style={{ marginTop: 12 }}>
              <ExerciseSheet exercise={selected} compact showEvidence={false} />
            </div>
          )}

          <TargetLine item={planItemFor(selected.id)} done={doneByExercise.get(selected.id) ?? 0} />

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

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              {plan ? 'Ajouter un exercice hors programme' : 'Choisir un exercice'}
            </h2>
            <p className="card-sub" style={{ margin: 0 }}>
              Les 1324 exercices du catalogue, les mieux documentés en tête.
            </p>
          </div>
          {plan && !browsing && (
            <button type="button" className="btn-ghost" onClick={() => setBrowsing(true)}>
              Parcourir
            </button>
          )}
        </div>

        {showBrowser && (
          <>
            <input
              className="field-search"
              type="search"
              inputMode="search"
              placeholder="Rechercher un exercice…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher un exercice"
              style={{ marginTop: 12 }}
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

            {searching && results.length === 0 ? (
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
                        // Les médias sont servis depuis GitHub : une URL
                        // morte ne doit pas casser la liste.
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                        }}>
                          <span className="exercise-name">{ex.name_fr}</span>
                          <EvidenceBadge tier={ex.evidence_tier} compact />
                        </span>
                        <span className="exercise-meta">
                          {muscleLabel(ex.target)} · {ex.equipment}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {!searching && results.length === 0 && (
                  <li className="empty">Aucun exercice trouvé.</li>
                )}
              </ul>
            )}
          </>
        )}
      </div>

      {sets.length > 0 && (
        <div className="card">
          <h2 className="card-title">Journal</h2>
          <div style={{ marginTop: 8 }}>
            {[...sets].reverse().map((s) => (
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
                {/* ┌─ CORRIGER UNE SÉRIE ──────────────────────────────┐
                    │ L'API sait supprimer une série depuis le début ;  │
                    │ l'interface ne l'exposait pas. Une faute de       │
                    │ frappe — 80 kg au lieu de 8 — restait dans le    │
                    │ volume et dans la charge pour toujours.          │
                    │                                                   │
                    │ On supprime plutôt qu'on édite : une série est   │
                    │ un fait daté, et la refaire est plus clair que   │
                    │ la réécrire.                                      │
                    └───────────────────────────────────────────────────┘ */}
                <button
                  type="button"
                  className="log-supprimer"
                  aria-label={`Supprimer cette série de ${s.name_fr}`}
                  onClick={() => supprimerSerie(s)}
                >
                  <Glyph name="corbeille" size={14} />
                </button>
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

/** Cible du programme pour l'exercice sélectionné, et ce qu'il en reste. */
function TargetLine({ item, done }) {
  if (!item) return null;

  const dose = item.target_seconds
    ? `${item.target_sets} × ${item.target_seconds} s`
    : `${item.target_sets} × ${item.target_reps}`
      + (item.target_reps_max ? `–${item.target_reps_max}` : '');
  const remaining = Math.max(0, item.target_sets - done);

  return (
    <div style={{
      margin: '10px 0 4px', padding: '8px 12px', borderRadius: 10,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      fontSize: 13, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline',
    }}>
      <strong>{dose}</strong>
      {item.suggested_kg != null && (
        <span style={{ color: 'var(--series-1)' }}>{Number(item.suggested_kg)} kg conseillés</span>
      )}
      <span style={{ color: remaining ? 'var(--text-muted)' : 'var(--good)' }}>
        {remaining ? `${remaining} série(s) restante(s)` : 'objectif atteint'}
      </span>
      {item.rest_seconds && (
        <span style={{ color: 'var(--text-muted)' }}>repos {formatClock(item.rest_seconds)}</span>
      )}
    </div>
  );
}

/**
 * Le plan de la séance, avec sa progression.
 *
 * C'est la liste qu'on suit du haut vers le bas. Une ligne terminée
 * reste visible et cliquable : on peut vouloir ajouter une série
 * au-delà de ce qui était prévu.
 */
/**
 * Ressenti de fin de séance, sur l'échelle CR-10.
 *
 * Une seule question, posée une fois. L'échelle est verbalisée : « 7 »
 * ne veut rien dire sans « quelques mots à la fois ».
 */
const RPE_SCALE = [
  [1, 'Très facile'], [2, 'Très facile'], [3, 'Facile'], [4, 'Facile'],
  [5, 'Modéré'], [6, 'Modéré'], [7, 'Difficile'], [8, 'Difficile'],
  [9, 'Très difficile'], [10, 'Maximal'],
];

function FinishPanel({ onCancel, onFinish }) {
  const [rpe, setRpe] = useState(7);

  return (
    <div className="card sheet" style={{ borderColor: 'var(--warning)' }}>
      <h2 className="card-title">Comment c’était ?</h2>
      <p className="card-sub">
        Une seule question. Sans elle, cette séance ne compte pas dans ta
        charge d’entraînement ni dans ta progression.
      </p>

      <div className="rpe-row">
        {RPE_SCALE.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="rpe-dot"
            aria-pressed={rpe === value}
            aria-label={`${value} sur 10 — ${label}`}
            onClick={() => setRpe(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="field-hint" style={{ textAlign: 'center' }}>
        {RPE_SCALE.find(([v]) => v === rpe)?.[1]}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="btn-primary" onClick={() => onFinish(rpe)}>
          Terminer la séance
        </button>
        <button type="button" className="btn-ghost" onClick={() => onFinish(null)}>
          Sans noter
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Continuer
        </button>
      </div>
    </div>
  );
}

function PlannedWork({ plan, doneByExercise, selectedId, onSelect }) {
  const totalTarget = plan.items.reduce((n, i) => n + i.target_sets, 0);
  const totalDone = plan.items.reduce(
    (n, i) => n + Math.min(i.target_sets, doneByExercise.get(i.exercise_id) ?? 0), 0,
  );

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 className="card-title" style={{ flex: 1, margin: 0 }}>{plan.title}</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {totalDone}/{totalTarget} séries
        </span>
      </div>

      <div className="gauge" style={{ height: 6, marginTop: 10 }}>
        <div
          className="gauge-fill"
          style={{
            width: `${totalTarget ? (totalDone / totalTarget) * 100 : 0}%`,
            background: totalDone >= totalTarget ? 'var(--good)' : 'var(--series-1)',
          }}
        />
      </div>

      <ul className="exercise-list" style={{ maxHeight: 'none', marginTop: 12 }}>
        {plan.items.map((item) => {
          const done = doneByExercise.get(item.exercise_id) ?? 0;
          const complete = done >= item.target_sets;

          return (
            <li key={item.id}>
              <button
                type="button"
                className="exercise-item"
                aria-pressed={selectedId === item.exercise_id}
                onClick={() => onSelect({
                  id: item.exercise_id,
                  name_fr: item.name_fr,
                  target: item.target,
                  equipment: item.equipment,
                  discipline: item.discipline,
                  gif_url: item.gif_url,
                })}
                style={{ width: '100%', textAlign: 'left', opacity: complete ? 0.6 : 1 }}
              >
                <img
                  className="exercise-thumb" src={item.image_url} alt=""
                  loading="lazy" decoding="async"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="exercise-name">{item.name_fr}</span>
                    <EvidenceBadge tier={item.evidence_tier} compact />
                  </span>
                  <span className="exercise-meta">
                    {item.target_seconds
                      ? `${item.target_sets} × ${item.target_seconds} s`
                      : `${item.target_sets} × ${item.target_reps}`
                        + (item.target_reps_max ? `–${item.target_reps_max}` : '')}
                    {item.suggested_kg != null ? ` · ${Number(item.suggested_kg)} kg` : ''}
                  </span>
                </span>
                <span
                  className="pill"
                  style={{ color: complete ? 'var(--good)' : 'var(--text-muted)' }}
                >
                  {done}/{item.target_sets}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
