import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Choix de la formule de métabolisme de base, et calibration réelle.
 *
 * ┌─ POURQUOI CE CHOIX EST OFFERT ────────────────────────────────────┐
 * │ Une application qui affiche « 1 742 kcal » sans dire d'où vient   │
 * │ le chiffre laisse croire à une mesure. C'est une prédiction, et   │
 * │ les prédictions divergent : sur le même profil, les cinq formules │
 * │ d'usage s'étalent sur plus de 200 kcal.                           │
 * │                                                                    │
 * │ Les montrer côte à côte, CALCULÉES, transforme un chiffre unique  │
 * │ en fourchette honnête. Et la calibration sur données réelles      │
 * │ tranche pour de bon — le bilan énergétique est une identité       │
 * │ comptable, pas une corrélation de population.                     │
 * └────────────────────────────────────────────────────────────────────┘
 */

const AUTO = {
  key: 'auto',
  label: 'Automatique',
  short: 'La mieux informée',
  note: 'Prend la formule la plus précise que tes mesures permettent.',
};

export default function MetabolismMethod({ profile, onSaved }) {
  const [calibration, setCalibration] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const methods = profile?.options?.bmr_methods ?? [];
  const spread = profile?.options?.bmr_spread;
  const current = profile?.profile?.bmr_method ?? 'auto';
  const active = profile?.bmr_method;

  useEffect(() => {
    let alive = true;
    api.calibration()
      .then((d) => { if (alive) setCalibration(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [profile?.profile?.updated_at]);

  const choose = async (key) => {
    setBusy(true);
    setError(null);
    try {
      await api.saveNutritionProfile({ bmr_method: key });
      await onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const adoptMeasured = async () => {
    // La calibration donne une DÉPENSE TOTALE. Le profil attend un
    // métabolisme de BASE : on divise par le multiplicateur d'activité
    // déclaré, sans quoi ce dernier s'appliquerait une seconde fois et
    // l'objectif calorique exploserait.
    const multiplier = calibration?.declared_multiplier;
    if (!(calibration?.tdee > 0) || !(multiplier > 0)) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveNutritionProfile({
        bmr_method: 'mesure',
        measured_bmr: Math.round((calibration.tdee / multiplier) * 10) / 10,
      });
      await onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Méthode de calcul</h2>
      <p className="card-sub">
        Sur quoi repose ton métabolisme de base — et donc tout le reste
      </p>

      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      <div className="method-grid">
        <button
          type="button" className="method-card" disabled={busy}
          aria-pressed={current === 'auto'}
          onClick={() => choose('auto')}
        >
          <span className="method-name">{AUTO.label}</span>
          <span className="method-value">
            {active?.method && current === 'auto' ? active.label?.split(' (')[0] : '—'}
          </span>
          <span className="method-note">{AUTO.note}</span>
        </button>

        {methods.map((m) => (
          <button
            key={m.key} type="button" className="method-card"
            disabled={busy || !m.available}
            aria-pressed={current === m.key}
            onClick={() => choose(m.key)}
          >
            <span className="method-name">{m.label}</span>
            <span className="method-value">
              {m.available ? `${Math.round(m.bmr)} kcal` : '—'}
            </span>
            <span className="method-note">
              {m.available
                ? m.formula
                : `Demande : ${m.missing.join(', ')}.`}
            </span>
          </button>
        ))}
      </div>

      {spread && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
          Les formules applicables s’étalent sur{' '}
          <strong>{Math.round(spread.delta)} kcal</strong>{' '}
          ({Math.round(spread.min)} à {Math.round(spread.max)}). Cet écart n’est pas une erreur de
          l’application : c’est l’incertitude réelle de toute prédiction de
          dépense. Aucune de ces équations n’a été établie sur toi.
        </p>
      )}

      {active?.fell_back && (
        <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 10, marginBottom: 0 }}>
          ▲ {active.note}
        </p>
      )}

      {active?.source && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
          Retenue : {active.label} — {active.source}
        </p>
      )}

      <Calibration
        data={calibration}
        busy={busy}
        onAdopt={adoptMeasured}
        isAdopted={current === 'mesure'}
      />
    </div>
  );
}

/** Dépense réelle, ou ce qu'il manque pour la calculer. */
function Calibration({ data, busy, onAdopt, isAdopted }) {
  if (!data) return null;

  return (
    <div style={{
      marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--grid)',
    }}>
      <div className="stat-label" style={{ marginBottom: 6 }}>
        Calibration sur tes données réelles
      </div>

      {data.ok ? (
        <>
          <div className="stat-row" style={{ marginTop: 4 }}>
            <div className="stat">
              <div className="stat-label">Dépense mesurée</div>
              <div className="stat-value">
                {data.tdee} <span className="stat-unit">kcal</span>
              </div>
              {data.range && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {data.range[0]} à {data.range[1]}
                </div>
              )}
            </div>
            <div className="stat">
              <div className="stat-label">Écart à la prédiction</div>
              <div
                className="stat-value"
                style={{
                  color: Math.abs(data.prediction_error_pct ?? 0) > 10
                    ? 'var(--warning)' : 'var(--good)',
                }}
              >
                {data.prediction_error_kcal > 0 ? '+' : ''}
                {data.prediction_error_kcal} <span className="stat-unit">kcal</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Multiplicateur réel</div>
              <div className="stat-value">{data.activity_multiplier ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                déclaré : {data.declared_multiplier}
              </div>
            </div>
          </div>

          <ul style={{
            paddingLeft: 18, margin: '12px 0 0', fontSize: 12,
            color: 'var(--text-secondary)', lineHeight: 1.65,
          }}>
            {data.explanation.map((line, i) => <li key={i}>{line}</li>)}
          </ul>

          <button
            type="button" className={isAdopted ? 'btn-ghost' : 'btn-primary'}
            style={{ marginTop: 12 }}
            disabled={busy || isAdopted}
            onClick={onAdopt}
          >
            {isAdopted ? 'Cette mesure est utilisée' : 'Utiliser cette mesure'}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.6 }}>
            Pas encore assez de données pour mesurer ta dépense réelle.
          </p>
          <ul style={{
            paddingLeft: 18, margin: 0, fontSize: 12,
            color: 'var(--text-muted)', lineHeight: 1.65,
          }}>
            {(data.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
          Comment cette mesure est obtenue
        </summary>
        <ol style={{
          paddingLeft: 18, margin: '8px 0 0', fontSize: 11,
          color: 'var(--text-muted)', lineHeight: 1.65,
        }}>
          {(data.method ?? []).map((m, i) => <li key={i}>{m}</li>)}
        </ol>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
          {data.caveat}
        </p>
      </details>
    </div>
  );
}
