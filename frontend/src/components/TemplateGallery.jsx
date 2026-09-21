import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import EvidenceBadge from './EvidenceBadge.jsx';
import { muscleLabel } from '../lib/anatomy.js';

/**
 * Catalogue de modèles de programme.
 *
 * Un modèle décrit une structure en PATRONS DE MOUVEMENT. Le choix du
 * matériel n'intervient qu'à la résolution : le même modèle donne des
 * exercices différents en salle, avec deux haltères ou à mains nues.
 *
 * Chaque fiche affiche son dosage réel et ses sources. Un programme qui
 * se contente d'annoncer « prise de masse » demande de croire sur
 * parole ; celui-ci montre combien de séries par muscle il place, et
 * d'où viennent ces chiffres.
 */

const LEVEL_COLOR = {
  Débutant: 'var(--good)',
  Intermédiaire: 'var(--series-1)',
  Avancé: 'var(--warning)',
};

/** Répartition du volume par muscle, en barres. */
function VolumeBars({ volume }) {
  const targeted = volume.muscles.filter((m) => m.is_targeted);
  if (!targeted.length) return null;
  const max = Math.max(volume.landmarks.maximum_recoverable, targeted[0].weekly_sets);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="stat-label" style={{ marginBottom: 8 }}>
        Séries hebdomadaires par muscle
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {targeted.map((m) => (
          <div key={m.muscle}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, marginBottom: 3,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                {m.weekly_sets} · {m.sessions_per_week}×/sem.
              </span>
            </div>
            <div className="gauge" style={{ height: 6 }}>
              <div
                className="gauge-fill"
                style={{
                  width: `${Math.min(100, (m.weekly_sets / max) * 100)}%`,
                  background: m.weekly_sets > volume.landmarks.maximum_recoverable
                    ? 'var(--warning)'
                    : m.weekly_sets >= volume.landmarks.minimum_effective
                      ? 'var(--good)' : 'var(--series-1)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {(volume.aerobic?.steady_minutes > 0 || volume.aerobic?.interval_minutes > 0) && (
        <div style={{ marginTop: 14 }}>
          <div className="stat-label" style={{ marginBottom: 6 }}>Endurance hebdomadaire</div>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-value">{volume.aerobic.steady_minutes}</div>
              <div className="stat-label">min continues</div>
            </div>
            <div className="stat">
              <div className="stat-value">{volume.aerobic.interval_minutes}</div>
              <div className="stat-label">min fractionné</div>
            </div>
            <div className="stat">
              <div
                className="stat-value"
                style={{ color: volume.aerobic.meets_floor ? 'var(--good)' : 'var(--warning)' }}
              >
                {volume.aerobic.moderate_equivalent_minutes}
              </div>
              <div className="stat-label">équiv. modéré</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Plancher de santé : {volume.aerobic.floor} min hebdomadaires d’activité
            modérée, jusqu’à {volume.aerobic.upper}. Une minute vigoureuse en vaut deux.
          </p>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
        Repères : {volume.landmarks.maintenance} séries pour entretenir,{' '}
        {volume.landmarks.minimum_effective} pour progresser,{' '}
        {volume.landmarks.adaptive_range[0]}–{volume.landmarks.adaptive_range[1]} en fenêtre
        d’adaptation, {volume.landmarks.maximum_recoverable} au maximum récupérable.
        Un muscle travaillé en second compte pour 40 % d’une série.
      </p>
    </div>
  );
}

/** Détail d'un modèle : séances résolues en exercices réels. */
function TemplateDetail({ templateKey, profiles, onUse, onClose }) {
  const [equipment, setEquipment] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDetail(null);
    api.programTemplate(templateKey, equipment ? { equipment } : undefined)
      .then((d) => {
        setDetail(d);
        // Premier chargement : on adopte le matériel pour lequel le
        // modèle a été écrit, pour que le sélecteur reflète l'affichage.
        if (!equipment) setEquipment(d.selected_equipment);
      })
      .catch((e) => setError(e.message));
  }, [templateKey, equipment]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!detail) return <p className="empty">Chargement du modèle…</p>;

  const use = async (edit = false) => {
    setBusy(true);
    setError(null);
    try {
      await onUse({ template_key: templateKey, equipment, edit });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 className="card-title">{detail.name}</h2>
            <p className="card-sub" style={{ margin: 0 }}>
              {detail.days_per_week} jours/semaine · {detail.weeks} semaines ·{' '}
              {detail.goal_label}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>Retour</button>
        </div>

        <p style={{ fontSize: 14, marginTop: 14 }}>{detail.summary}</p>

        <div className="field-block" style={{ marginTop: 12 }}>
          <label>Matériel disponible</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {profiles.map((p) => (
              <button
                key={p.key} type="button" className="tab"
                aria-selected={equipment === p.key}
                onClick={() => setEquipment(p.key)}
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {profiles.find((p) => p.key === equipment)?.hint}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => use(false)} disabled={busy}>
            {busy ? 'Création…' : 'Utiliser ce modèle'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => use(true)} disabled={busy}>
            Utiliser et adapter
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
          Le modèle est copié, pas suivi : une fois créé, le programme est
          modifiable librement, devient le programme actif, et ses séances sont
          réparties sur la semaine.
        </p>
      </div>

      <div className="card">
        <h3 className="card-title">Pourquoi ce modèle est construit ainsi</h3>
        <ol style={{ paddingLeft: 20, margin: '10px 0 0', fontSize: 13, lineHeight: 1.65 }}>
          {detail.why.map((w, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{w}</li>
          ))}
        </ol>

        <VolumeBars volume={detail.volume} />

        {detail.volume.warnings.map((w, i) => (
          <p key={i} style={{
            fontSize: 12, color: 'var(--warning)', marginTop: 10, marginBottom: 0,
            lineHeight: 1.5,
          }}>
            ▲ {w}
          </p>
        ))}

        {detail.substitutions.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="stat-label" style={{ marginBottom: 6 }}>
              Sorties du matériel choisi
            </div>
            {detail.substitutions.map((s, i) => (
              <p key={i} style={{ fontSize: 12, color: 'var(--warning)', margin: '0 0 6px' }}>
                ▲ {s.pattern_label} — {s.reason}
              </p>
            ))}
          </div>
        )}

        {detail.unresolved.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {detail.unresolved.map((u, i) => (
              <p key={i} style={{ fontSize: 12, color: 'var(--critical)', margin: '0 0 6px' }}>
                ▲ {u.pattern_label} — {u.reason}
              </p>
            ))}
          </div>
        )}

        {detail.sources.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--grid)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Sources</div>
            <ul style={{
              paddingLeft: 18, margin: 0, fontSize: 11,
              color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              {detail.sources.map((s) => (
                <li key={s.key} style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{s.claim}</span>
                  <br />{s.citation}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {detail.days.map((day) => (
        <div className="card" key={day.day_index}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pill">Jour {day.day_index}</span>
            <h3 className="card-title" style={{ margin: 0, flex: 1 }}>{day.title}</h3>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
            {day.items.map((it) => (
              <li key={it.position} className="log-line" style={{ alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    <span className="exercise-name">{it.name_fr}</span>
                    <EvidenceBadge tier={it.evidence_tier} compact />
                  </span>
                  <span className="exercise-meta">
                    {it.pattern_label} · {muscleLabel(it.target)}
                    {it.substituted && (
                      <span style={{ color: 'var(--warning)' }}> · hors matériel choisi</span>
                    )}
                  </span>
                  {it.evidence_note && (
                    <span style={{
                      display: 'block', fontSize: 11, color: 'var(--text-muted)',
                      marginTop: 3, lineHeight: 1.5,
                    }}>
                      {it.evidence_note}
                    </span>
                  )}
                </span>
                <span className="log-value" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {it.target_seconds
                    ? `${it.target_sets} × ${it.target_seconds} s`
                    : `${it.target_sets} × ${it.target_reps}`
                      + (it.target_reps_max ? `–${it.target_reps_max}` : '')}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                    repos {it.rest_seconds} s
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function TemplateGallery({ onUse }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.programTemplates()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="empty">Chargement des modèles…</p>;

  if (selected) {
    return (
      <TemplateDetail
        templateKey={selected}
        profiles={data.equipment_profiles}
        onUse={onUse}
        onClose={() => setSelected(null)}
      />
    );
  }

  const shown = category ? data.items.filter((t) => t.category === category) : data.items;

  return (
    <div className="grid">
      <div className="card">
        <h2 className="card-title">Modèles de programme</h2>
        <p className="card-sub">
          Des structures éprouvées, avec leur dosage et leurs sources. À utiliser
          telles quelles, ou comme point de départ à modifier.
        </p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            type="button" className="tab"
            aria-selected={category === null} onClick={() => setCategory(null)}
          >
            Tout
          </button>
          {data.categories.map((c) => (
            <button
              key={c.key} type="button" className="tab"
              aria-selected={category === c.key} onClick={() => setCategory(c.key)}
              title={c.hint}
            >
              {c.label}
            </button>
          ))}
        </div>
        {category && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
            {data.categories.find((c) => c.key === category)?.hint}
          </p>
        )}
      </div>

      {shown.map((t) => (
        <button
          key={t.key} type="button" className="card"
          onClick={() => setSelected(t.key)}
          style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 className="card-title">{t.name}</h3>
              <p className="card-sub" style={{ margin: 0 }}>
                {t.days_per_week} j/sem · {t.weeks} sem. · {t.equipment_label}
              </p>
            </div>
            <span className="pill" style={{ color: LEVEL_COLOR[t.level] ?? 'var(--text-muted)' }}>
              {t.level}
            </span>
          </div>

          <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0, color: 'var(--text-secondary)' }}>
            {t.summary}
          </p>

          <div className="stat-row" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="stat-value">{t.volume.total_exercises}</div>
              <div className="stat-label">exercices</div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {t.volume.muscles.filter((m) => m.is_targeted).length}
              </div>
              <div className="stat-label">muscles ciblés</div>
            </div>
            {t.volume.aerobic?.moderate_equivalent_minutes > 0 ? (
              <div className="stat">
                <div className="stat-value">{t.volume.aerobic.moderate_equivalent_minutes}</div>
                <div className="stat-label">min endurance</div>
              </div>
            ) : (
              <div className="stat">
                <div className="stat-value">{t.sources.length}</div>
                <div className="stat-label">sources</div>
              </div>
            )}
          </div>

          {t.volume.warnings.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 10, marginBottom: 0 }}>
              ▲ {t.volume.warnings.length} point(s) de vigilance sur le dosage
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
