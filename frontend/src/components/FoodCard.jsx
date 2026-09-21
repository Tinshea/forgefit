/**
 * Fiche visuelle d'un aliment : macros et prix lisibles d'un coup d'œil.
 *
 * Les produits scannés portent une photo (Open Food Facts). Les aliments
 * génériques n'en ont pas : il n'existe pas de base d'images libres
 * couvrant « blanc de poulet » ou « riz complet cuit » de façon fiable,
 * et en constituer une serait un projet à part entière. Le pictogramme
 * de catégorie remplit ce rôle sans dépendance réseau ni image qui met
 * deux secondes à charger.
 */

import { round1 } from '../lib/format.js';

export const CATEGORY_META = {
  feculents: { icon: '🌾', label: 'Féculents', color: 'var(--warning)' },
  proteines: { icon: '🍗', label: 'Protéines', color: 'var(--critical)' },
  laitiers: { icon: '🥛', label: 'Laitiers', color: 'var(--series-1)' },
  legumes: { icon: '🥦', label: 'Légumes', color: 'var(--good)' },
  fruits: { icon: '🍎', label: 'Fruits', color: 'var(--serious)' },
  matieres_grasses: { icon: '🫒', label: 'Matières grasses', color: 'var(--warning)' },
  complements: { icon: '💊', label: 'Compléments', color: 'var(--series-2)' },
  condiments: { icon: '🧂', label: 'Condiments', color: 'var(--text-muted)' },
  plats: { icon: '🍽️', label: 'Plats', color: 'var(--serious)' },
  plaisirs: { icon: '🍫', label: 'Plaisirs', color: 'var(--critical)' },
  boissons: { icon: '🥤', label: 'Boissons', color: 'var(--series-1)' },
  autre: { icon: '🍴', label: 'Autre', color: 'var(--text-muted)' },
};


/** Part calorique de chaque macro : montre la nature de l'aliment. */
function MacroBar({ food }) {
  const p = Number(food.protein_g ?? 0) * 4;
  const c = Math.max(0, Number(food.carbs_g ?? 0) - Number(food.fiber_g ?? 0)) * 4;
  const f = Number(food.fat_g ?? 0) * 9;
  const total = p + c + f;
  if (total <= 0) return null;

  const seg = [
    { key: 'p', pct: (p / total) * 100, color: 'var(--series-2)' },
    { key: 'c', pct: (c / total) * 100, color: 'var(--series-1)' },
    { key: 'f', pct: (f / total) * 100, color: 'var(--warning)' },
  ].filter((s) => s.pct > 0.5);

  return (
    <div
      style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', gap: 2 }}
      aria-hidden="true"
    >
      {seg.map((s) => (
        <div key={s.key} style={{ width: `${s.pct}%`, background: s.color }} />
      ))}
    </div>
  );
}

export default function FoodCard({ food, onSelect, compact = false }) {
  const cat = CATEGORY_META[food.category] ?? CATEGORY_META.autre;
  const ref = `${round1(food.reference_qty)} ${food.unit}`;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(food)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {food.image_url ? (
          <img
            src={food.image_url} alt="" loading="lazy" decoding="async"
            style={{
              width: 44, height: 44, borderRadius: 8, objectFit: 'cover',
              background: 'var(--surface-3)', flex: 'none',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span
            style={{
              width: 44, height: 44, borderRadius: 8, flex: 'none',
              background: 'var(--surface-3)', display: 'grid',
              placeItems: 'center', fontSize: 22,
            }}
            aria-hidden="true"
          >
            {cat.icon}
          </span>
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 14, fontWeight: 650, lineHeight: 1.25,
          }}>
            {food.name}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {food.brand ? `${food.brand} · ` : ''}pour {ref}
          </span>
        </span>

        <span style={{ textAlign: 'right', flex: 'none' }}>
          <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>
            {round1(food.kcal)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>kcal</span>
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <MacroBar food={food} />
      </div>

      <div style={{
        display: 'flex', gap: 10, marginTop: 8, fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
      }}>
        <span style={{ color: 'var(--series-2)' }}>P {round1(food.protein_g)}</span>
        <span style={{ color: 'var(--series-1)' }}>G {round1(food.carbs_g)}</span>
        <span style={{ color: 'var(--warning)' }}>L {round1(food.fat_g)}</span>
        {!compact && Number(food.fiber_g) > 0 && (
          <span style={{ color: 'var(--good)' }}>F {round1(food.fiber_g)}</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontWeight: 650 }}>
          {food.price_eur == null ? '—' : `${round1(food.price_eur * 10) / 10} €`}
        </span>
      </div>
    </button>
  );
}
