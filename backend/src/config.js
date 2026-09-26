const required = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL', 'postgres://forgefit:forgefit@localhost:5432/forgefit'),
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  // Jeton porteur, pour les emetteurs qui ne savent pas signer.
  //
  // ┌─ POURQUOI UN SECOND MECANISME ────────────────────────────────┐
  // │ L'app Raccourcis d'iOS n'a AUCUNE action de hachage HMAC. Un  │
  // │ raccourci ne peut donc pas signer son corps de requete, et se │
  // │ voyait refuser par le webhook — c'est-a-dire que la seule     │
  // │ synchronisation automatique gratuite etait impossible.        │
  // │                                                                │
  // │ Le jeton est PLUS FAIBLE que la signature, et il faut le      │
  // │ savoir : il prouve qui emet, pas que le corps est intact, et  │
  // │ il est rejouable. C'est le prix a payer pour qu'un client      │
  // │ sans cryptographie puisse s'authentifier. La signature reste  │
  // │ acceptee et reste preferable quand l'emetteur sait la faire.   │
  // └────────────────────────────────────────────────────────────────┘
  webhookToken: process.env.WEBHOOK_TOKEN ?? '',
  mdnsHost: process.env.MDNS_HOST ?? '',
  // Origines autorisées.
  //
  // Le port 5173 (Vite) est inclus par défaut : même derrière le proxy
  // de dev, le navigateur envoie `Origin` sur toutes les requêtes
  // d'écriture (POST/PATCH/DELETE), et le proxy le transmet tel quel —
  // `changeOrigin` ne réécrit que `Host`. Sans lui, toutes les
  // écritures échouent en dev alors que les lectures passent.
  corsOrigins: (
    process.env.CORS_ORIGINS
    ?? 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  dataset: {
    url:
      process.env.EXERCISES_DATASET_URL ??
      'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json',
    // ATTENTION: les champs `image` / `gif_url` du dataset sont relatifs
    // ("images/0001-xxx.jpg") et se résolvent à la RACINE du dépôt, pas
    // sous /data. Préfixer avec .../main/data/ renvoie 404 sur les 1324
    // entrées — vérifié le 2026-07-19.
    mediaBase:
      process.env.EXERCISES_MEDIA_BASE ??
      'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main',
  },
  // Utilisateur par défaut (mono-utilisateur / démo). Une vraie authent
  // remplacerait ceci par le sujet du JWT.
  defaultUserId: process.env.DEFAULT_USER_ID ?? '00000000-0000-0000-0000-000000000001',
};

/**
 * Secrets d'exemple : connus de tout le monde, donc nuls.
 *
 * ┌─ POURQUOI CE GARDE-FOU EXISTE ──────────────────────────────────┐
 * │ `docker-compose.yml` retombe sur « dev-secret-change-me » quand  │
 * │ WEBHOOK_SECRET n'est pas defini, et ce depot est PUBLIC : cette  │
 * │ valeur est donc connue de quiconque lit le code.                 │
 * │                                                                   │
 * │ Or le webhook sante CONTOURNE la session (voir app.js) : il      │
 * │ porte sa propre preuve. Une instance mise en ligne sans changer  │
 * │ ce secret accepte donc les mesures de n'importe qui — et des     │
 * │ mesures injectees nourrissent le score de disponibilite, donc    │
 * │ les seances que le coach propose.                                │
 * │                                                                   │
 * │ On refuse de DEMARRER plutot que d'avertir dans un journal que   │
 * │ personne ne lit. Le seul moment ou l'on peut encore empecher la  │
 * │ mise en ligne d'une instance ouverte, c'est avant qu'elle        │
 * │ n'ecoute.                                                        │
 * └───────────────────────────────────────────────────────────────────┘
 */
const SECRETS_D_EXEMPLE = new Set([
  'dev-secret-change-me', 'change-me-in-prod', 'changeme', 'secret',
]);

if (config.env === 'production') {
  for (const [nom, valeur] of [
    ['WEBHOOK_SECRET', config.webhookSecret],
    ['WEBHOOK_TOKEN', config.webhookToken],
  ]) {
    if (valeur && SECRETS_D_EXEMPLE.has(valeur)) {
      throw new Error(
        `${nom} vaut encore la valeur d'exemple du depot, qui est publique.\n`
        + 'Genere-en une : openssl rand -base64 24\n'
        + `Puis renseigne ${nom} dans .env et relance.`,
      );
    }
  }

  // Ni signature ni jeton : le webhook accepte TOUT (verifySignature
  // rend `true` quand rien n'est configure). Acceptable sur un poste de
  // developpement, jamais sur une instance en ligne.
  if (!config.webhookSecret && !config.webhookToken) {
    throw new Error(
      'Aucun WEBHOOK_SECRET ni WEBHOOK_TOKEN : le webhook sante accepterait\n'
      + 'les mesures de n\'importe qui, sans authentification.\n'
      + 'Genere-en un : openssl rand -base64 24',
    );
  }
}
