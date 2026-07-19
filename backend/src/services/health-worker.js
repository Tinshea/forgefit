// Worker d'ingestion asynchrone.
//
// L'endpoint webhook ecrit le payload BRUT puis rend la main (202). Ce
// worker fait la normalisation hors du cycle requete/reponse : un export
// Apple Health de 30 000 echantillons ne doit pas tenir la connexion
// HTTP ouverte, ni faire expirer le client.
//
// Reveil par LISTEN/NOTIFY, avec un balayage periodique en filet de
// securite (une notification est perdue si le worker redemarre pile
// entre l'INSERT et le LISTEN).

import pg from 'pg';
import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { normalizePayload } from './adapters.js';

const SWEEP_INTERVAL_MS = 15_000;
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;

let listener = null;
let sweepTimer = null;
let running = false;
let draining = false;

const INSERT_METRIC = `
  INSERT INTO health_metrics
    (user_id, metric_type, recorded_at, source, external_id, unit, value, meta)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
  ON CONFLICT (user_id, source, external_id)
    WHERE external_id IS NOT NULL
  DO UPDATE SET
    value       = EXCLUDED.value,
    unit        = EXCLUDED.unit,
    meta        = EXCLUDED.meta,
    recorded_at = EXCLUDED.recorded_at,
    ingested_at = now()
`;

/** Traite un evenement : normalise puis insere les metriques. */
async function processEvent(event) {
  const { source, metrics } = normalizePayload(event.payload, event.source);
  const userId = event.user_id ?? config.defaultUserId;

  await withTransaction(async (client) => {
    for (const m of metrics) {
      await client.query(INSERT_METRIC, [
        userId,
        m.metricType,
        m.recordedAt,
        source,
        m.externalId,
        m.unit,
        JSON.stringify(m.value),
        JSON.stringify(m.meta ?? {}),
      ]);
    }

    await client.query(
      `UPDATE webhook_events
          SET status = 'processed', processed_at = now(),
              metrics_count = $2, error = NULL
        WHERE id = $1`,
      [event.id, metrics.length],
    );
  });

  return metrics.length;
}

/** Consomme les evenements en attente jusqu'a epuisement. */
async function drain() {
  if (draining) return;
  draining = true;

  try {
    for (;;) {
      // Reservation ATOMIQUE du lot : le UPDATE ... RETURNING bascule les
      // lignes en 'processing' dans la meme instruction que leur
      // selection. Un simple SELECT ... FOR UPDATE via le pool ne
      // suffirait pas : hors transaction explicite, chaque requete est
      // auto-committee et le verrou tomberait aussitot, laissant deux
      // instances traiter le meme evenement.
      const { rows } = await pool.query(
        `UPDATE webhook_events
            SET status = 'processing'
          WHERE id IN (
            SELECT id
              FROM webhook_events
             WHERE status = 'pending'
               AND attempts < $2
             ORDER BY received_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED
          )
        RETURNING id, source, user_id, payload, attempts`,
        [BATCH_SIZE, MAX_ATTEMPTS],
      );
      if (!rows.length) break;

      for (const event of rows) {
        try {
          const count = await processEvent(event);
          console.log(`[worker] evenement ${event.id} traite (${count} metriques)`);
        } catch (err) {
          const attempts = (event.attempts ?? 0) + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          // Remis en 'pending' tant que le quota de tentatives n'est pas
          // epuise : la clause attempts < MAX_ATTEMPTS ci-dessus borne la
          // reprise, l'evenement ne peut donc pas boucler indefiniment.
          await pool.query(
            `UPDATE webhook_events
                SET status = $2::webhook_status, attempts = $3, error = $4,
                    processed_at = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END
              WHERE id = $1`,
            [event.id, failed ? 'failed' : 'pending', attempts, err.message],
          );
          console.error(
            `[worker] evenement ${event.id} en echec (tentative ${attempts}) : ${err.message}`,
          );
        }
      }
    }
  } finally {
    draining = false;
  }
}

/** Ouvre une connexion dediee au LISTEN et la maintient. */
async function connectListener() {
  listener = new pg.Client({ connectionString: config.databaseUrl });

  listener.on('notification', () => {
    drain().catch((err) => console.error('[worker] drain :', err.message));
  });

  listener.on('error', (err) => {
    console.error('[worker] connexion LISTEN perdue :', err.message);
    listener = null;
    if (running) setTimeout(() => connectListener().catch(() => {}), 5_000);
  });

  await listener.connect();
  await listener.query('LISTEN health_event');
  console.log('[worker] ecoute du canal health_event');
}

export async function startHealthWorker() {
  if (running) return;
  running = true;

  await connectListener().catch((err) => {
    console.error('[worker] LISTEN indisponible, bascule en scrutation :', err.message);
  });

  // Reprise sur incident : un worker tue en plein lot laisse des lignes
  // bloquees en 'processing'. Personne ne les reprendrait sans ceci.
  const stale = await pool.query(
    `UPDATE webhook_events
        SET status = 'pending'
      WHERE status = 'processing'
        AND received_at < now() - INTERVAL '5 minutes'
    RETURNING id`,
  ).catch(() => ({ rows: [] }));
  if (stale.rows.length) {
    console.log(`[worker] ${stale.rows.length} evenement(s) bloque(s) remis en file`);
  }

  sweepTimer = setInterval(() => {
    drain().catch((err) => console.error('[worker] balayage :', err.message));
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();

  // Rattrape ce qui serait arrive pendant un arret.
  await drain().catch((err) => console.error('[worker] rattrapage :', err.message));
}

export async function stopHealthWorker() {
  running = false;
  if (sweepTimer) clearInterval(sweepTimer);
  if (listener) await listener.end().catch(() => {});
  listener = null;
}

export { drain as drainHealthEvents };
