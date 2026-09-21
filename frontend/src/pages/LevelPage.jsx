import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { dec, thousands } from '../lib/format.js';

/**
 * Niveau, XP et distinctions.
 *
 * ┌─ CE QUE CET ÉCRAN A LE DROIT DE FAIRE ────────────────────────────┐
 * │ Rendre visible un travail qui disparaît autrement. Deux ans       │
 * │ d'entraînement ne laissent qu'une liste de séances ; un niveau    │
 * │ qui monte lentement dit quelque chose de vrai sur ce cumul.       │
 * │                                                                    │
 * │ Ce qu'il n'a PAS le droit de faire : inventer des points. Chaque  │
 * │ XP affiché ici est une charge d'entraînement réellement           │
 * │ enregistrée. Rien n'est donné pour avoir ouvert l'application.    │
 * │                                                                    │
 * │ Et le niveau ne mesure PAS la condition physique — l'application  │
 * │ ne connaît ni la VO₂max ni la force relative. L'avertissement en  │
 * │ bas de page n'est pas une précaution juridique : c'est la         │
 * │ différence entre un indicateur et un mensonge flatteur.           │
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Anneau de progression. La circonférence porte la valeur. */
function Ring({ progress, size = 148, stroke = 12, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          className="ring-track" cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
        />
        <circle
          className="ring-value" cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--series-1)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          // Le balayage d'arrivée part du cercle entièrement vide : sans
          // cette variable, l'animation utiliserait un repli arbitraire.
          style={{ '--dash': c }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export default function LevelPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.gameProgression().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="empty">Calcul de la progression…</p>;

  const cats = data.category_labels ?? {};

  return (
    <div className="grid">
      <div className="card level-hero halftone">
        <Ring progress={data.progress}>
          <span className="level-num pop-in" key={data.level}>{data.level}</span>
          <span className="level-word">niveau</span>
        </Ring>

        <div className="level-side" style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="card-title" style={{ margin: 0 }}>{data.title}</h2>
          <p className="card-sub" style={{ margin: '4px 0 12px' }}>
            {thousands(data.xp)} XP cumulés sur {data.window_days} jours
          </p>

          <div className="gauge" style={{ height: 8 }}>
            <div
              className="gauge-fill bar-fill"
              style={{ width: `${data.progress * 100}%`, background: 'var(--brand)' }}
            />
          </div>
          <p className="level-next">
            Encore <strong>{thousands(data.to_next)} XP</strong> pour le niveau
            {' '}{data.level + 1} — soit environ{' '}
            {Math.max(1, Math.ceil(data.to_next / 400))} séances soutenues.
          </p>

          {data.streak?.target_per_week > 0 && (
            <p className="level-streak">
              🔥 {data.streak.current} semaine{data.streak.current > 1 ? 's' : ''} d’affilée
              {data.streak.best > data.streak.current && ` · record ${data.streak.best}`}
            </p>
          )}
        </div>
      </div>

      {data.categories?.length > 0 && (
        <div className="card">
          <h2 className="card-title">Profil athlétique</h2>
          <p className="card-sub">
            Un niveau par famille de sport : c’est le portrait de ce que tu
            pratiques vraiment, là où le niveau global le moyenne
          </p>

          <div className="cat-levels">
            {data.categories.map((c) => (
              <div className="cat-level" key={c.category}>
                <span className="cat-level-icon" aria-hidden="true">
                  {cats[c.category]?.icon ?? '•'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cat-level-head">
                    <span className="cat-level-name">
                      {cats[c.category]?.label ?? c.category}
                    </span>
                    <span className="cat-level-num">niv. {c.level}</span>
                  </div>
                  <div className="gauge" style={{ height: 6 }}>
                    <div
                      className="gauge-fill bar-fill"
                      style={{ width: `${c.progress * 100}%`, background: 'var(--brand)' }}
                    />
                  </div>
                  <span className="cat-level-meta">
                    {c.sessions} séance{c.sessions > 1 ? 's' : ''} ·
                    {' '}{thousands(c.load)} AU
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card speedlines">
        <h2 className="card-title">Distinctions</h2>
        <p className="card-sub">
          {data.badges.filter((b) => b.earned).length} obtenues sur {data.badges.length} ·
          {' '}chacune affiche sa règle
        </p>

        <div className="badge-grid" style={{ position: 'relative', zIndex: 1 }}>
          {data.badges.map((b) => <Badge key={b.id} badge={b} />)}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Comment l’XP est comptée</h2>
        <ol className="steps-list" style={{ marginTop: 10 }}>
          {data.method.map((m, i) => <li key={i}>{m}</li>)}
        </ol>
        <p className="load-note" style={{ marginTop: 12 }}>{data.caveat}</p>
      </div>
    </div>
  );
}

function Badge({ badge }) {
  const pct = Math.round((badge.progress ?? 0) * 100);
  return (
    <div className="badge" data-earned={badge.earned ? '' : undefined}>
      <div className="badge-top">
        <span className="badge-icon" aria-hidden="true">{badge.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="badge-name">{badge.label}</div>
          <div className="badge-tier">
            {badge.tier ?? 'Pas encore obtenue'}
            {badge.earned && (
              <span className="badge-pips" aria-label={`palier ${badge.tier_index} sur ${badge.tier_count}`}>
                {Array.from({ length: badge.tier_count }, (_, i) => (
                  <span key={i} className="badge-pip" data-on={i < badge.tier_index ? '' : undefined} />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>

      {badge.next && (
        <>
          <div className="gauge" style={{ height: 5, marginTop: 8 }}>
            <div
              className="gauge-fill bar-fill"
              style={{
                width: `${pct}%`,
                // Obtenue : or, la teinte de la récompense. En cours :
                // écarlate, celle de l'effort. Aucune des deux n'est le
                // bleu des données — on est dans le châssis, ici.
                background: badge.earned ? 'var(--gold)' : 'var(--brand)',
              }}
            />
          </div>
          <div className="badge-next">
            {badge.next.name} · {thousands(badge.value)} / {thousands(badge.next.at)}
          </div>
        </>
      )}

      <p className="badge-rule">{badge.rule}</p>
    </div>
  );
}
