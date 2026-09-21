import { useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Le lien entre l'entraînement et l'assiette.
 *
 * ┌─ CE QUE CETTE CARTE NE FAIT PAS ──────────────────────────────────┐
 * │ Elle n'ajoute AUCUNE calorie pour une séance. Le multiplicateur   │
 * │ d'activité du profil (× 1,375, × 1,55…) inclut déjà                │
 * │ l'entraînement : compter les calories d'une séance par-dessus les │
 * │ compterait deux fois.                                              │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Elle fait deux choses : confronter l'activité DÉCLARÉE à celle
 * enregistrée, et répartir le total hebdomadaire entre jours
 * d'entraînement et jours de repos — à somme constante.
 */

const SPLIT_STEPS = [0, 5, 10, 15, 20];

export default function TrainingNutrition({ training, breakdown, onChanged, onError }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!training) return null;

  const { activity, load, split, day_type: dayType } = training;
  const splitPct = split && !split.neutral
    ? Math.round((split.training - 1) * 100)
    : 0;

  const setSplit = async (pct) => {
    setBusy(true);
    try {
      await api.saveNutritionProfile({ day_split_pct: pct });
      await onChanged();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h2 className="card-title">Entraînement et objectif du jour</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {dayType === 'entrainement'
              ? `Jour d’entraînement · ${training.sessions} séance${training.sessions > 1 ? 's' : ''}`
              : 'Jour de repos'}
            {split && !split.neutral && ` · objectif ×${dayType === 'entrainement' ? split.training : split.rest}`}
          </p>
        </div>
        <span style={{ color: activity?.ok ? 'var(--good)' : 'var(--warning)', fontSize: 18 }}>
          {activity?.ok ? '✓' : '▲'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div className="stat-label" style={{ marginBottom: 6 }}>
            Activité déclarée face à l’enregistrée
          </div>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-value">{load?.sessions_per_week ?? 0}</div>
              <div className="stat-label">séances/sem.</div>
            </div>
            <div className="stat">
              <div className="stat-value">{load?.minutes_per_week ?? 0}</div>
              <div className="stat-label">min/sem.</div>
            </div>
            <div className="stat">
              <div className="stat-value">{load?.minutes_per_session ?? 0}</div>
              <div className="stat-label">min/séance</div>
            </div>
          </div>

          <p style={{
            fontSize: 12, marginTop: 10, lineHeight: 1.6,
            color: activity?.ok ? 'var(--text-muted)' : 'var(--warning)',
          }}>
            {activity?.ok ? '✓ ' : '▲ '}{activity?.note}
          </p>

          {!activity?.ok && activity?.kcal_hint != null && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              L’écart représente environ{' '}
              <strong>{Math.abs(activity.kcal_hint)} kcal par jour</strong> sur ton objectif.
              Le niveau d’activité se change dans le profil.
            </p>
          )}

          <div className="stat-label" style={{ margin: '18px 0 6px' }}>
            Répartition entraînement / repos
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.6 }}>
            Manger davantage les jours de séance, moins les jours de repos. Ce
            réglage <strong>ne crée aucune calorie</strong> : ce qui est ajouté d’un
            côté est retiré de l’autre, le total de la semaine ne bouge pas.
          </p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPLIT_STEPS.map((p) => (
              <button
                key={p} type="button" className="tab"
                aria-selected={splitPct === p}
                onClick={() => setSplit(p)}
                disabled={busy}
              >
                {p === 0 ? 'Uniforme' : `+${p} %`}
              </button>
            ))}
          </div>

          {split && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              {split.note}
            </p>
          )}

          {breakdown?.day_factor != null && breakdown.day_factor !== 1 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Aujourd’hui : {breakdown.base_kcal} kcal × {breakdown.day_factor} ={' '}
              <strong>{Math.round(breakdown.base_kcal * breakdown.day_factor)} kcal</strong>.
            </p>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.5 }}>
            Les protéines ne varient pas selon le jour : la littérature donne une
            cible <strong>quotidienne</strong>, pas une cible par séance. À apport
            hebdomadaire égal, aucun essai ne montre d’avantage clair de la
            répartition sur la composition corporelle — son intérêt est pratique.
          </p>
        </div>
      )}
    </div>
  );
}
