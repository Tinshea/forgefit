import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api.js';
import { shortDay } from '../lib/format.js';

/**
 * Suivi santé (Apple Watch, balance, capteurs).
 *
 * Petits multiples : une métrique = un graphique. Superposer sommeil,
 * VFC et pas sur un même cadre imposerait deux échelles verticales, ce
 * qui rend n'importe quelle comparaison visuelle trompeuse.
 */

/**
 * Les métriques sont groupées par QUESTION posée, pas par capteur.
 *
 * « Est-ce que je récupère ? » se lit sur le sommeil, la VFC et la FC de
 * repos ensemble ; le poids seul ne veut rien dire sans la masse maigre.
 * Un mur de seize graphiques par ordre alphabétique obligerait à faire
 * ce regroupement de tête à chaque consultation.
 *
 * `goodHigh` dit dans quel sens lire une variation : +8 % de VFC est bon,
 * +8 % de FC de repos ne l'est pas. `null` = neutre, aucun jugement.
 */
const GROUPS = [
  {
    title: 'Récupération',
    hint: 'Ce que ton corps répare pendant la nuit.',
    metrics: [
      { key: 'sleep', label: 'Sommeil', unit: 'h', decimals: 1, goodHigh: true },
      { key: 'hrv', label: 'Variabilité cardiaque', unit: 'ms', decimals: 0, goodHigh: true },
      { key: 'resting_hr', label: 'FC de repos', unit: 'bpm', decimals: 0, goodHigh: false },
      { key: 'respiratory_rate', label: 'Fréquence respiratoire', unit: '/min', decimals: 1, goodHigh: null },
    ],
  },
  {
    title: 'Activité',
    hint: 'Ce que tu as dépensé, mouvement par mouvement.',
    metrics: [
      { key: 'steps', label: 'Pas', unit: '', decimals: 0, goodHigh: true },
      { key: 'exercise_minutes', label: 'Minutes d’exercice', unit: 'min', decimals: 0, goodHigh: true },
      { key: 'calories_active', label: 'Calories actives', unit: 'kcal', decimals: 0, goodHigh: true },
      { key: 'distance', label: 'Distance', unit: 'km', decimals: 1, goodHigh: true },
      { key: 'flights', label: 'Étages montés', unit: '', decimals: 0, goodHigh: true },
    ],
  },
  {
    title: 'Composition corporelle',
    hint: 'Le poids seul ment : c’est la répartition qui compte.',
    metrics: [
      { key: 'weight', label: 'Poids', unit: 'kg', decimals: 1, goodHigh: null },
      { key: 'body_fat', label: 'Masse grasse', unit: '%', decimals: 1, goodHigh: false },
      { key: 'lean_mass', label: 'Masse maigre', unit: 'kg', decimals: 1, goodHigh: true },
      { key: 'bmi', label: 'IMC', unit: '', decimals: 1, goodHigh: null },
    ],
  },
  {
    title: 'Métabolisme & endurance',
    hint: 'Ta dépense de fond et ta capacité cardio.',
    metrics: [
      { key: 'calories_basal', label: 'Métabolisme de base', unit: 'kcal', decimals: 0, goodHigh: null },
      { key: 'vo2max', label: 'VO₂ max', unit: 'ml/kg/min', decimals: 1, goodHigh: true },
      { key: 'hydration', label: 'Hydratation', unit: 'mL', decimals: 0, goodHigh: true },
    ],
  },
];

const METRICS = GROUPS.flatMap((g) => g.metrics);

const RANGES = [
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
];


function MetricTooltip({ active, payload, label, meta }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 12px', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{shortDay(label)}</div>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Number(payload[0].value).toFixed(meta.decimals)} {meta.unit}
      </strong>
    </div>
  );
}

function MetricChart({ meta, series, summary }) {
  if (!series?.points?.length) {
    return (
      <div className="card">
        <h3 className="card-title">{meta.label}</h3>
        <p className="empty">Aucune donnée sur la période.</p>
      </div>
    );
  }

  const trend = summary?.trend_pct;
  // Une hausse n'est pas bonne en soi : +8 % de FC de repos est un
  // mauvais signe, +8 % de VFC un bon. D'où `goodHigh` par métrique.
  const trendGood = meta.goodHigh === null || trend == null
    ? null
    : (trend >= 0) === meta.goodHigh;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h3 className="card-title" style={{ flex: 1 }}>{meta.label}</h3>
        {trend != null && (
          <span
            style={{
              fontSize: 12, fontWeight: 700,
              color: trendGood === null ? 'var(--text-muted)'
                : trendGood ? 'var(--good)' : 'var(--serious)',
            }}
          >
            {trend > 0 ? '+' : ''}{trend} %
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '2px 0 12px' }}>
        <span style={{ fontSize: 26, fontWeight: 700 }}>
          {summary?.latest?.toFixed(meta.decimals) ?? '—'}
        </span>
        <span className="stat-unit">{meta.unit}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          moy. {summary?.average?.toFixed(meta.decimals)} {meta.unit}
        </span>
      </div>

      <div style={{ width: '100%', height: 120 }}>
        <ResponsiveContainer>
          <LineChart data={series.points} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="day" tickFormatter={shortDay} minTickGap={28}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--axis)' }} tickLine={false}
            />
            <YAxis
              domain={['auto', 'auto']} width={44}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              content={<MetricTooltip meta={meta} />}
              cursor={{ stroke: 'var(--text-muted)', strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone" dataKey="value"
              stroke="var(--series-1)" strokeWidth={2}
              dot={false} activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      api.healthSeries({ types: METRICS.map((m) => m.key).join(','), days }),
      api.healthSources(),
    ]).then(([s, src]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setData(s.value);
      else setError(s.reason?.message ?? 'Erreur');
      if (src.status === 'fulfilled') setSources(src.value.items ?? []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [days]);

  const seriesOf = (key) => data?.series?.find((s) => s.metric_type === key);
  const summaryOf = (key) => data?.summary?.find((s) => s.metric_type === key);
  const hasData = data?.series?.length > 0;

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 className="card-title">Suivi santé</h2>
            <p className="card-sub" style={{ margin: 0 }}>
              Données synchronisées depuis tes capteurs
            </p>
          </div>
          <div className="tabs">
            {RANGES.map((r) => (
              <button
                key={r.days} type="button" className="tab"
                aria-selected={days === r.days} onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {sources.length > 0 && (
          <div className="legend" style={{ marginTop: 14 }}>
            {sources.map((s) => (
              <span className="legend-item" key={s.source}>
                <span className="pill">{s.source}</span>
                {s.metrics} mesures · {s.types} types
              </span>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="empty">Chargement…</p>}

      {!loading && !hasData && <AppleWatchGuide />}

      {!loading && hasData && (
        <>
          {GROUPS.map((g) => {
            // Une métrique jamais mesurée ne mérite pas un cadre vide :
            // seize « Aucune donnée » noieraient les trois qui comptent.
            const dispo = g.metrics.filter((m) => seriesOf(m.key)?.points?.length);
            if (!dispo.length) return null;
            return (
              <section key={g.title}>
                <div style={{ margin: '4px 2px 10px' }}>
                  <h2 className="card-title" style={{ margin: 0 }}>{g.title}</h2>
                  <p className="card-sub" style={{ margin: 0 }}>{g.hint}</p>
                </div>
                <div className="grid grid-2">
                  {dispo.map((m) => (
                    <MetricChart
                      key={m.key} meta={m}
                      series={seriesOf(m.key)} summary={summaryOf(m.key)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          <MetriquesAbsentes manquantes={
            METRICS.filter((m) => !seriesOf(m.key)?.points?.length)
          } jours={days} />
          <AppleWatchGuide collapsed />
        </>
      )}
    </div>
  );
}

/**
 * Ce que l'app sait suivre mais n'a pas reçu.
 *
 * Sans cette liste, une métrique absente est indistinguable d'une
 * métrique non gérée : on ne saurait pas s'il faut brancher un capteur
 * ou si l'app ne sait tout simplement pas la lire.
 */
function MetriquesAbsentes({ manquantes, jours }) {
  if (!manquantes.length) return null;
  return (
    <div className="card">
      <h3 className="card-title">Non reçu sur {jours} jours</h3>
      <p className="card-sub" style={{ marginTop: 0 }}>
        Ces mesures sont gérées par l’app mais absentes de tes données sur
        la période — élargis la fenêtre, ou vérifie que le capteur les envoie.
      </p>
      <div className="legend">
        {manquantes.map((m) => (
          <span className="pill" key={m.key}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Marche à suivre pour brancher l'Apple Watch sur le webhook. */
function AppleWatchGuide({ collapsed = false }) {
  const [open, setOpen] = useState(!collapsed);

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h2 className="card-title">Connecter l’Apple Watch</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Synchronisation automatique via webhook
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6 }}>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            L’Apple Watch écrit dans l’app Santé de l’iPhone. Il faut donc un
            exportateur qui relaie ces données vers l’API — <em>Health Auto
            Export</em> le fait nativement, aucune app à développer.
          </p>

          <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>
            <li>Installer <strong>Health Auto Export</strong> sur l’iPhone.</li>
            <li>
              Créer une automatisation de type <strong>REST API</strong>.
            </li>
            <li>
              URL : <code style={codeStyle}>{`${window.location.origin}/api/health-sync`}</code>
            </li>
            <li>Méthode <strong>POST</strong>, format <strong>JSON</strong>.</li>
            <li>
              En-tête <code style={codeStyle}>X-ForgeFit-Source: apple_health</code>
              {' '}(facultatif : le format est reconnu automatiquement).
            </li>
            <li>
              Sélectionner les métriques : sommeil, VFC, FC de repos, pas,
              calories, poids, SpO₂.
            </li>
          </ol>

          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            L’endpoint accepte n’importe quel format et répond immédiatement en
            202 ; la normalisation se fait ensuite en arrière-plan. Un même
            échantillon renvoyé deux fois n’est jamais compté en double.
          </p>

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              Tester en ligne de commande
            </summary>
            <pre style={preStyle}>
{`curl -X POST ${window.location.origin}/api/health-sync \\
  -H 'Content-Type: application/json' \\
  -d '{"metrics":[
        {"type":"hrv","value":68,"unit":"ms"},
        {"type":"sleep","value":7.5,"unit":"h"}
      ]}'`}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

const codeStyle = {
  background: 'var(--surface-3)', padding: '2px 6px',
  borderRadius: 5, fontSize: 12, wordBreak: 'break-all',
};

const preStyle = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: 12, fontSize: 12, overflowX: 'auto',
  color: 'var(--text-secondary)',
};
