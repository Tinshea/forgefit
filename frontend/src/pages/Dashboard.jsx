import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import AthleticRadar from '../components/AthleticRadar.jsx';
import BodyMap from '../components/BodyMap.jsx';
import ReadinessCard from '../components/ReadinessCard.jsx';
import AdherenceCard from '../components/AdherenceCard.jsx';
import HydrationCard from '../components/HydrationCard.jsx';

/**
 * Tableau de bord analytique (desktop).
 *
 * Vue de recul, a l'oppose du mode Terrain : on lit des tendances, on
 * compare, on decide de la seance du jour. Rien n'y est optimise pour
 * la saisie rapide.
 */
export default function Dashboard() {
  const [radar, setRadar] = useState(null);
  const [bodymap, setBodymap] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // Un panneau en echec ne doit pas vider tout le tableau de bord :
    // chaque promesse est traitee independamment.
    Promise.allSettled([
      api.radar(), api.bodymap(), api.readiness(), api.summary(),
    ]).then(([r, b, rd, s]) => {
      if (!alive) return;
      if (r.status === 'fulfilled') setRadar(r.value);
      if (b.status === 'fulfilled') setBodymap(b.value);
      if (rd.status === 'fulfilled') setReadiness(rd.value);
      if (s.status === 'fulfilled') setSummary(s.value);

      const failed = [r, b, rd, s].filter((p) => p.status === 'rejected');
      if (failed.length === 4) setError(failed[0].reason?.message ?? 'API injoignable');
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  if (loading) return <p className="empty">Chargement du tableau de bord…</p>;

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="stat-row">
        <Stat label="Séances 7 j" value={summary?.sessions_7d ?? 0} />
        <Stat
          label="Volume 7 j"
          value={Math.round(Number(summary?.volume_7d ?? 0)).toLocaleString('fr-FR')}
          unit="kg"
        />
        <Stat label="Séries 7 j" value={summary?.sets_7d ?? 0} />
        <Stat
          label="Rang global"
          value={radar?.rank ?? '—'}
          unit={radar ? `${Math.round(radar.overall)}/100` : ''}
        />
      </div>

      <div className="grid grid-dash">
        <div className="grid">
          <AthleticRadar data={radar} />
          <BodyMap data={bodymap} />
        </div>
        <div className="grid">
          <ReadinessCard data={readiness} />
          {/* L'adhérence explique ce que le radar ne dit pas : un score
              qui stagne malgré un bon programme vient le plus souvent de
              séances non faites, pas d'un mauvais dosage. */}
          <AdherenceCard />
          <HydrationCard />
          <StrengthDetails radar={radar} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value} {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}

/** Detail des mouvements standardises : percentile et niveau atteint. */
function StrengthDetails({ radar }) {
  const rows = [
    ...(radar?.details?.push ?? []),
    ...(radar?.details?.pull ?? []),
    ...(radar?.details?.legs ?? []),
  ].sort((a, b) => b.percentile - a.percentile);

  if (!rows.length) {
    return (
      <div className="card">
        <h2 className="card-title">Standards de force</h2>
        <p className="empty">
          Enregistre un mouvement de référence (développé, squat, soulevé de
          terre, traction…) pour te situer.
        </p>
      </div>
    );
  }

  const LIFT_LABELS = {
    bench_press: 'Développé couché', squat: 'Squat', deadlift: 'Soulevé de terre',
    overhead_press: 'Développé militaire', barbell_row: 'Rowing', pull_up: 'Traction',
    dip: 'Dips', front_squat: 'Squat avant', hip_thrust: 'Hip thrust',
    leg_press: 'Presse à cuisses', bicep_curl: 'Curl biceps',
    lat_pulldown: 'Tirage vertical', push_up: 'Pompes',
  };

  return (
    <div className="card">
      <h2 className="card-title">Standards de force</h2>
      <p className="card-sub">1RM estimé et percentile mondial</p>
      <table className="data-table">
        <caption className="visually-hidden">
          Percentile par mouvement de référence
        </caption>
        <thead>
          <tr>
            <th scope="col">Mouvement</th>
            <th scope="col">1RM</th>
            <th scope="col">Ratio</th>
            <th scope="col">Perc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lift}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {LIFT_LABELS[r.lift] ?? r.lift}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.level}</div>
              </th>
              <td>{r.oneRepMaxKg} kg</td>
              <td>×{r.ratio.toFixed(2)}</td>
              <td style={{ fontWeight: 700 }}>{Math.round(r.percentile)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
