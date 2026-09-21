import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Abonnement du calendrier externe (Google, Apple, Outlook).
 *
 * Une URL .ics plutôt que l'API Google : elle fonctionne avec tous les
 * agendas, sans compte développeur ni autorisation à renouveler. Le
 * secret tient dans l'URL, puisqu'une application d'agenda ne sait pas
 * envoyer d'en-tête d'authentification.
 *
 * Les limites sont affichées AVANT le lien, pas après : un abonnement en
 * lecture seule qui se met à jour toutes les quelques heures, c'est une
 * attente à corriger d'emblée.
 */
export default function CalendarSubscribe() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    api.calendarSubscription().then(setData).catch((e) => setError(e.message));
  }, [open, data]);

  const url = data ? api.calendarUrl(data.path) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) :
      // le champ reste sélectionnable à la main.
      setError('Copie impossible : sélectionne le lien et copie-le manuellement.');
    }
  };

  const rotate = async () => {
    if (!window.confirm(
      'Régénérer le lien ? Les agendas déjà abonnés cesseront de se mettre à jour '
      + 'et devront être réabonnés avec le nouveau lien.',
    )) return;
    setRotating(true);
    try {
      const next = await api.rotateCalendarToken();
      setData((d) => ({ ...d, ...next }));
    } catch (e) {
      setError(e.message);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h2 className="card-title">Ajouter à mon agenda</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Google Agenda, Apple Calendrier, Outlook — par abonnement à un lien
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {error && <div className="error-banner">{error}</div>}
          {!data && !error && <p className="empty">Chargement du lien…</p>}

          {data && (
            <>
              <div className="stat-label" style={{ marginBottom: 6 }}>
                Avant de t’abonner
              </div>
              <ul style={{
                paddingLeft: 18, margin: '0 0 14px', fontSize: 12,
                color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                {data.caveats.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
              </ul>

              <div className="field-block">
                <label htmlFor="ics-url">Lien d’abonnement</label>
                <input
                  id="ics-url" value={url} readOnly
                  onFocus={(e) => e.target.select()}
                  style={{ fontFamily: 'monospace', fontSize: 12, width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-primary" onClick={copy}>
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
                <a
                  className="btn-ghost" href={url} download="forgefit.ics"
                  style={{ textDecoration: 'none' }}
                >
                  Télécharger le .ics
                </a>
                <button
                  type="button" className="btn-ghost" onClick={rotate} disabled={rotating}
                  style={{ color: 'var(--critical)' }}
                >
                  {rotating ? 'Régénération…' : 'Régénérer le lien'}
                </button>
              </div>

              <div className="stat-label" style={{ margin: '18px 0 6px' }}>Où le coller</div>
              <ul style={{
                paddingLeft: 18, margin: 0, fontSize: 12,
                color: 'var(--text-muted)', lineHeight: 1.7,
              }}>
                {data.instructions.map((x, i) => <li key={i}>{x}</li>)}
              </ul>

              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
                Le téléchargement importe une copie FIGÉE : elle ne suivra pas les
                modifications du programme. L’abonnement par lien, si.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
