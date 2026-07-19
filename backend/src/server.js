import { createApp } from './app.js';
import { config } from './config.js';
import { pool, waitForDatabase } from './db.js';
import { startHealthWorker, stopHealthWorker } from './services/health-worker.js';

const app = createApp();

async function main() {
  await waitForDatabase();
  console.log('[api] base de données disponible');

  // Le worker tourne dans le processus API : suffisant a cette echelle,
  // et extractible tel quel en service separe (il ne partage que la
  // base). Les instances multiples se coordonnent via SKIP LOCKED.
  await startHealthWorker();

  const server = app.listen(config.port, () => {
    console.log(`[api] à l'écoute sur le port ${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} reçu, arrêt en cours...`);
    server.close(async () => {
      await stopHealthWorker();
      await pool.end();
      process.exit(0);
    });
    // Filet de securite si des connexions restent ouvertes.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] démarrage impossible :', err.message);
  process.exit(1);
});
