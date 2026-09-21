import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Suggestions de repas.
 *
 * Elles partent de ce qu'il RESTE à manger dans la journée, pas d'un
 * catalogue trié par ordre alphabétique : une suggestion qui ignore le
 * journal du jour n'est qu'un livre de cuisine.
 *
 * Chaque proposition affiche la RAISON de son rang. Sans cela, le
 * classement demande d'être cru sur parole — et un coach qu'on ne peut
 * pas contredire ne vaut pas mieux qu'un tirage au sort.
 */

const round = (v) => Math.round(Number(v ?? 0));

function RecipeDetail({ id, portion, meal, onLogged, onClose, onError }) {
  const [recipe, setRecipe] = useState(null);
  const [servings, setServings] = useState(portion);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.recipe(id).then(setRecipe).catch((e) => onError(e.message));
  }, [id, onError]);

  if (!recipe) return <p className="empty">Chargement de la recette…</p>;

  const factor = servings / recipe.servings;
  const scaled = (v) => Math.round(Number(v ?? 0) * servings * 10) / 10;

  const log = async () => {
    setBusy(true);
    try {
      await api.logRecipe({ recipe_id: id, meal, portion: servings });
      await onLogged();
    } catch (e) {
      onError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: 'var(--series-1)', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="card-title">{recipe.name}</h3>
          <p className="card-sub" style={{ margin: 0 }}>
            {recipe.prep_minutes ? `${recipe.prep_minutes} min · ` : ''}
            {recipe.ingredient_count} ingrédients
            {recipe.price_eur != null && ` · ${(Number(recipe.price_eur) * servings).toFixed(2)} €`}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>Fermer</button>
      </div>

      {recipe.note && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
          {recipe.note}
        </p>
      )}

      <div className="stat-row" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="stat-value">{scaled(recipe.kcal)}</div>
          <div className="stat-label">kcal</div>
        </div>
        <div className="stat">
          <div className="stat-value">{scaled(recipe.protein_g)}</div>
          <div className="stat-label">protéines</div>
        </div>
        <div className="stat">
          <div className="stat-value">{scaled(recipe.carbs_g)}</div>
          <div className="stat-label">glucides</div>
        </div>
        <div className="stat">
          <div className="stat-value">{scaled(recipe.fat_g)}</div>
          <div className="stat-label">lipides</div>
        </div>
      </div>

      <div className="field-block" style={{ marginTop: 12 }}>
        <label htmlFor={`portion-${id}`}>Portions</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} id={`portion-${id}`}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((p) => (
            <button
              key={p} type="button" className="tab"
              aria-selected={servings === p} onClick={() => setServings(p)}
            >
              ×{p}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-label" style={{ margin: '14px 0 6px' }}>Ingrédients</div>
      <div>
        {recipe.ingredients.map((ing) => (
          <div className="log-line" key={ing.id}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {ing.name}
              <span className="log-meta">
                {' · '}{Math.round(Number(ing.quantity) * factor)} {ing.unit}
              </span>
            </span>
            <span className="log-value">{round(Number(ing.kcal) * factor)} kcal</span>
          </div>
        ))}
      </div>

      {(recipe.steps ?? []).length > 0 && (
        <>
          <div className="stat-label" style={{ margin: '14px 0 6px' }}>Préparation</div>
          <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13, lineHeight: 1.65 }}>
            {recipe.steps.map((step, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{step}</li>
            ))}
          </ol>
        </>
      )}

      <button
        type="button" className="btn-primary" onClick={log} disabled={busy}
        style={{ marginTop: 14 }}
      >
        {busy ? 'Enregistrement…' : `Ajouter au journal (×${servings})`}
      </button>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
        Les ingrédients sont enregistrés un par un : le journal reste une liste
        d’aliments, modifiable ligne à ligne.
      </p>
    </div>
  );
}

export default function MealSuggestions({ meal, date, onLogged, onError }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
    api.mealSuggestions({ meal, date, limit: 5 })
      .then((d) => { setData(d); setState('ready'); })
      .catch(() => setState('error'));
  }, [meal, date]);

  // Sans cibles calculées, il n'y a pas de budget : on n'affiche rien
  // plutôt qu'un classement fondé sur rien.
  if (state !== 'ready' || !data?.items?.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="stat-label" style={{ marginBottom: 4 }}>
        Suggestions pour ce repas
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
        Budget calculé sur ce qu’il te reste : {data.budget.kcal} kcal et{' '}
        {data.budget.protein_g} g de protéines, réparties sur{' '}
        {data.budget.meals_left} repas restant{data.budget.meals_left > 1 ? 's' : ''}.
      </p>

      {data.exhausted && (
        <p style={{ fontSize: 12, color: 'var(--warning)', margin: '0 0 10px' }}>
          ▲ Le budget calorique du jour est déjà atteint. Ces propositions le
          dépasseront.
        </p>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {data.items.map((s) => (
          <div key={s.recipe.id}>
            <button
              type="button"
              className="exercise-item"
              onClick={() => setOpen(open === s.recipe.id ? null : s.recipe.id)}
              aria-expanded={open === s.recipe.id}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="exercise-name">
                  {s.recipe.name}
                  {s.portion !== 1 && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      {' '}×{s.portion}
                    </span>
                  )}
                </span>
                <span className="exercise-meta">
                  {round(s.macros.kcal)} kcal · P {round(s.macros.protein_g)} · G{' '}
                  {round(s.macros.carbs_g)} · L {round(s.macros.fat_g)}
                  {s.recipe.prep_minutes ? ` · ${s.recipe.prep_minutes} min` : ''}
                </span>
              </span>
              <span
                className="pill"
                style={{
                  color: s.meets_protein_threshold ? 'var(--good)' : 'var(--text-muted)',
                }}
              >
                {round(s.macros.protein_g)} g P
              </span>
            </button>

            {open === s.recipe.id && (
              <>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
                  padding: '8px 12px 0',
                }}>
                  {s.reasons.map((r, i) => <div key={i}>· {r}</div>)}
                  {s.warnings.map((w, i) => (
                    <div key={i} style={{ color: 'var(--warning)' }}>▲ {w}</div>
                  ))}
                </div>
                <RecipeDetail
                  id={s.recipe.id}
                  portion={s.portion}
                  meal={meal}
                  onLogged={async () => { setOpen(null); await onLogged(); }}
                  onClose={() => setOpen(null)}
                  onError={onError}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {data.sources?.length > 0 && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          Seuil de protéines par repas : {data.sources[0].citation}
        </p>
      )}
    </div>
  );
}
