import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Faire entrer les données de l'app Santé, depuis l'application.
 *
 * ┌─ CE QUE CETTE CARTE REMPLACE ─────────────────────────────────────┐
 * │ L'analyseur existait et fonctionnait, mais ne s'invoquait qu'en   │
 * │ ligne de commande, dans le conteneur. Importer ses propres        │
 * │ données de santé supposait un terminal et un `docker exec` — donc │
 * │ en pratique, ne pas les importer.                                 │
 * │                                                                    │
 * │ Le mode d'emploi est ÉCRIT ICI plutôt que renvoyé à une           │
 * │ documentation : cette manipulation se fait une fois tous les       │
 * │ quelques mois, et personne ne se souvient du chemin dans l'app     │
 * │ Santé d'une fois sur l'autre.                                      │
 * └────────────────────────────────────────────────────────────────────┘
 */

const mo = (o) => `${(o / 1024 / 1024).toFixed(1)} Mo`;

export default function HealthImport() {
  const [sources, setSources] = useState([]);
  const [etat, setEtat] = useState('repos');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [progres, setProgres] = useState(0);
  const champ = useRef(null);

  const relire = () => api.healthSources().then((d) => setSources(d.items ?? [])).catch(() => {});
  useEffect(() => { relire(); }, []);

  const envoyer = async (fichier) => {
    if (!fichier) return;
    setErreur(null);
    setResultat(null);

    if (/\.zip$/i.test(fichier.name)) {
      setErreur('C’est l’archive. Ouvre-la d’abord (appui long → Décompresser dans '
        + 'Fichiers) et choisis « export.xml » à l’intérieur.');
      return;
    }

    setEtat('envoi');
    setProgres(0);
    try {
      // XMLHttpRequest et non `fetch` : c'est le seul moyen d'obtenir
      // une progression d'ENVOI, et un export peut peser des centaines
      // de mégaoctets sur une liaison locale.
      const r = await new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open('POST', '/api/health/import');
        x.setRequestHeader('Content-Type', 'application/xml');
        x.withCredentials = true;
        x.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgres(Math.round((e.loaded / e.total) * 100));
        };
        x.onload = () => {
          let corps = null;
          try { corps = JSON.parse(x.responseText); } catch { corps = null; }
          if (x.status >= 200 && x.status < 300) resolve(corps);
          else reject(new Error(corps?.error ?? `HTTP ${x.status}`));
        };
        x.onerror = () => reject(new Error('Connexion interrompue.'));
        x.send(fichier);
      });
      setEtat('analyse');
      setResultat(r);
      await relire();
      setEtat('repos');
    } catch (e) {
      setErreur(e.message);
      setEtat('repos');
    }
  };

  const apple = sources.find((s) => s.source === 'apple_health');

  return (
    <div className="card">
      <h2 className="card-title">Importer depuis l’app Santé</h2>
      <p className="card-sub">
        Sommeil, VFC, pas, fréquence au repos, poids — depuis l’export natif de
        l’iPhone, sans application tierce.
      </p>

      {apple ? (
        <p className="import-etat">
          Dernière donnée importée&nbsp;: <strong>{apple.last_recorded_at?.slice(0, 10)}</strong>
          {' · '}{apple.metrics.toLocaleString('fr-FR')} mesures, {apple.types} types.
        </p>
      ) : (
        <p className="import-etat">Aucune donnée Santé importée pour l’instant.</p>
      )}

      <ol className="import-etapes">
        <li>Sur l’iPhone, ouvre <strong>Santé</strong> → ta photo de profil en haut à droite.</li>
        <li>Tout en bas&nbsp;: <strong>Exporter toutes les données de santé</strong>.</li>
        <li>Enregistre l’archive dans <strong>Fichiers</strong>, puis décompresse-la
          (appui long → Décompresser).</li>
        <li>Reviens ici et choisis <strong>export.xml</strong>, dans le dossier
          <em> apple_health_export</em>.</li>
      </ol>

      <p className="import-note">
        L’export complet pèse souvent plusieurs centaines de mégaoctets —
        l’application Santé enregistre tes pas toutes les quelques minutes depuis
        des années. L’envoi peut prendre un moment, et rien n’est perdu si tu
        recommences&nbsp;: réimporter deux fois la même mesure ne la duplique pas.
      </p>

      <input
        ref={champ}
        type="file"
        accept=".xml,text/xml,application/xml"
        hidden
        onChange={(e) => envoyer(e.target.files?.[0])}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button" className="btn-primary"
          disabled={etat !== 'repos'}
          onClick={() => champ.current?.click()}
        >
          {etat === 'envoi' ? `Envoi… ${progres}%`
            : etat === 'analyse' ? 'Analyse en cours…'
              : 'Choisir export.xml'}
        </button>
      </div>

      {etat === 'envoi' && (
        <div className="gauge" style={{ height: 8, marginTop: 12 }}>
          <div className="gauge-fill" style={{ width: `${progres}%`, background: 'var(--brand)' }} />
        </div>
      )}

      {erreur && <div className="error-banner" style={{ marginTop: 12 }}>{erreur}</div>}

      {resultat && (
        <div className="import-resultat">
          <div className="stat-label" style={{ marginBottom: 8 }}>
            Import terminé · {mo(resultat.octets)} analysés
          </div>
          <ul className="import-journal">
            {(resultat.resume ?? []).map((l) => (
              <li key={l}>{l.replace(/^\[import\]\s*/, '')}</li>
            ))}
          </ul>
          {resultat.metriques?.length > 0 && (
            <table className="data-table" style={{ marginTop: 12 }}>
              <caption className="visually-hidden">Mesures en base après import</caption>
              <thead>
                <tr>
                  <th scope="col">Mesure</th><th scope="col">Nombre</th><th scope="col">Période</th>
                </tr>
              </thead>
              <tbody>
                {resultat.metriques.map((m) => (
                  <tr key={m.metric_type}>
                    <th scope="row" style={{ fontWeight: 500 }}>{m.metric_type}</th>
                    <td>{m.n.toLocaleString('fr-FR')}</td>
                    <td>{m.depuis} → {m.jusqu_a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
