import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { round1 } from '../lib/format.js';

/**
 * Les recettes.
 *
 * ┌─ POURQUOI CET ÉCRAN EXISTE ───────────────────────────────────────┐
 * │ Vingt-cinq recettes étaient en base, servies par l'API, et        │
 * │ AUCUN écran ne les appelait. Elles étaient invisibles depuis      │
 * │ l'application qui les contient.                                   │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Le tri par défaut est le prix pour 10 g de protéines, comme au
 * catalogue d'aliments : c'est la question qu'on se pose vraiment en
 * décidant quoi cuisiner.
 */

const TRIS = [
  { key: 'proteines', label: 'Protéines' },
  { key: 'rapide', label: 'Le plus rapide' },
  { key: 'prix', label: '€ / 10 g protéines' },
  { key: 'nom', label: 'Nom' },
];

const REPAS = [
  { key: '', label: 'Tous' },
  { key: 'matin', label: 'Matin' },
  { key: 'midi', label: 'Midi' },
  { key: 'soir', label: 'Soir' },
  { key: 'collation', label: 'Collation' },
];

/** `{midi,soir}` en base — un tableau Postgres rendu en texte. */
const repasDe = (r) => String(r.meals ?? '').replace(/[{}]/g, '').split(',').filter(Boolean);

const prixProteine = (r) => {
  const p = Number(r.protein_g ?? 0);
  const prix = r.price_eur == null ? null : Number(r.price_eur);
  if (!p || prix == null) return null;
  return Math.round((prix / p) * 10 * 100) / 100;
};

export default function RecipesPage() {
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [tri, setTri] = useState('proteines');
  const [repas, setRepas] = useState('');
  const [tag, setTag] = useState('');
  const [ouverte, setOuverte] = useState(null);

  useEffect(() => {
    api.recipes({ limit: 100 })
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setErreur(e.message));
  }, []);

  const tags = useMemo(() => {
    const t = new Set();
    for (const r of items ?? []) for (const x of r.tags ?? []) t.add(x);
    return [...t].sort();
  }, [items]);

  const listees = useMemo(() => {
    let l = [...(items ?? [])];
    if (repas) l = l.filter((r) => repasDe(r).includes(repas));
    if (tag) l = l.filter((r) => (r.tags ?? []).includes(tag));
    if (tri === 'proteines') l.sort((a, b) => Number(b.protein_g) - Number(a.protein_g));
    else if (tri === 'rapide') l.sort((a, b) => (a.prep_minutes ?? 999) - (b.prep_minutes ?? 999));
    else if (tri === 'prix') {
      l.sort((a, b) => {
        const pa = prixProteine(a); const pb = prixProteine(b);
        // Sans prix, en fin de liste plutôt que classé arbitrairement.
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      });
    } else l.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return l;
  }, [items, tri, repas, tag]);

  if (erreur) return <div className="error-banner">{erreur}</div>;
  if (!items) return <p className="empty">Chargement…</p>;

  return (
    <div className="grid">
      {ouverte && <Fiche recette={ouverte} onFermer={() => setOuverte(null)} />}

      <div className="card">
        <h2 className="card-title">Recettes</h2>
        <p className="card-sub">
          {listees.length} recette{listees.length > 1 ? 's' : ''} · macros, temps et prix
        </p>

        <div className="field-block" style={{ marginTop: 12 }}>
          <label>Repas</label>
          <div className="chip-row">
            {REPAS.map((r) => (
              <button
                key={r.key || 'tous'} type="button" className="tab"
                aria-selected={repas === r.key} onClick={() => setRepas(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-block">
          <label>Trier par</label>
          <div className="chip-row">
            {TRIS.map((t) => (
              <button
                key={t.key} type="button" className="tab"
                aria-selected={tri === t.key} onClick={() => setTri(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="field-block" style={{ marginBottom: 0 }}>
            <label>Filtrer</label>
            <div className="chip-row">
              <button
                type="button" className="tab"
                aria-selected={tag === ''} onClick={() => setTag('')}
              >
                Tout
              </button>
              {tags.map((t) => (
                <button
                  key={t} type="button" className="tab"
                  aria-selected={tag === t} onClick={() => setTag(t)}
                >
                  {t.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {listees.length === 0 && (
        <div className="card"><p className="empty">Aucune recette ne correspond.</p></div>
      )}

      {listees.length > 0 && (
        <div className="grid grid-3">
          {listees.map((r) => (
            <button
              type="button" className="card card-clickable recette" key={r.id}
              onClick={() => setOuverte(r)}
            >
              <div className="recette-tete">
                <h3 className="card-title" style={{ fontSize: 16, margin: 0 }}>{r.name}</h3>
                {r.prep_minutes != null && (
                  <span className="recette-temps">{r.prep_minutes} min</span>
                )}
              </div>

              <div className="recette-macros">
                <span><strong>{Math.round(r.kcal)}</strong> kcal</span>
                <span><strong>{round1(r.protein_g)}</strong> g prot.</span>
                <span><strong>{round1(r.carbs_g)}</strong> g gluc.</span>
                <span><strong>{round1(r.fat_g)}</strong> g lip.</span>
              </div>

              <div className="recette-bas">
                {prixProteine(r) != null && (
                  <span className="recette-prix">{prixProteine(r).toFixed(2)} € / 10 g prot.</span>
                )}
                <span className="recette-tags">{(r.tags ?? []).slice(0, 3).join(' · ')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Fiche({ recette: r, onFermer }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    // La liste ne porte pas les ingrédients : on va les chercher.
    api.recipe(r.id).then(setDetail).catch(() => setDetail({ ...r, ingredients: [] }));
  }, [r.id]);

  const d = detail ?? r;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">{d.name}</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {d.servings} portion{d.servings > 1 ? 's' : ''}
            {d.prep_minutes != null ? ` · ${d.prep_minutes} min de préparation` : ''}
            {repasDe(d).length ? ` · ${repasDe(d).join(', ')}` : ''}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onFermer}>Fermer</button>
      </div>

      <div className="stat-row" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="stat-label">Calories</div>
          <div className="stat-value">{Math.round(d.kcal)} <span className="stat-unit">kcal</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Protéines</div>
          <div className="stat-value">{round1(d.protein_g)} <span className="stat-unit">g</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Glucides</div>
          <div className="stat-value">{round1(d.carbs_g)} <span className="stat-unit">g</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Lipides</div>
          <div className="stat-value">{round1(d.fat_g)} <span className="stat-unit">g</span></div>
        </div>
      </div>

      {d.ingredients?.length > 0 && (
        <>
          <div className="stat-label" style={{ margin: '18px 0 8px' }}>Ingrédients</div>
          <ul className="recette-ingredients">
            {d.ingredients.map((i) => (
              <li key={i.id ?? i.name}>
                <span>{i.name ?? i.food_name}</span>
                <span className="recette-qte">
                  {round1(i.quantity ?? i.qty)} {i.unit ?? 'g'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {d.steps?.length > 0 && (
        <>
          <div className="stat-label" style={{ margin: '18px 0 8px' }}>Préparation</div>
          <ol className="recette-etapes">
            {d.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </>
      )}

      {d.note && <p className="recette-note">{d.note}</p>}
    </div>
  );
}
