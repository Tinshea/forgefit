import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import FoodCard, { CATEGORY_META } from '../components/FoodCard.jsx';
import { round1 } from '../lib/format.js';

/**
 * Catalogue d'aliments : consulter et comparer.
 *
 * Le tri par densité protéique ou par prix au gramme de protéine répond
 * à la question qu'on se pose vraiment en faisant ses courses : où
 * trouver des protéines pas chères.
 */

const SORTS = [
  { key: 'name', label: 'Nom' },
  { key: 'protein', label: 'Protéines' },
  { key: 'kcal', label: 'Calories' },
  { key: 'price_protein', label: '€ / 10 g protéines' },
];


/** Prix pour 10 g de protéines : le vrai indicateur de rapport qualité-prix. */
function pricePerProtein(food) {
  const protein = Number(food.protein_g ?? 0);
  const price = food.price_eur == null ? null : Number(food.price_eur);
  if (!protein || price == null || price === 0) return null;
  return Math.round((price / protein) * 10 * 1000) / 1000;
}

export default function FoodCatalogue() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      api.foods({ q: query || undefined, category: category || undefined, limit: 200 })
        .then((d) => { setItems(d.items); setCategories(d.categories ?? []); setError(null); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer.current);
  }, [query, category]);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === 'protein') {
      list.sort((a, b) => Number(b.protein_g) - Number(a.protein_g));
    } else if (sort === 'kcal') {
      list.sort((a, b) => Number(b.kcal) - Number(a.kcal));
    } else if (sort === 'price_protein') {
      list.sort((a, b) => {
        const pa = pricePerProtein(a);
        const pb = pricePerProtein(b);
        // Les aliments sans prix ou sans protéines partent en fin de
        // liste plutôt que d'être classés arbitrairement en tête.
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return list;
  }, [items, sort]);

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      {selected && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <h2 className="card-title">{selected.name}</h2>
              <p className="card-sub" style={{ margin: 0 }}>
                Valeurs pour {round1(selected.reference_qty)} {selected.unit}
                {selected.brand && ` · ${selected.brand}`}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
              Fermer
            </button>
          </div>

          <div className="stat-row" style={{ marginTop: 14 }}>
            <div className="stat">
              <div className="stat-label">Calories</div>
              <div className="stat-value">{round1(selected.kcal)} <span className="stat-unit">kcal</span></div>
            </div>
            <div className="stat">
              <div className="stat-label">Protéines</div>
              <div className="stat-value">{round1(selected.protein_g)} <span className="stat-unit">g</span></div>
            </div>
            <div className="stat">
              <div className="stat-label">Glucides</div>
              <div className="stat-value">
                {round1(selected.carbs_g)} <span className="stat-unit">g</span>
              </div>
              {Number(selected.fiber_g) > 0 && (
                <div style={{ fontSize: 11, color: 'var(--good)', marginTop: 3 }}>
                  dont {round1(selected.fiber_g)} g de fibres
                </div>
              )}
            </div>
            <div className="stat">
              <div className="stat-label">Lipides</div>
              <div className="stat-value">{round1(selected.fat_g)} <span className="stat-unit">g</span></div>
            </div>
          </div>

          <div className="stat-row" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="stat-label">Prix</div>
              <div className="stat-value">
                {selected.price_eur == null ? '—' : `${round1(selected.price_eur * 10) / 10} €`}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">€ / 10 g protéines</div>
              <div className="stat-value">
                {pricePerProtein(selected) == null
                  ? '—'
                  : `${pricePerProtein(selected).toFixed(2)} €`}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Densité protéique</div>
              <div className="stat-value">
                {Number(selected.kcal) > 0
                  ? `${Math.round((Number(selected.protein_g) * 4 / Number(selected.kcal)) * 100)} %`
                  : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                des calories
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Catégorie</div>
              <div className="stat-value" style={{ fontSize: 15, paddingTop: 6 }}>
                {CATEGORY_META[selected.category]?.icon}{' '}
                {CATEGORY_META[selected.category]?.label}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Catalogue d’aliments</h2>
        <p className="card-sub">
          {items.length} aliment{items.length > 1 ? 's' : ''} · macros et prix
        </p>

        <input
          className="field-search"
          type="search"
          placeholder="Rechercher…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher un aliment"
        />

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button" className="tab"
            aria-selected={category === ''} onClick={() => setCategory('')}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.category} type="button" className="tab"
              aria-selected={category === c.category}
              onClick={() => setCategory(c.category)}
            >
              {CATEGORY_META[c.category]?.icon} {CATEGORY_META[c.category]?.label ?? c.category}
              <span style={{ color: 'var(--text-muted)' }}> {c.count}</span>
            </button>
          ))}
        </div>

        <div className="field-block" style={{ marginTop: 14, marginBottom: 0 }}>
          <label>Trier par</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SORTS.map((s) => (
              <button
                key={s.key} type="button" className="tab"
                aria-selected={sort === s.key} onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {sort === 'price_protein' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Ce que coûtent 10 g de protéines. La question qu’on se pose
              vraiment en faisant ses courses.
            </p>
          )}
        </div>
      </div>

      {loading && items.length === 0 && <p className="empty">Chargement…</p>}
      {!loading && items.length === 0 && (
        <div className="card"><p className="empty">Aucun aliment ne correspond.</p></div>
      )}

      {sorted.length > 0 && (
        <div className="grid grid-3">
          {sorted.map((f) => (
            <FoodCard key={f.id} food={f} onSelect={setSelected} />
          ))}
        </div>
      )}

      <div className="legend" style={{ padding: '0 4px' }}>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-2)' }} />
          Protéines
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
          Glucides
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--warning)' }} />
          Lipides
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          — la barre montre la part de chaque macro dans les calories
        </span>
      </div>
    </div>
  );
}
