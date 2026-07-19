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
