import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// node-postgres renvoie NUMERIC en string pour préserver la précision
// arbitraire. Nos magnitudes/volumes tiennent largement dans un double
// et l'API les sérialise en JSON: on les convertit ici plutôt que de
// parser au cas par cas dans chaque route.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[db] erreur client inactif:', err.message);
});

export const query = (text, params) => pool.query(text, params);

/** Exécute une fonction dans une transaction, avec rollback automatique. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Attend que Postgres accepte les connexions (démarrage du conteneur). */
export async function waitForDatabase({ retries = 30, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`[db] indisponible (${attempt}/${retries}), nouvelle tentative...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
