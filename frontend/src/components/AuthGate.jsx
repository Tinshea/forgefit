import { useCallback, useEffect, useState } from 'react';
import { api, SESSION_EVENT } from '../lib/api.js';
import { APP } from '../lib/modules.js';

/**
 * Le portail : connexion, ou création du compte.
 *
 * ┌─ TROIS ÉTATS, ET UN SEUL MÈNE À L'APPLICATION ────────────────────┐
 * │ NON RÉCLAMÉE   aucun mot de passe n'existe. L'application s'ouvre │
 * │                normalement — c'est l'état d'une instance montée   │
 * │                avant l'arrivée des comptes — et un bandeau        │
 * │                propose de la protéger.                            │
 * │ RÉCLAMÉE       un mot de passe existe, mais pas de session : rien │
 * │                ne s'affiche avant la connexion.                   │
 * │ CONNECTÉ       l'application.                                     │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Tant que l'état n'est pas connu, on ne montre RIEN : afficher
 * l'application une demi-seconde avant de la remplacer par un écran de
 * connexion donnerait l'impression d'avoir été éjecté.
 */
export default function AuthGate({ children }) {
  const [etat, setEtat] = useState(null);
  const [masquerBandeau, setMasquerBandeau] = useState(false);

  const relire = useCallback(() => api.authState()
    .then(setEtat)
    // Serveur injoignable : on laisse passer. Chaque écran sait déjà
    // dire qu'il n'a pas pu charger ses données, et un portail bloquant
    // sur une panne réseau enfermerait dehors sans raison.
    .catch(() => setEtat({ claimed: false, authenticated: false, horsLigne: true })), []);

  useEffect(() => { relire(); }, [relire]);

  // Une session qui expire en cours d'usage ramène au portail, plutôt
  // que de laisser douze écrans afficher « HTTP 401 » chacun de son côté.
  useEffect(() => {
    const onExpire = () => setEtat((e) => (e?.authenticated
      ? { ...e, authenticated: false, user: null }
      : e));
    window.addEventListener(SESSION_EVENT, onExpire);
    return () => window.removeEventListener(SESSION_EVENT, onExpire);
  }, []);

  // Le portail appartient à la COQUILLE, pas à un module : il porte donc
  // la palette d'Atlas. Sans cela il héritait du rouge de ForgeFit —
  // l'écran d'entrée de l'application aux couleurs d'un seul de ses
  // domaines, exactement la confusion qu'on vient de défaire.
  const portail = etat != null && ((etat.claimed && !etat.authenticated));
  useEffect(() => {
    if (portail) document.documentElement.setAttribute('data-module', 'hub');
  }, [portail]);

  if (!etat) return null;

  if (portail) return <Portail mode="login" onFait={relire} />;

  return (
    <>
      {!etat.claimed && !masquerBandeau && !etat.horsLigne && (
        <Bandeau onFermer={() => setMasquerBandeau(true)} onFait={relire} />
      )}
      {children}
    </>
  );
}

/**
 * Le bandeau d'une instance non protégée.
 *
 * Il dit ce qui est réellement en jeu — les données de santé sont
 * lisibles et modifiables par quiconque atteint l'adresse — sans
 * bloquer : sur un réseau privé, c'est un choix défendable, et ce n'est
 * pas à l'application de le faire à la place de son propriétaire.
 */
function Bandeau({ onFermer, onFait }) {
  const [ouvert, setOuvert] = useState(false);
  if (ouvert) return <Portail mode="register" onFait={onFait} onAnnuler={() => setOuvert(false)} />;

  return (
    <div className="auth-banner" role="status">
      {/* Court : un avertissement qui occupe un cinquième de l'écran
          devient lui-même le problème. La version longue montait à
          187 px sur un téléphone. */}
      <span>
        <strong>Aucun mot de passe.</strong> Qui atteint cette adresse lit
        et modifie tes données.
      </span>
      <span className="auth-banner-actions">
        <button type="button" className="btn-primary" onClick={() => setOuvert(true)}>
          Créer un compte
        </button>
        <button type="button" className="btn-ghost" onClick={onFermer}>
          Plus tard
        </button>
      </span>
    </div>
  );
}

function Portail({ mode, onFait, onAnnuler }) {
  const creation = mode === 'register';

  useEffect(() => {
    const avant = document.documentElement.getAttribute('data-module');
    document.documentElement.setAttribute('data-module', 'hub');
    // À la fermeture, le module courant reprend ses droits : sinon
    // l'application resterait en laiton après un simple « Annuler ».
    return () => { if (avant) document.documentElement.setAttribute('data-module', avant); };
  }, []);
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreurs, setErreurs] = useState([]);
  const [occupe, setOccupe] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setOccupe(true);
    setErreurs([]);
    try {
      if (creation) await api.register({ email, display_name: nom, password: mdp });
      else await api.login({ email, password: mdp });
      await onFait();
    } catch (err) {
      // Le serveur renvoie la LISTE des défauts d'un mot de passe : les
      // afficher un par un obligerait à soumettre plusieurs fois pour
      // les découvrir tous.
      setErreurs(err.details?.problems ?? err.problems ?? [err.message]);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={soumettre}>
        <h1 className="auth-title">{APP.name}</h1>
        <p className="auth-sub">
          {creation
            ? 'Protège cette instance. Le compte existant garde toutes ses données.'
            : 'Connecte-toi pour continuer.'}
        </p>

        {erreurs.length > 0 && (
          <ul className="auth-errors">
            {erreurs.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}

        <label className="auth-label" htmlFor="auth-email">Adresse</label>
        <input
          id="auth-email" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)}
        />

        {creation && (
          <>
            <label className="auth-label" htmlFor="auth-nom">Nom</label>
            <input
              id="auth-nom" type="text" autoComplete="name" required
              value={nom} onChange={(e) => setNom(e.target.value)}
            />
          </>
        )}

        <label className="auth-label" htmlFor="auth-mdp">Mot de passe</label>
        <input
          id="auth-mdp" type="password" required
          // `new-password` à la création, `current-password` à la
          // connexion : c'est ce qui décide si le gestionnaire du
          // navigateur PROPOSE d'en générer un ou remplit l'existant.
          autoComplete={creation ? 'new-password' : 'current-password'}
          value={mdp} onChange={(e) => setMdp(e.target.value)}
        />
        {creation && (
          <p className="auth-hint">
            Douze caractères au moins. Une phrase dont tu te souviens vaut mieux
            qu’un mot court hérissé de symboles.
          </p>
        )}

        <div className="auth-actions">
          <button type="submit" className="btn-primary" disabled={occupe}>
            {occupe ? 'Un instant…' : creation ? 'Créer le compte' : 'Se connecter'}
          </button>
          {onAnnuler && (
            <button type="button" className="btn-ghost" onClick={onAnnuler}>
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
