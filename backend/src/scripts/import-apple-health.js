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
import {
  canonicalType, normalizePercent, CUMULATIVE_TYPES, AVERAGED_TYPES,
} from '../services/adapters.js';

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
  // L'hydratation manquait : les applications de suivi d'eau
  // (WaterMinder et consorts) publient dans Santé, et la jauge
  // quotidienne de l'app attend précisément ces valeurs.
  'hydration',
  'exercise_minutes', 'distance', 'respiratory_rate', 'flights',
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
// Cumul et moyenne : même définition qu'à la lecture (cf. adapters.js).
// Sommer vingt mesures de fréquence respiratoire donnerait 320
// respirations par minute ; et les garder une par une gonflerait la base
// de 20 000 lignes pour une grandeur qui ne se lit qu'en tendance.
const CUMULATIVE = CUMULATIVE_TYPES;
const AVERAGED = AVERAGED_TYPES;

/**
 * Fusionne les agrégats journaliers en une valeur par type et par jour.
 *
 * Le même pas est compté DEUX FOIS dans un export Santé : l'iPhone dans
 * la poche et la montre au poignet l'enregistrent chacun de leur côté,
 * et l'export les livre tels quels. Les additionner produit des
 * impossibilités physiques — 25 heures d'exercice dans une journée,
 * 11 000 kcal de métabolisme de base pour quelqu'un qui en dépense
 * 1 700. L'app Santé, elle, n'affiche qu'une source à la fois selon un
 * ordre de priorité par appareil.
 *
 * On applique la même logique sans avoir cet ordre de priorité :
 *  — cumul  : on retient la source qui rapporte le plus, les autres
 *             n'étant qu'une mesure partielle du même phénomène ;
 *  — moyenne: on retient la source la mieux échantillonnée, une moyenne
 *             de moyennes hétérogènes n'ayant pas de sens.
 */
/**
 * Plages physiologiquement possibles, par jour pour les cumuls.
 *
 * Un export Santé contient des mesures fausses : capteur resté actif,
 * appareil mal réinitialisé, application tierce qui écrit n'importe
 * quoi. Sur ce jeu de données réel il restait, après déduplication,
 * 8 940 kcal de métabolisme de base (pour 1 700 réels) et exactement
 * 1 440 minutes d'exercice — soit 24 h pile, la signature d'un compteur
 * qui n'a jamais été remis à zéro.
 *
 * Ces valeurs sont rares mais tirent fortement les moyennes et écrasent
 * l'échelle des graphiques. Les bornes sont volontairement LARGES : on
 * ne cherche pas à juger la performance de l'utilisateur, seulement à
 * écarter ce qu'aucun corps humain ne peut produire. Un ultra-trail à
 * 80 000 pas passe ; 24 h d'exercice non.
 */
const PLAUSIBLE = {
  steps: [0, 100_000],
  distance: [0, 100],            // km
  flights: [0, 300],
  calories_active: [0, 8000],
  calories_basal: [800, 4000],
  exercise_minutes: [0, 720],    // 12 h
  hydration: [0, 15_000],        // mL
  sleep: [0, 14],                // h
  hrv: [1, 400],                 // ms
  resting_hr: [25, 130],
  heart_rate: [25, 230],
  respiratory_rate: [4, 45],
  weight: [25, 400],             // kg
  height: [100, 250],            // cm
  bmi: [8, 70],
  lean_mass: [15, 200],          // kg
  body_fat: [2, 70],             // %
  vo2max: [10, 95],
  spo2: [50, 100],               // %
};

const aberrantes = new Map();

function plausible(type, value) {
  const bornes = PLAUSIBLE[type];
  if (!bornes) return true;      // type sans borne connue : on ne juge pas
  return value >= bornes[0] && value <= bornes[1];
}

function dedupeDaily(daily) {
  const best = new Map();
  for (const d of daily.values()) {
    const key = `${d.type}|${d.day}`;
    const val = AVERAGED.has(d.type) ? d.total / d.count : d.total;
    const rank = AVERAGED.has(d.type) ? d.count : val;
    const prev = best.get(key);
    if (!prev || rank > prev.rank) {
      best.set(key, { type: d.type, day: d.day, unit: d.unit, value: val, rank });
    }
  }
  return [...best.values()];
}

/**
 * Le sommeil n'est pas une quantité mais une CATÉGORIE.
 *
 * Ses enregistrements portent une valeur textuelle — « InBed »,
 * « AsleepCore », « AsleepREM » — et non un nombre : `Number()` y
 * renvoyait NaN, et les 22 000 enregistrements de sommeil étaient
 * silencieusement écartés.
 *
 * La durée se déduit de l'écart entre début et fin. Chaque nuit est
 * rattachée au jour du RÉVEIL : une nuit commencée à 23 h appartient au
 * lendemain, sinon elle serait comptée sur la veille et un décalage
 * d'une heure ferait changer de jour.
 */
const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';

/**
 * Avant iOS 16, seul « InBed » existait ; depuis, les phases sont
 * détaillées. On privilégie le sommeil réel et on ne retombe sur le
 * temps au lit que pour les nuits sans phase détaillée — sans quoi les
 * années anciennes disparaîtraient.
 */
const isAsleep = (v) => /AsleepCore|AsleepDeep|AsleepREM|AsleepUnspecified|^HKCategoryValueSleepAnalysisAsleep$/.test(v);
const isInBed = (v) => /InBed/.test(v);

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
  // Sommeil : deux accumulateurs par nuit, le second servant de repli.
  const sleepAsleep = new Map();
  const sleepInBed = new Map();
  const stats = { lines: 0, records: 0, kept: 0, skipped: 0 };
  const byType = new Map();

  for await (const line of stream) {
    stats.lines += 1;
    if (!line.includes('<Record ')) continue;
    stats.records += 1;

    const rawType = attr(line, 'type');

    // Le sommeil se traite à part : sa valeur est un libellé, sa durée
    // se déduit des horodatages.
    if (rawType === SLEEP_TYPE) {
      const v = attr(line, 'value') ?? '';
      const asleep = isAsleep(v);
      const inBed = isInBed(v);
      if (!asleep && !inBed) { stats.skipped += 1; continue; }

      const from = new Date(attr(line, 'startDate'));
      const to = new Date(attr(line, 'endDate'));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        stats.skipped += 1; continue;
      }
      const hours = (to - from) / 3_600_000;
      // Une phase de plus de 18 h n'est pas du sommeil mais une erreur
      // de saisie ou un capteur resté actif.
      if (!(hours > 0) || hours > 18) { stats.skipped += 1; continue; }
      if (SINCE && to < SINCE) { stats.skipped += 1; continue; }

      const night = to.toISOString().slice(0, 10); // jour du réveil
      // Montre et téléphone enregistrent la même nuit : on cumule par
      // source, la fusion se fait ensuite (cf. nuitsFusionnees).
      const who = attr(line, 'sourceName') ?? 'apple_health';
      const bucket = asleep ? sleepAsleep : sleepInBed;
      const k = `${night}|${who}`;
      bucket.set(k, (bucket.get(k) ?? 0) + hours);

      stats.kept += 1;
      byType.set('sleep', (byType.get('sleep') ?? 0) + 1);
      continue;
    }

    const type = canonicalType(rawType);
    if (!TRACKED.has(type)) { stats.skipped += 1; continue; }

    const rawValue = attr(line, 'value');
    // Apple exprime les pourcentages en fraction : 0.175 vaut 17,5 %.
    const num = normalizePercent(type, Number(rawValue));
    if (!Number.isFinite(num)) { stats.skipped += 1; continue; }

    const startDate = attr(line, 'startDate');
    const at = new Date(startDate);
    if (Number.isNaN(at.getTime())) { stats.skipped += 1; continue; }
    if (SINCE && at < SINCE) { stats.skipped += 1; continue; }

    const unit = attr(line, 'unit');
    const source = attr(line, 'sourceName') ?? 'apple_health';

    if (CUMULATIVE.has(type) || AVERAGED.has(type)) {
      const day = at.toISOString().slice(0, 10);
      // La SOURCE fait partie de la clé : voir dedupeDaily.
      const key = `${type}|${day}|${source}`;
      const prev = daily.get(key);
      if (prev) { prev.total += num; prev.count += 1; }
      else daily.set(key, { type, day, total: num, count: 1, unit, source });
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
    const mode = CUMULATIVE.has(t) ? 'cumulé/jour'
      : AVERAGED.has(t) ? 'moyenné/jour'
        : t === 'sleep' ? 'durée par nuit' : 'ponctuel';
    console.log(`  ${t.padEnd(18)} ${String(n).padStart(8)}  (${mode})`);
  }

  // Une nuit sans phase détaillée retombe sur le temps passé au lit :
  // c'est le seul signal disponible avant iOS 16, et l'écarter ferait
  // disparaître des années d'historique.
  // Une nuit vue par deux appareils ne dure pas deux fois plus : on
  // garde la plus longue observation, pas leur somme.
  const nuitsFusionnees = (bucket) => {
    const out = new Map();
    for (const [k, h] of bucket) {
      const night = k.slice(0, 10);
      if (h > (out.get(night) ?? 0)) out.set(night, h);
    }
    return out;
  };
  const phases = nuitsFusionnees(sleepAsleep);
  const auLit = nuitsFusionnees(sleepInBed);

  const nights = new Set([...phases.keys(), ...auLit.keys()]);
  const sleepRows = [...nights].map((night) => ({
    type: 'sleep',
    at: new Date(`${night}T08:00:00Z`),
    unit: 'h',
    source: 'apple_health',
    externalId: keyFor(['ah', 'sleep', night]),
    value: Math.round((phases.get(night) ?? auLit.get(night)) * 100) / 100,
  }));
  if (sleepRows.length) {
    console.log(`\n[import] sommeil : ${sleepRows.length} nuits `
      + `(${phases.size} avec phases détaillées, `
      + `${nights.size - phases.size} au temps passé au lit)`);
  }

  const brutes = [
    ...sleepRows,
    ...punctual.map((r) => ({
      type: r.type,
      at: r.at,
      unit: r.unit,
      source: 'apple_health',
      externalId: keyFor(['ah', r.type, r.startDate, r.source]),
      value: Math.round(r.num * 1000) / 1000,
    })),
    ...dedupeDaily(daily).map((d) => ({
      type: d.type,
      // Milieu de journée : une valeur quotidienne n'a pas d'heure, et
      // midi évite qu'un décalage de fuseau la fasse changer de jour.
      at: new Date(`${d.day}T12:00:00Z`),
      unit: d.unit,
      source: 'apple_health',
      externalId: keyFor(['ah', d.type, d.day]),
      value: Math.round(d.value * 1000) / 1000,
    })),
  ];

  const rows = brutes.filter((r) => {
    if (plausible(r.type, r.value)) return true;
    aberrantes.set(r.type, (aberrantes.get(r.type) ?? 0) + 1);
    return false;
  });
  if (aberrantes.size) {
    const detail = [...aberrantes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t}×${n}`).join(', ');
    console.log(`\n[import] ${[...aberrantes.values()].reduce((a, b) => a + b, 0)} `
      + `valeurs hors plage physiologique écartées : ${detail}`);
  }

  const nbNuits = rows.filter((r) => r.type === 'sleep').length;
  const nbJournaliers = rows.filter(
    (r) => r.type !== 'sleep' && (CUMULATIVE.has(r.type) || AVERAGED.has(r.type)),
  ).length;
  console.log(`\n[import] ${rows.length.toLocaleString('fr-FR')} lignes à écrire `
    + `(${(rows.length - nbNuits - nbJournaliers).toLocaleString('fr-FR')} ponctuelles, `
    + `${nbJournaliers.toLocaleString('fr-FR')} journalières, `
    + `${nbNuits.toLocaleString('fr-FR')} nuits)`);
  console.log(`[import] ${daily.size.toLocaleString('fr-FR')} agrégats source×jour `
    + `fusionnés en ${nbJournaliers.toLocaleString('fr-FR')} valeurs`);

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
