import { useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api.js';
import { shortDay } from '../lib/format.js';

/**
 * Tendances.
 *
 * Un principe pour toute cette page : jamais deux échelles verticales
 * sur un même cadre. Superposer un poids en kg et des calories rendrait
 * la comparaison visuelle purement décorative — l'écart apparent
 * dépendrait du choix arbitraire des deux échelles.
 *
 * Quand deux grandeurs partagent une unité (masse maigre et masse
 * grasse, toutes deux en kg), elles vont dans le même cadre ; sinon
 * elles ont chacune le leur.
 */

const RANGES = [
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 180, label: '6 mois' },
];


const axis = {
  tick: { fill: 'var(--text-muted)', fontSize: 10 },
  axisLine: { stroke: 'var(--axis)' },
  tickLine: false,
};

function ChartTooltip({ active, payload, label, unit, decimals = 1 }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '9px 12px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 5 }}>{shortDay(label)}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="legend-swatch" style={{ background: p.color }} aria-hidden="true" />
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{p.name}</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Number(p.value).toFixed(decimals)} {unit}
          </strong>
        </div>
      ))}
    </div>
  );
}

/** Bandeau de tendance : variation sur la fenêtre. */
function TrendBadge({ trend, unit, goodDown = false, decimals = 1 }) {
  if (!trend || trend.delta == null) {
    return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>;
  }
  const up = trend.delta > 0;
  const good = goodDown ? !up : up;
  return (
    <span style={{
      fontSize: 12, fontWeight: 700,
      color: Math.abs(trend.delta) < 0.01 ? 'var(--text-muted)'
        : good ? 'var(--good)' : 'var(--serious)',
    }}>
      {up ? '+' : ''}{trend.delta.toFixed(decimals)} {unit}
    </span>
  );
}

function Panel({ title, subtitle, trend, children, empty }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-sub" style={{ margin: 0 }}>{subtitle}</p>}
        </div>
        {trend}
      </div>
      {empty
        ? <p className="empty">{empty}</p>
        : <div style={{ width: '100%', height: 190, marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export default function TrendsPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.trends(days)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  if (loading && !data) return <p className="empty">Chargement des tendances…</p>;

  const comp = (data?.composition ?? []).filter((r) => r.weight_kg != null);
  const nutri = data?.nutrition ?? [];
  const train = data?.training ?? [];
  const t = data?.trends ?? {};
  const targets = data?.targets;

  // Coût agrégé par semaine : le détail journalier est trop bruité pour
  // qu'on y lise quoi que ce soit.
  const weeklyCost = (() => {
    const buckets = new Map();
    for (const row of nutri) {
      if (row.price_eur == null) continue;
      const d = new Date(row.day);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(row.price_eur));
    }
    return [...buckets.entries()]
      .map(([day, price]) => ({ day, price_eur: Math.round(price * 100) / 100 }))
      .sort((a, b) => a.day.localeCompare(b.day));
  })();

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 className="card-title">Tendances</h2>
            <p className="card-sub" style={{ margin: 0 }}>
              Évolution sur la période — variation entre la première et la
              seconde moitié de la fenêtre
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
      </div>

      <div className="grid grid-2">
        {/* Masse maigre et masse grasse partagent l'unité kg : un seul
            cadre est légitime, et l'empilement montre le poids total. */}
        <Panel
          title="Composition corporelle"
          subtitle="Masse maigre et masse grasse, en kg"
          trend={<TrendBadge trend={t.fat_mass} unit="kg" goodDown />}
          empty={comp.length < 2 ? 'Pas assez de pesées sur la période.' : null}
        >
          <ResponsiveContainer>
            <AreaChart data={comp} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={30} {...axis} />
              <YAxis width={42} domain={['auto', 'auto']} {...axis} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="kg" />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              <Area
                type="monotone" dataKey="lean_mass_kg" stackId="1" name="Masse maigre"
                stroke="var(--series-1)" fill="var(--series-1)" fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone" dataKey="fat_mass_kg" stackId="1" name="Masse grasse"
                stroke="var(--serious)" fill="var(--serious)" fillOpacity={0.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Poids"
          subtitle="Pesées quotidiennes"
          trend={<TrendBadge trend={t.weight} unit="kg" goodDown />}
          empty={comp.length < 2 ? 'Pas assez de pesées.' : null}
        >
          <ResponsiveContainer>
            <LineChart data={comp} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={30} {...axis} />
              <YAxis width={42} domain={['auto', 'auto']} {...axis} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="kg" />} />
              <Line
                type="monotone" dataKey="weight_kg" name="Poids"
                stroke="var(--series-1)" strokeWidth={2} dot={false}
                activeDot={{ r: 4 }} isAnimationActive={false} connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Calories"
          subtitle={targets ? `Cible ${Math.round(targets.kcal)} kcal` : 'Apport quotidien'}
          trend={<TrendBadge trend={t.kcal} unit="kcal" decimals={0} />}
          empty={nutri.length < 2 ? 'Pas assez de journées enregistrées.' : null}
        >
          <ResponsiveContainer>
            <LineChart data={nutri} margin={{ top: 4, right: 6, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={30} {...axis} />
              <YAxis width={48} domain={['auto', 'auto']} {...axis} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="kcal" decimals={0} />} />
              {targets && (
                // La cible est une référence, pas une série : trait
                // discontinu et libellé, pour qu'on ne la lise pas comme
                // une seconde mesure.
                <ReferenceLine
                  y={targets.kcal} stroke="var(--good)" strokeDasharray="5 4"
                  label={{
                    value: 'cible', position: 'right',
                    fill: 'var(--good)', fontSize: 10,
                  }}
                />
              )}
              <Line
                type="monotone" dataKey="kcal" name="Consommé"
                stroke="var(--series-1)" strokeWidth={2} dot={false}
                activeDot={{ r: 4 }} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Macronutriments"
          subtitle="Répartition quotidienne, en grammes"
          trend={<TrendBadge trend={t.protein} unit="g" decimals={0} />}
          empty={nutri.length < 2 ? 'Pas assez de journées enregistrées.' : null}
        >
          <ResponsiveContainer>
            <AreaChart data={nutri} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={30} {...axis} />
              <YAxis width={42} {...axis} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="g" decimals={0} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              <Area
                type="monotone" dataKey="protein_g" stackId="1" name="Protéines"
                stroke="var(--series-2)" fill="var(--series-2)" fillOpacity={0.55}
                isAnimationActive={false}
              />
              <Area
                type="monotone" dataKey="carbs_g" stackId="1" name="Glucides"
                stroke="var(--series-1)" fill="var(--series-1)" fillOpacity={0.55}
                isAnimationActive={false}
              />
              <Area
                type="monotone" dataKey="fat_g" stackId="1" name="Lipides"
                stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.55}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Volume d’entraînement"
          subtitle="Tonnage soulevé par séance"
          trend={<TrendBadge trend={t.volume} unit="kg" decimals={0} />}
          empty={train.length < 2 ? 'Pas assez de séances.' : null}
        >
          <ResponsiveContainer>
            <BarChart data={train} margin={{ top: 4, right: 6, bottom: 0, left: -4 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={30} {...axis} />
              <YAxis width={52} {...axis} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="kg" decimals={0} />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar
                dataKey="volume_kg" name="Volume"
                fill="var(--series-1)" radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Budget alimentaire"
          subtitle="Coût par semaine"
          trend={weeklyCost.length > 1 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
              {(weeklyCost.reduce((s, w) => s + w.price_eur, 0) / weeklyCost.length).toFixed(2)} € /sem.
            </span>
          )}
          empty={weeklyCost.length < 2 ? 'Renseigne les prix de tes aliments.' : null}
        >
          <ResponsiveContainer>
            <BarChart data={weeklyCost} margin={{ top: 4, right: 6, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={20} {...axis} />
              <YAxis width={44} {...axis} axisLine={false} />
              <Tooltip content={<ChartTooltip unit="€" decimals={2} />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar
                dataKey="price_eur" name="Coût"
                fill="var(--series-2)" radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}>
        Chaque grandeur a son propre cadre. Superposer un poids et des calories
        sur deux échelles verticales rendrait toute comparaison visuelle
        trompeuse : l’écart apparent dépendrait du choix des échelles, pas des
        données.
      </p>
    </div>
  );
}
