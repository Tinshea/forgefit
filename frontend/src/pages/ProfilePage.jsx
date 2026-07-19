import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Profil : identité, morphologie, objectifs.
 *
 * Tout ce qui alimente les calculs de l'application se saisit ici. Le
 * panneau « Ce que ça débloque » relie chaque mesure manquante à ce
 * qu'elle permet — une liste de champs vides ne dit pas pourquoi les
 * remplir.
 */

const n = (v) => (v == null ? '' : v);

function Field({ label, hint, children }) {
  return (
    <div className="field-block" style={{ marginBottom: 14 }}>
      <label>{label}</label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Indice dérivé, avec sa valeur et son interprétation. */
function Metric({ label, value, unit, detail, caveat }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value ?? '—'}
        {value != null && unit && <span className="stat-unit"> {unit}</span>}
      </div>
      {detail && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          {detail}
        </div>
      )}
      {caveat && (
        <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6, lineHeight: 1.4 }}>
          {caveat}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const hydrate = (d) => {
    setData(d);
    setForm({
      display_name: n(d.identity.display_name),
      sex: d.identity.sex ?? 'unspecified',
      birth_date: d.identity.birth_date ? d.identity.birth_date.slice(0, 10) : '',
      height_cm: n(d.morphology.height_cm),
      bodyweight_kg: n(d.morphology.weight_kg),
      body_fat_pct: n(d.morphology.body_fat_pct),
      goal: d.goals.goal,
      activity: d.goals.activity,
    });
  };

  useEffect(() => {
    api.profile().then(hydrate).catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Les champs vides sont omis : le backend applique COALESCE et ne
      // doit pas recevoir de chaînes vides à la place de nombres.
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === '' || v == null) continue;
        payload[k] = ['height_cm', 'bodyweight_kg', 'body_fat_pct'].includes(k)
          ? Number(v) : v;
      }
      hydrate(await api.saveProfile(payload));
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="empty">Chargement du profil…</p>;

  const { morphology: m, derived: d, gaps, options } = data;

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      {gaps.length > 0 && (
        <div className="card">
          <h2 className="card-title">Mesures manquantes</h2>
          <p className="card-sub">
            Chaque mesure débloque des calculs. Rien n’est obligatoire.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {gaps.map((g) => (
              <li key={g.field} style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{g.label}</strong>
                {' → '}{g.unlocks}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h2 className="card-title">Identité</h2>
          <p className="card-sub">Sexe et âge entrent dans l’estimation de dépense</p>

          <Field label="Nom affiché">
            <input type="text" value={form.display_name} onChange={set('display_name')}
              style={{ width: '100%' }} />
          </Field>

          <Field label="Sexe" hint="Les standards de force et la dépense en dépendent.">
            <select value={form.sex} onChange={set('sex')} style={{ width: '100%' }}>
              {options.sexes.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Date de naissance"
            hint={data.identity.age ? `${data.identity.age} ans` : 'Nécessaire à Mifflin-St Jeor.'}
          >
            <input type="date" value={form.birth_date} onChange={set('birth_date')}
              style={{ width: '100%' }} />
          </Field>
        </div>

        <div className="card">
          <h2 className="card-title">Morphologie</h2>
          <p className="card-sub">Base de tous les calculs de l’application</p>

          <Field label="Taille (cm)" hint="Sert à l’IMC, au FFMI et à l’estimation de dépense.">
            <input type="number" inputMode="decimal" min="50" max="260" step="0.5"
              value={form.height_cm} onChange={set('height_cm')} style={{ width: '100%' }} />
          </Field>

          <Field
            label="Poids (kg)"
            hint={m.weight_source === 'mesuré' && m.weight_measured_at
              ? `Dernière mesure le ${new Date(m.weight_measured_at).toLocaleDateString('fr-FR')} — `
                + 'une pesée plus récente remplacera cette valeur.'
              : 'Enregistré comme mesure : il alimentera ta courbe de poids.'}
          >
            <input type="number" inputMode="decimal" min="20" max="400" step="0.1"
              value={form.bodyweight_kg} onChange={set('bodyweight_kg')} style={{ width: '100%' }} />
          </Field>

          <Field
            label="Masse grasse (%)"
            hint="Facultatif, mais fait passer la dépense de Mifflin-St Jeor à Katch-McArdle, plus précise."
          >
            <input type="number" inputMode="decimal" min="3" max="70" step="0.1"
              value={form.body_fat_pct} onChange={set('body_fat_pct')} style={{ width: '100%' }} />
          </Field>

          {m.lean_mass_kg != null && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Masse maigre <strong>{m.lean_mass_kg} kg</strong>
              {m.fat_mass_kg != null && ` · masse grasse ${m.fat_mass_kg} kg`}
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Objectif</h2>
        <p className="card-sub">Détermine les cibles caloriques et la répartition des macros</p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {options.goals.map((g) => (
            <button
              key={g.key} type="button" className="tab"
              aria-selected={form.goal === g.key}
              onClick={() => { setForm((f) => ({ ...f, goal: g.key })); setSaved(false); }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
          {options.goals.find((g) => g.key === form.goal)?.note}
        </p>

        <div className="stat-label" style={{ margin: '18px 0 8px' }}>Niveau d’activité</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {options.activities.map((a) => (
            <button
              key={a.key} type="button"
              className="exercise-item"
              style={{ minHeight: 44 }}
              aria-pressed={form.activity === a.key}
              onClick={() => { setForm((f) => ({ ...f, activity: a.key })); setSaved(false); }}
            >
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{a.label}</span>
              <span className="pill">×{a.multiplier}</span>
            </button>
          ))}
        </div>

        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Indices dérivés</h2>
        <p className="card-sub">Recalculés à chaque modification</p>

        <div className="stat-row" style={{ marginTop: 4 }}>
          <Metric
            label="IMC" value={d.bmi?.value}
            detail={d.bmi?.label} caveat={d.bmi?.caveat}
          />
          <Metric
            label="FFMI normalisé" value={d.ffmi?.normalized}
            detail={d.ffmi?.label ?? 'Nécessite la masse grasse'}
          />
          <Metric
            label="Métabolisme de base" value={d.bmr?.bmr} unit="kcal"
            detail={d.bmr?.method_label ?? d.bmr?.note}
          />
          <Metric
            label="Hydratation" value={d.hydration?.ml} unit="ml"
            detail={d.hydration?.basis}
          />
        </div>

        {d.bmr?.note && d.bmr?.method === 'mifflin-st-jeor' && (
          <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 12, marginBottom: 0 }}>
            ▲ {d.bmr.note}
          </p>
        )}
      </div>

      {data.nutrition_targets && (
        <div className="card">
          <h2 className="card-title">Objectifs journaliers</h2>
          <p className="card-sub">Ce que ces réglages produisent</p>

          <div className="stat-row" style={{ marginTop: 4 }}>
            <Metric label="Calories" value={data.nutrition_targets.kcal} unit="kcal" />
            <Metric label="Protéines" value={data.nutrition_targets.protein_g} unit="g" />
            <Metric label="Lipides" value={data.nutrition_targets.fat_g} unit="g" />
            <Metric label="Glucides" value={data.nutrition_targets.carbs_g} unit="g" />
          </div>

          <ol style={{
            paddingLeft: 20, marginTop: 16, marginBottom: 0,
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            {(data.nutrition_method ?? []).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
