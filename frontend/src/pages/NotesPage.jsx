import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Glyph from '../components/Glyph.jsx';
import { playLater as play } from '../lib/sound-lazy.js';

/**
 * Carnet — le second module, et le banc d'essai de la coquille.
 *
 * ┌─ CE QU'IL SERT À PROUVER ─────────────────────────────────────────┐
 * │ Rien ici ne parle d'entraînement, et c'est le but. Ce module      │
 * │ apporte sa propre section, sa propre table et sa propre route     │
 * │ sans qu'une ligne de ForgeFit change — ce qui est la seule façon  │
 * │ de vérifier qu'une coquille est réellement modulaire. Avec un     │
 * │ seul module, on ne découvre jamais ce qui était couplé.           │
 * │                                                                    │
 * │ Il est minuscule et se retire en supprimant trois choses : cette  │
 * │ page, sa route, et son entrée dans `modules.js`.                  │
 * └────────────────────────────────────────────────────────────────────┘
 */
export default function NotesPage() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.notes()
    .then((d) => setItems(d.items ?? []))
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.addNote(draft);
      setDraft('');
      play('confirm');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2 className="card-title">Écrire</h2>
        <p className="card-sub">
          Module de test de la coquille — sans rapport avec l’entraînement,
          et c’est exactement ce qu’il sert à vérifier
        </p>

        <div className="field-block">
          <label htmlFor="note-body">Note</label>
          <textarea
            id="note-body"
            className="note-input"
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Une idée, un rappel, un lien…"
          />
          <p className="field-hint">{draft.length} / 2000</p>
        </div>

        <button
          type="button" className="btn-primary"
          onClick={add} disabled={busy || !draft.trim()}
        >
          {busy ? 'Enregistrement…' : 'Ajouter'}
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Carnet</h2>
        <p className="card-sub">
          {items.length === 0
            ? 'Rien pour l’instant'
            : `${items.length} note${items.length > 1 ? 's' : ''} · les épinglées d’abord`}
        </p>

        {items.length > 0 && (
          <ul className="note-list">
            {items.map((n) => (
              <li key={n.id} className="note" data-pinned={n.pinned ? '' : undefined}>
                <p className="note-body">{n.body}</p>
                <div className="note-foot">
                  <span className="note-date">
                    {new Date(n.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button" className="note-action"
                    aria-pressed={n.pinned}
                    onClick={() => api.updateNote(n.id, { pinned: !n.pinned })
                      .then(load).catch((e) => setError(e.message))}
                  >
                    <Glyph name="epingle" size={11} />
                    {n.pinned ? 'Détacher' : 'Épingler'}
                  </button>
                  <button
                    type="button" className="note-action"
                    aria-label="Supprimer cette note"
                    onClick={() => api.deleteNote(n.id)
                      .then(() => { play('cancel'); return load(); })
                      .catch((e) => setError(e.message))}
                  >
                    <Glyph name="corbeille" size={11} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
