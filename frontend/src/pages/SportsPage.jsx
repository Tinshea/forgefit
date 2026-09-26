import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import DisciplineSheet from '../components/DisciplineSheet.jsx';
import LoadSummary from '../components/LoadSummary.jsx';
import { dec } from '../lib/format.js';

/**
 * Toutes disciplines : enregistrer une séance, suivre la charge.
 *
 * ┌─ POURQUOI ON N'ENREGISTRE PAS EN DIRECT ICI ──────────────────────┐
 * │ Le module Séance chronomètre en direct, série après série : c'est │
 * │ ce qu'il faut en salle, où l'on repose la barre toutes les deux   │
 * │ minutes.                                                          │
 * │                                                                    │
 * │ On ne sort pas son téléphone entre deux rounds, au milieu d'un    │
 * │ match ou suspendu à une prise. Ces sports se notent APRÈS : durée │
 * │ et ressenti, en trente secondes. La séance est créée déjà close,  │
 * │ en une seule requête — sinon un réseau capricieux laisserait des  │
 * │ séances ouvertes en travers du calendrier.                        │
 * └────────────────────────────────────────────────────────────────────┘
 */

const RPE_HINTS = {
  1: 'Très facile', 2: 'Très facile', 3: 'Facile', 4: 'Facile',
  5: 'Modéré', 6: 'Modéré', 7: 'Difficile', 8: 'Difficile',
  9: 'Très difficile', 10: 'Maximal',
};

const METRIC_FIELDS = {
  distance: { label: 'Distance', unit: 'km', step: 0.1, factor: 1000, key: 'distance_m' },
  elevation: { label: 'Dénivelé', unit: 'm', step: 10, factor: 1, key: 'elevation_m' },
  rounds: { label: 'Reprises', unit: '', step: 1, factor: 1, key: 'rounds' },
  ascents: { label: 'Voies / blocs', unit: '', step: 1, factor: 1, key: 'ascents' },
};

const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export default function SportsPage() {
  const [catalogue, setCatalogue] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);
  const [sport, setSport] = useState(null);
  // Choisir une discipline ouvre sa FICHE ; le formulaire n'arrive
  // qu'ensuite, quand on a décidé d'enregistrer.
  const [saisie, setSaisie] = useState(null);
  const [recent, setRecent] = useState([]);
  const [load, setLoad] = useState(null);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);

  const refresh = () => Promise.all([
    api.sessions({ limit: 30 }).then((d) => setRecent(d.items ?? [])).catch(() => {}),
    api.trainingLoad(56).then(setLoad).catch(() => {}),
  ]);

  useEffect(() => {
    api.sports().then(setCatalogue).catch((e) => setError(e.message));
    refresh();
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!catalogue) return <p className="empty">Chargement du catalogue…</p>;

  // Les séances de musculation portent elles aussi une clé de sport
  // depuis la migration : l'historique est celui de TOUT l'entraînement,
  // pas d'un module à part. Les exclure recréerait la séparation que ce
  // module est censé supprimer.
  const sportSessions = recent.filter((s) => s.sport);

  return (
    <div className="grid">
      {flash && <div className="flash pop-in">{flash}</div>}

      {/* ┌─ UN ÉCRAN À LA FOIS ──────────────────────────────────────┐
          │ La fiche s'empilait AU-DESSUS de la liste : pour changer  │
          │ de discipline il fallait faire défiler tout le manuel, et │
          │ les séances récentes se retrouvaient à deux mille pixels  │
          │ du haut. Une fiche ouverte occupe donc l'écran seule, et  │
          │ « Fermer » ramène à la liste.                             │
          └────────────────────────────────────────────────────────────┘ */}
      {saisie ? (
        <SessionForm
          sport={saisie}
          onCancel={() => setSaisie(null)}
          onSaved={async (saved) => {
            setSaisie(null);
            setSport(null);
            setFlash(`${saved.title} enregistrée · ${saved.session_load} de charge`);
            setTimeout(() => setFlash(null), 4000);
            await refresh();
          }}
        />
      ) : sport ? (
        <DisciplineSheet
          sportKey={sport.key}
          onClose={() => setSport(null)}
          onLog={(fiche) => setSaisie(fiche)}
        />
      ) : (
        <>
      <div className="card">
        <h2 className="card-title">Les disciplines</h2>
        <p className="card-sub">
          {catalogue.total} sports, rangés par qualité physique dominante.
          Ouvre-en un pour tout savoir de lui.
        </p>

        <div className="category-grid">
          {catalogue.categories.map((c) => (
            <button
              key={c.key}
              type="button"
              className="category-card"
              aria-expanded={openCategory === c.key}
              onClick={() => setOpenCategory(openCategory === c.key ? null : c.key)}
            >
              <span className="category-icon" aria-hidden="true">{c.icon}</span>
              <span className="category-name">{c.label}</span>
              <span className="category-quality">{c.quality}</span>
              <span className="category-count">{c.sports.length} sports</span>
            </button>
          ))}
        </div>

        {openCategory && (
          <CategoryPanel
            category={catalogue.categories.find((c) => c.key === openCategory)}
            onPick={setSport}
          />
        )}
      </div>

      <LoadSummary data={load} categories={catalogue.categories} />

      <div className="card">
        <h2 className="card-title">Séances récentes</h2>
        <p className="card-sub">
          {sportSessions.length === 0
            ? 'Aucune séance enregistrée pour l’instant'
            : `${sportSessions.length} séance${sportSessions.length > 1 ? 's' : ''}, toutes disciplines`}
        </p>
        {sportSessions.length > 0 && (
          <ul className="session-list">
            {sportSessions.map((s) => <SessionRow key={s.id} session={s} />)}
          </ul>
        )}
      </div>
        </>
      )}
    </div>
  );
}

/** Liste des sports d'une catégorie, avec ce qui la caractérise. */
function CategoryPanel({ category, onPick }) {
  if (!category) return null;
  return (
    <div className="sheet category-panel">
      <p className="category-note">{category.note}</p>
      <dl className="category-facts">
        <div><dt>Se dose en</dt><dd>{category.dosing}</dd></div>
        <div><dt>Interférence avec la force</dt><dd>{category.interference}</dd></div>
      </dl>
      <div className="sport-grid">
        {category.sports.map((s) => (
          <button key={s.key} type="button" className="sport-chip" onClick={() => onPick(s)}>
            <span className="sport-name">{s.label}</span>
            <span className="sport-met">{dec(s.met)} MET</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Saisie : durée, ressenti, et les seules mesures qui ont un sens ici. */
function SessionForm({ sport, onCancel, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [minutes, setMinutes] = useState(60);
  const [rpe, setRpe] = useState(sport.default_rpe ?? 6);
  const [extra, setExtra] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useMemo(() => Math.round(rpe * minutes), [rpe, minutes]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // L'heure de fin est posée à 18 h locale par défaut : la date
      // seule suffit à l'utilisateur, mais la base a besoin d'un instant.
      const end = new Date(`${date}T18:00:00`);
      const start = new Date(end.getTime() - minutes * 60_000);

      const payload = {
        sport_key: sport.key,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        perceived_exertion: rpe,
      };
      for (const metric of sport.metrics ?? []) {
        const field = METRIC_FIELDS[metric];
        const value = extra[metric];
        if (value === '' || value == null) continue;
        payload[field.key] = Number(value) * field.factor;
      }

      onSaved(await api.createSession(payload));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="card sheet" style={{ borderColor: 'var(--series-1)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">{sport.label}</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {dec(sport.met)} MET · charge estimée {load} AU
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
      </div>

      {sport.note && <p className="sport-note">{sport.note}</p>}
      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      <div className="field-block" style={{ marginTop: 14 }}>
        <label htmlFor="sport-date">Date</label>
        <input
          id="sport-date" type="date" value={date}
          max={todayIso()} onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="field-block">
        <label htmlFor="sport-min">Durée — {minutes} minutes</label>
        <input
          id="sport-min" type="range" min="10" max="300" step="5"
          value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </div>

      <div className="field-block">
        <label htmlFor="sport-rpe">
          Ressenti — {rpe}/10 · {RPE_HINTS[rpe]}
        </label>
        <input
          id="sport-rpe" type="range" min="1" max="10" step="1"
          value={rpe} onChange={(e) => setRpe(Number(e.target.value))}
        />
        <p className="field-hint">
          À quel point c’était dur, une fois la séance finie. C’est cette seule
          question qui rend comparables un match et une sortie vélo.
        </p>
      </div>

      {(sport.metrics ?? []).length > 0 && (
        <div className="numpad-row">
          {sport.metrics.map((metric) => {
            const field = METRIC_FIELDS[metric];
            if (!field) return null;
            return (
              <div className="field-block" key={metric} style={{ marginBottom: 0 }}>
                <label htmlFor={`m-${metric}`}>
                  {field.label}{field.unit ? ` (${field.unit})` : ''}
                </label>
                <input
                  id={`m-${metric}`} type="number" inputMode="decimal" step={field.step}
                  value={extra[metric] ?? ''}
                  onChange={(e) => setExtra((x) => ({ ...x, [metric]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
        {busy ? 'Enregistrement…' : `Enregistrer · ${load} AU`}
      </button>
    </div>
  );
}

function SessionRow({ session }) {
  const d = new Date(session.started_at);
  return (
    <li className="session-row">
      <span className="session-icon" aria-hidden="true">{session.sport.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="session-title">{session.sport.label}</span>
        <span className="session-meta">
          {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          {session.duration_min ? ` · ${session.duration_min} min` : ''}
          {session.distance_m ? ` · ${dec(Math.round(session.distance_m / 100) / 10)} km` : ''}
          {session.rounds ? ` · ${session.rounds} reprises` : ''}
          {session.ascents ? ` · ${session.ascents} voies` : ''}
        </span>
      </span>
      <span className="session-load">
        {session.session_load ? `${session.session_load}` : '—'}
        <span className="session-load-unit">AU</span>
      </span>
    </li>
  );
}
