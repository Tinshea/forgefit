#!/usr/bin/env node
// Import de l'export natif de l'app Santé (gratuit, sans application tierce).
//
//   Sur l'iPhone : Santé → photo de profil → « Exporter toutes les
//   données de santé » → un fichier export.zip arrive par AirDrop,
//   e-mail ou Fichiers. Le dézipper donne apple_health_export/export.xml.
//
//   npm run import:health -- --file "C:/chemin/export.xml"
//   npm run import:health -- --file ... --dry-run
//   npm run import:health -- --file ... --since 2026-01-01
//
// ┌─ POURQUOI UN ANALYSEUR MAISON ────────────────────────────────────┐
// │ Ce fichier atteint couramment plusieurs centaines de mégaoctets — │
// │ l'app Santé enregistre les pas toutes les quelques minutes depuis │
// │ des années. Le charger en mémoire pour le parser ferait exploser  │
// │ le processus.                                                      │
// │                                                                    │
// │ La structure est heureusement plate : une suite de balises        │
// │ <Record .../> auto-fermantes, une par ligne. Un balayage ligne à  │
// │ ligne suffit, sans dépendance ni mémoire proportionnelle au       │
// │ fichier.                                                           │
// └────────────────────────────────────────────────────────────────────┘

import fs from 'node:fs';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { pool, waitForDatabase } from '../db.js';
import { config } from '../config.js';
import { canonicalType } from '../services/adapters.js';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const value = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const FILE = value('--file');
const DRY_RUN = flag('--dry-run');
const SINCE = value('--since') ? new Date(value('--since')) : null;
const USER_ID = value('--user') ?? config.defaultUserId;

if (!FILE) {
  console.error('Usage : npm run import:health -- --file "chemin/vers/export.xml"');
  process.exit(1);
}

/**
 * Types suivis. Les autres sont ignorés : l'export contient des dizaines
 * de types (bruit ambiant, temps d'écoute, ergonomie du casque…) sans
 * rapport avec l'entraînement.
 */
const TRACKED = new Set([
  'weight', 'body_fat', 'lean_mass', 'bmi', 'height',
  'sleep', 'hrv', 'resting_hr', 'steps',
  'calories_active', 'calories_basal', 'vo2max', 'spo2',
]);

/**
 * Métriques CUMULATIVES : l'app Santé les enregistre par petits
 * fragments (les pas, toutes les quelques minutes). Les importer tels
 * quels créerait des centaines de milliers de lignes pour une
 * information qui ne se lit qu'au jour. On les additionne par journée.
 *
 * Les autres sont ponctuelles — une pesée, une mesure de VFC — et se
 * conservent telles quelles.
 */
const CUMULATIVE = new Set(['steps', 'calories_active', 'calories_basal']);

/** Attribut d'une balise Record. Les valeurs sont entre guillemets. */
const attr = (line, name) => {
  const m = line.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/**
 * Clé stable pour un enregistrement.
 *
 * L'export d'Apple ne porte aucun identifiant unique. On en fabrique un
 * déterministe à partir du type, de la date et de la source : réimporter
 * le même fichier — ou un export ultérieur qui recouvre la même
 * période — ne créera pas de doublon.
 */
const keyFor = (parts) => crypto.createHash('sha1')
  .update(parts.join('|')).digest('hex').slice(0, 32);

const INSERT = `
  INSERT INTO health_metrics
    (user_id, metric_type, recorded_at, source, external_id, unit, value)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
  ON CONFLICT (user_id, source, external_id) WHERE external_id IS NOT NULL
  DO NOTHING
`;

async function main() {
  if (!fs.existsSync(FILE)) throw new Error(`Fichier introuvable : ${FILE}`);
  const sizeMb = fs.statSync(FILE).size / 1024 / 1024;
  console.log(`[import] ${FILE} (${sizeMb.toFixed(0)} Mo)`);
  if (SINCE) console.log(`[import] limité aux mesures postérieures au ${SINCE.toISOString().slice(0, 10)}`);

  const stream = readline.createInterface({
    input: fs.createReadStream(FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const punctual = [];                 // mesures ponctuelles
  const daily = new Map();             // cumuls : clé `type|jour` → total
  const stats = { lines: 0, records: 0, kept: 0, skipped: 0 };
  const byType = new Map();

  for await (const line of stream) {
    stats.lines += 1;
    if (!line.includes('<Record ')) continue;
    stats.records += 1;

    const rawType = attr(line, 'type');
    const type = canonicalType(rawType);
    if (!TRACKED.has(type)) { stats.skipped += 1; continue; }

    const rawValue = attr(line, 'value');
    const num = Number(rawValue);
    if (!Number.isFinite(num)) { stats.skipped += 1; continue; }

    const startDate = attr(line, 'startDate');
    const at = new Date(startDate);
    if (Number.isNaN(at.getTime())) { stats.skipped += 1; continue; }
    if (SINCE && at < SINCE) { stats.skipped += 1; continue; }

    const unit = attr(line, 'unit');
    const source = attr(line, 'sourceName') ?? 'apple_health';

    if (CUMULATIVE.has(type)) {
      const day = at.toISOString().slice(0, 10);
      const key = `${type}|${day}`;
      const prev = daily.get(key);
      if (prev) prev.total += num;
      else daily.set(key, { type, day, total: num, unit, source });
    } else {
      punctual.push({ type, at, num, unit, source, startDate });
    }

    stats.kept += 1;
    byType.set(type, (byType.get(type) ?? 0) + 1);

    if (stats.records % 200_000 === 0) {
      console.log(`[import] ${stats.records.toLocaleString('fr-FR')} enregistrements lus…`);
    }
  }

  console.log(`\n[import] ${stats.records.toLocaleString('fr-FR')} enregistrements, `
    + `${stats.kept.toLocaleString('fr-FR')} retenus, `
    + `${stats.skipped.toLocaleString('fr-FR')} ignorés`);

  console.log('\n=== Répartition par type ===');
  for (const [t, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    const mode = CUMULATIVE.has(t) ? 'cumulé par jour' : 'ponctuel';
    console.log(`  ${t.padEnd(16)} ${String(n).padStart(8)}  (${mode})`);
  }

  const rows = [
    ...punctual.map((r) => ({
      type: r.type,
      at: r.at,
      unit: r.unit,
      source: 'apple_health',
      externalId: keyFor(['ah', r.type, r.startDate, r.source]),
      value: Math.round(r.num * 1000) / 1000,
    })),
    ...[...daily.values()].map((d) => ({
      type: d.type,
      // Milieu de journée : une somme quotidienne n'a pas d'heure, et
      // midi évite qu'un décalage de fuseau la fasse changer de jour.
      at: new Date(`${d.day}T12:00:00Z`),
      unit: d.unit,
      source: 'apple_health',
      externalId: keyFor(['ah', d.type, d.day]),
      value: Math.round(d.total * 1000) / 1000,
    })),
  ];

  console.log(`\n[import] ${rows.length.toLocaleString('fr-FR')} lignes à écrire `
    + `(${punctual.length.toLocaleString('fr-FR')} ponctuelles, ${daily.size.toLocaleString('fr-FR')} cumuls journaliers)`);

  if (!rows.length) {
    console.log('[import] rien à importer.');
    return;
  }

  const span = rows.reduce(
    (acc, r) => ({
      min: !acc.min || r.at < acc.min ? r.at : acc.min,
      max: !acc.max || r.at > acc.max ? r.at : acc.max,
    }),
    { min: null, max: null },
  );
  console.log(`[import] période couverte : ${span.min.toISOString().slice(0, 10)} `
    + `→ ${span.max.toISOString().slice(0, 10)}`);

  if (DRY_RUN) {
    console.log('\n[import] --dry-run : aucune écriture en base.');
    console.log('Exemples :');
    rows.slice(0, 5).forEach((r) => console.log(
      `  ${r.at.toISOString().slice(0, 16)}  ${r.type.padEnd(14)} ${r.value} ${r.unit ?? ''}`,
    ));
    return;
  }

  await waitForDatabase();

  // Insertion par lots : une requête par ligne sur 100 000 lignes
  // prendrait des heures. `ON CONFLICT DO NOTHING` rend l'opération
  // rejouable sans doublon.
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of chunk) {
        await client.query(INSERT, [
          USER_ID, r.type, r.at, r.source, r.externalId, r.unit,
          JSON.stringify({ value: r.value }),
        ]);
      }
      await client.query('COMMIT');
      written += chunk.length;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    if (written % 5000 === 0 || written === rows.length) {
      console.log(`[import] ${written.toLocaleString('fr-FR')} / ${rows.length.toLocaleString('fr-FR')}`);
    }
  }

  const { rows: check } = await pool.query(
    // Dates formatées en SQL : un type date renvoyé par le pilote
    // s'affiche autrement en chaîne verbeuse et illisible.
    `SELECT metric_type, COUNT(*)::int AS n,
            to_char(MIN(recorded_at), 'YYYY-MM-DD') AS depuis,
            to_char(MAX(recorded_at), 'YYYY-MM-DD') AS jusqu_a
       FROM health_metrics
      WHERE user_id = $1 AND source = 'apple_health'
      GROUP BY 1 ORDER BY 2 DESC`,
    [USER_ID],
  );
  console.log('\n=== En base après import (source apple_health) ===');
  for (const r of check) {
    console.log(`  ${r.metric_type.padEnd(16)} ${String(r.n).padStart(6)}  ${r.depuis} → ${r.jusqu_a}`);
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[import] échec :', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
