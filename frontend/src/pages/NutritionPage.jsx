import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import MealSuggestions from '../components/MealSuggestions.jsx';
import TrainingNutrition from '../components/TrainingNutrition.jsx';
import FoodCard from '../components/FoodCard.jsx';
import { round1 } from '../lib/format.js';

/**
 * Journal alimentaire.
 *
 * Reprend la structure du tableur d'origine : saisie par repas, cumul
 * par repas, et surtout le « restant » — c'est lui qu'on regarde en
 * cours de journée pour décider du repas suivant, pas le consommé.
 *
 * Le prix est suivi comme un macronutriment de plus. Un plan qu'on ne
 * peut pas se payer ne tient pas.
 */

const MEALS = [
  { key: 'matin', label: 'Matin' },
  { key: 'midi', label: 'Midi' },
  { key: 'soir', label: 'Soir' },
  { key: 'collation', label: 'Collation' },
];

const MACROS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', color: 'var(--series-1)' },
  { key: 'protein_g', label: 'Protéines', unit: 'g', color: 'var(--series-2)' },
  { key: 'fat_g', label: 'Lipides', unit: 'g', color: 'var(--warning)' },
  { key: 'carbs_g', label: 'Glucides', unit: 'g', color: 'var(--serious)' },
  { key: 'fiber_g', label: 'Fibres', unit: 'g', color: 'var(--good)' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Jauge d'un macronutriment : consommé, cible, restant. */
function MacroGauge({ meta, consumed, target }) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const remaining = round1(target - consumed);
  const over = remaining < 0;

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 13, marginBottom: 5,
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>{meta.label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <strong>{round1(consumed)}</strong>
          <span style={{ color: 'var(--text-muted)' }}> / {round1(target)} {meta.unit}</span>
        </span>
      </div>
      <div className="gauge" style={{ height: 9 }}>
        <div
          className="gauge-fill"
          style={{ width: `${pct}%`, background: over ? 'var(--critical)' : meta.color }}
        />
      </div>
      <div style={{
        fontSize: 11, marginTop: 3,
        color: over ? 'var(--critical)' : 'var(--text-muted)',
      }}>
        {over ? `${Math.abs(remaining)} ${meta.unit} au-dessus` : `${remaining} ${meta.unit} restants`}
      </div>
    </div>
  );
}

/** Recherche d'aliment + saisie de la quantité. */
function FoodPicker({ meal, onLogged, onError }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); return undefined; }
    timer.current = setTimeout(() => {
      api.foods({ q: query, limit: 12 })
        .then((d) => setResults(d.items))
        .catch((e) => onError(e.message));
    }, 220);
    return () => clearTimeout(timer.current);
  }, [query, onError]);

  const pick = (food) => {
    setSelected(food);
    setQuantity(Number(food.reference_qty) || 100);
  };

  const scan = async () => {
    if (!barcode.trim()) return;
    setBusy(true);
    try {
      const d = await api.foodByBarcode(barcode.trim());
      // Un produit venant d'Open Food Facts n'est pas encore dans le
      // catalogue : on l'y ajoute pour pouvoir le journaliser.
      if (d.source === 'openfoodfacts') {
        const created = await api.createFood(d.food);
        pick(created.food);
        if (created.coherence && !created.coherence.ok) {
          onError(`Données Open Food Facts douteuses : ${created.coherence.message}`);
        }
      } else {
        pick(d.food);
      }
      setBarcode('');
    } catch (e) {
      onError(e.status === 503
        ? 'Open Food Facts est injoignable. Saisis le produit à la main.'
        : e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.logFood({ food_id: selected.id, meal, quantity });
      setSelected(null);
      setQuery('');
      setResults([]);
      onLogged();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Aperçu de la portion, avant validation.
  const preview = selected
    ? (() => {
      const f = Number(quantity) / (Number(selected.reference_qty) || 100);
      return {
        kcal: round1(selected.kcal * f),
        protein: round1(selected.protein_g * f),
        fat: round1(selected.fat_g * f),
        carbs: round1(selected.carbs_g * f),
        price: selected.price_eur == null ? null : round1(selected.price_eur * f * 10) / 10,
      };
    })()
    : null;

  return (
    <div style={{ marginTop: 12 }}>
      <input
        className="field-search"
        type="search"
        placeholder="Rechercher un aliment…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Ajouter un aliment au repas ${meal}`}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Code-barres"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') scan(); }}
          style={{ flex: 1, fontSize: 15 }}
          aria-label="Code-barres du produit"
        />
        <button type="button" className="btn-ghost" onClick={scan} disabled={busy || !barcode}>
          Chercher
        </button>
      </div>

      {results.length > 0 && !selected && (
        <div style={{ display: 'grid', gap: 8, marginTop: 8, maxHeight: 340, overflowY: 'auto' }}>
          {results.map((f) => (
            <FoodCard key={f.id} food={f} onSelect={pick} compact />
          ))}
        </div>
      )}

      {selected && (
        <div style={{
          marginTop: 10, padding: 12, background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <strong style={{ flex: 1, fontSize: 14 }}>{selected.name}</strong>
            <button
              type="button" className="table-toggle"
              onClick={() => setSelected(null)}
            >
              Changer
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10 }}>
            <div className="field-block" style={{ flex: 1 }}>
              <label htmlFor={`qty-${meal}`}>Quantité ({selected.unit})</label>
              <input
                id={`qty-${meal}`}
                type="number" inputMode="decimal" min="1" step="5"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={{ width: '100%', fontSize: 18, fontWeight: 700, textAlign: 'center' }}
              />
            </div>
            <button
              type="button" className="btn-primary"
              style={{ margin: 0, flex: 1, padding: 14 }}
              onClick={submit} disabled={busy}
            >
              Ajouter
            </button>
          </div>

          {preview && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
              {preview.kcal} kcal · P {preview.protein} g · L {preview.fat} g · G {preview.carbs} g
              {preview.price != null && ` · ${preview.price} €`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Confrontation des cibles aux repères publiés.
 *
 * Des CONSTATS, pas des corrections : les cibles restent celles de
 * l'utilisateur. Les ajuster en douce rendrait le calcul invérifiable,
 * et c'est précisément la vérifiabilité qui distingue un repère d'une
 * opinion.
 */
function TargetReview({ review }) {
  const [open, setOpen] = useState(false);
  if (!review?.checks?.length) return null;

  const failing = review.checks.filter((c) => !c.ok);

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h2 className="card-title">Tes cibles face à la littérature</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {failing.length
              ? `${failing.length} écart${failing.length > 1 ? 's' : ''} avec les repères publiés`
              : 'Toutes les cibles sont dans les fourchettes publiées'}
          </p>
        </div>
        <span style={{
          color: failing.length ? 'var(--warning)' : 'var(--good)', fontSize: 18,
        }}>
          {failing.length ? '▲' : '✓'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {review.checks.map((c) => (
            <div key={c.key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ color: c.ok ? 'var(--good)' : 'var(--warning)' }}>
                  {c.ok ? '✓' : '▲'}
                </span>
                <strong style={{ fontSize: 13, flex: 1 }}>{c.label}</strong>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.value}</span>
              </div>
              <p style={{
                fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 20px',
                lineHeight: 1.6,
              }}>
                {c.note}
              </p>
            </div>
          ))}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--grid)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Sources</div>
            <ul style={{
              paddingLeft: 18, margin: 0, fontSize: 11,
              color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              {review.sources.map((src) => (
                <li key={src.key} style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{src.claim}</span>
                  <br />
                  {src.url
                    ? <a href={src.url} target="_blank" rel="noreferrer">{src.citation}</a>
                    : src.citation}
                </li>
              ))}
            </ul>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
            {review.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function NutritionPage() {
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState(null);
  const [openMeal, setOpenMeal] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.nutritionDay(date)
      .then(setDay)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(load, [load]);

  const remove = async (id) => {
    try {
      await api.deleteFoodEntry(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const copyYesterday = async () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    try {
      await api.copyDay({ from: d.toISOString().slice(0, 10), to: date });
      load();
    } catch (e) { setError(e.message); }
  };

  const shiftDay = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  if (loading && !day) return <p className="empty">Chargement du journal…</p>;

  const consumed = day?.consumed ?? {};
  const targets = day?.targets;

  return (
    <div className="grid">
      {error && (
        <div className="error-banner" onClick={() => setError(null)} role="alert">
          {error}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn-ghost" onClick={() => shiftDay(-1)} aria-label="Jour précédent">
            ‹
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 className="card-title">
              {date === todayISO() ? 'Aujourd’hui' : new Date(date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h2>
            <p className="card-sub" style={{ margin: 0 }}>
              {consumed.entries ?? 0} aliment{(consumed.entries ?? 0) > 1 ? 's' : ''}
              {consumed.price_eur != null && ` · ${round1(consumed.price_eur)} €`}
            </p>
          </div>
          <button
            type="button" className="btn-ghost" onClick={() => shiftDay(1)}
            disabled={date >= todayISO()} aria-label="Jour suivant"
          >
            ›
          </button>
        </div>

        {!targets && (
          <p className="empty">
            Renseigne ta masse maigre dans le profil pour afficher tes objectifs.
          </p>
        )}

        {targets && (
          <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
            {MACROS.map((m) => (
              <MacroGauge
                key={m.key} meta={m}
                consumed={Number(consumed[m.key] ?? 0)}
                target={Number(targets[m.key] ?? 0)}
              />
            ))}
          </div>
        )}

        {day?.breakdown && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, marginBottom: 0 }}>
            Base {day.breakdown.bmr} kcal · dépense {day.breakdown.tdee} kcal
            {' '}· objectif ×{day.breakdown.calorie_factor}
          </p>
        )}

        {(day?.warnings ?? []).map((w) => (
          <p key={w} style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>▲ {w}</p>
        ))}
      </div>

      <TrainingNutrition
        training={day?.training}
        breakdown={day?.breakdown}
        onChanged={load}
        onError={setError}
      />

      <TargetReview review={day?.review} />

      {MEALS.map((meal) => {
        const entries = (day?.entries ?? []).filter((e) => e.meal === meal.key);
        const totals = (day?.by_meal ?? []).find((m) => m.meal === meal.key);
        const isOpen = openMeal === meal.key;

        return (
          <div className="card" key={meal.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <h3 className="card-title">{meal.label}</h3>
                <p className="card-sub" style={{ margin: 0 }}>
                  {round1(totals?.kcal)} kcal · P {round1(totals?.protein_g)} · L {round1(totals?.fat_g)} · G {round1(totals?.carbs_g)}
                  {totals?.price_eur != null && ` · ${round1(totals.price_eur)} €`}
                </p>
              </div>
              <button
                type="button" className="btn-ghost"
                onClick={() => setOpenMeal(isOpen ? null : meal.key)}
                aria-expanded={isOpen}
              >
                {isOpen ? 'Fermer' : 'Ajouter'}
              </button>
            </div>

            {entries.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {entries.map((e) => (
                  <div className="log-line" key={e.id}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {e.food_name}
                      <span className="log-meta"> · {round1(e.quantity)} {e.unit}</span>
                    </span>
                    <span className="log-value">{round1(e.kcal)} kcal</span>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      aria-label={`Retirer ${e.food_name}`}
                      style={{ color: 'var(--text-muted)', padding: '0 4px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isOpen && (
              <>
                {/* Les suggestions d'abord : c'est la question « qu'est-ce
                    que je mange » qui amène ici, pas « où est le thon ». */}
                <MealSuggestions
                  meal={meal.key}
                  date={day?.date}
                  onLogged={() => { load(); }}
                  onError={setError}
                />
                <div className="stat-label" style={{ margin: '16px 0 4px' }}>
                  Ou chercher un aliment
                </div>
                <FoodPicker
                  meal={meal.key}
                  onLogged={() => { load(); }}
                  onError={setError}
                />
              </>
            )}
          </div>
        );
      })}

      <div className="card">
        <button type="button" className="btn-ghost" onClick={copyYesterday}>
          Recopier la veille
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
          L’alimentation est répétitive : recopier évite de ressaisir les mêmes
          lignes chaque jour.
        </p>
      </div>
    </div>
  );
}
