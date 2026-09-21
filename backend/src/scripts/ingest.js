#!/usr/bin/env node
// Ingestion du dataset d'exercices.
//
//   npm run ingest              -- telecharge et injecte
//   npm run ingest -- --file ./exercises.json   -- source locale
//   npm run ingest -- --dry-run                 -- statistiques seules
//
// Idempotent : rejouable sans creer de doublons (upsert sur external_id).

import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { pool, withTransaction, waitForDatabase } from '../db.js';
import { translateExerciseName, slugify } from '../lib/translate-fr.js';
import {
  classifyDiscipline, classifyAxis, normalizeMuscle, normalizeSecondary,
} from '../lib/classify.js';
import { applySchemaUpdates } from '../db/schema-updates.js';
import { applyCuration } from '../services/curation.js';

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagValue = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const DRY_RUN = hasFlag('--dry-run');
const LOCAL_FILE = flagValue('--file');

/** Charge le dataset depuis le disque ou le reseau. */
async function loadDataset() {
  if (LOCAL_FILE) {
    console.log(`[ingest] lecture locale : ${LOCAL_FILE}`);
    return JSON.parse(await readFile(LOCAL_FILE, 'utf8'));
  }
  console.log(`[ingest] telechargement : ${config.dataset.url}`);
  const res = await fetch(config.dataset.url);
  if (!res.ok) {
    throw new Error(`Telechargement du dataset echoue : HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Construit une URL media absolue.
 *
 * Les champs `image` / `gif_url` sont relatifs ("images/0001-x.jpg") et
 * se resolvent a la RACINE du depot -- surtout pas sous /data/, ou le
 * fichier JSON reside. Le prefixe intuitif .../main/data/ renvoie 404
 * sur la totalite des entrees.
 *
 * Les medias ne sont jamais telecharges : on ne stocke que l'URL.
 */
function mediaUrl(relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const base = config.dataset.mediaBase.replace(/\/+$/, '');
  const path = String(relativePath).replace(/^\/+/, '');
  return `${base}/${path}`;
}

/** Transforme une entree brute en ligne prete pour Postgres. */
function transform(raw, slugRegistry) {
  const nameEn = String(raw.name ?? '').trim();
  const nameFr = translateExerciseName(nameEn) || nameEn;
  const discipline = classifyDiscipline(raw);
  const axis = classifyAxis(raw, discipline);

  // `slug` est UNIQUE : 10 noms traduits entrent en collision sur 1324
  // (ex. deux variantes distinctes rendues identiquement). On suffixe
  // avec l'identifiant du dataset plutot que de perdre l'exercice.
  let slug = slugify(nameFr) || slugify(nameEn) || `exercice-${raw.id}`;
  if (slugRegistry.has(slug)) {
    slug = `${slug}-${raw.id}`;
  }
  slugRegistry.add(slug);

  return {
    external_id: String(raw.id),
    slug,
    name_en: nameEn,
    name_fr: nameFr,
    discipline,
    category: String(raw.category ?? 'inconnu'),
    body_part: raw.body_part ?? null,
    equipment: raw.equipment ?? null,
    // Vocabulaire unifie : `target` et `secondary_muscles` emploient des
    // termes differents dans la source (cf. normalizeMuscle).
    target: normalizeMuscle(raw.target),
    muscle_group: raw.muscle_group ?? null,
    secondary_muscles: normalizeSecondary(raw.secondary_muscles, raw.target),
    axis,
    image_url: mediaUrl(raw.image),
    gif_url: mediaUrl(raw.gif_url),
    media_id: raw.media_id ?? null,
    attribution: raw.attribution ?? null,
    // Instructions conservees dans les 10 langues. Le francais est
    // priorise a la lecture par l'API, mais on ne jette rien.
    instructions: raw.instructions ?? {},
    instruction_steps: raw.instruction_steps ?? {},
  };
}

const UPSERT = `
  INSERT INTO exercises (
    external_id, slug, name_en, name_fr, discipline, category, body_part,
    equipment, target, muscle_group, secondary_muscles, axis,
    image_url, gif_url, media_id, attribution, instructions, instruction_steps
  ) VALUES (
    $1,$2,$3,$4,$5::discipline,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb
  )
  ON CONFLICT (external_id) DO UPDATE SET
    slug              = EXCLUDED.slug,
    name_en           = EXCLUDED.name_en,
    name_fr           = EXCLUDED.name_fr,
    discipline        = EXCLUDED.discipline,
    category          = EXCLUDED.category,
    body_part         = EXCLUDED.body_part,
    equipment         = EXCLUDED.equipment,
    target            = EXCLUDED.target,
    muscle_group      = EXCLUDED.muscle_group,
    secondary_muscles = EXCLUDED.secondary_muscles,
    axis              = EXCLUDED.axis,
    image_url         = EXCLUDED.image_url,
    gif_url           = EXCLUDED.gif_url,
    media_id          = EXCLUDED.media_id,
    attribution       = EXCLUDED.attribution,
    instructions      = EXCLUDED.instructions,
    instruction_steps = EXCLUDED.instruction_steps
`;

function summarize(rows) {
  const tally = (key) =>
    rows.reduce((acc, r) => {
      const k = r[key] ?? 'null';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const frCoverage = rows.filter((r) => (r.instructions?.fr?.length ?? 0) > 0).length;
  const withMedia = rows.filter((r) => r.gif_url).length;

  console.log('\n=== Repartition par discipline ===');
  for (const [k, v] of Object.entries(tally('discipline')).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${v}`);
  }
  console.log('\n=== Repartition par axe athletique ===');
  for (const [k, v] of Object.entries(tally('axis')).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${v}`);
  }
  console.log(`\nInstructions FR : ${frCoverage}/${rows.length}`);
  console.log(`URL media       : ${withMedia}/${rows.length}`);
}

async function main() {
  const dataset = await loadDataset();
  if (!Array.isArray(dataset)) {
    throw new Error('Format inattendu : un tableau JSON est attendu.');
  }
  console.log(`[ingest] ${dataset.length} exercices lus.`);

  const slugRegistry = new Set();
  const rows = dataset.map((raw) => transform(raw, slugRegistry));

  summarize(rows);

  if (DRY_RUN) {
    console.log('\n[ingest] --dry-run : aucune ecriture en base.');
    console.log('Exemple :', JSON.stringify(rows[0], null, 2).slice(0, 700));
    return;
  }

  await waitForDatabase();
  // Les colonnes de curation peuvent manquer si l'ingestion tourne avant
  // le premier demarrage de l'API (c'est le cas au premier boot).
  await applySchemaUpdates();

  let written = 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      await client.query(UPSERT, [
        r.external_id, r.slug, r.name_en, r.name_fr, r.discipline, r.category,
        r.body_part, r.equipment, r.target, r.muscle_group, r.secondary_muscles,
        r.axis, r.image_url, r.gif_url, r.media_id, r.attribution,
        JSON.stringify(r.instructions), JSON.stringify(r.instruction_steps),
      ]);
      written += 1;
      if (written % 250 === 0) console.log(`[ingest] ${written}/${rows.length}...`);
    }
  });

  console.log(`\n[ingest] termine : ${written} exercices enregistres.`);

  // Le catalogue cure s'applique dans la foulee : un catalogue ingere
  // mais non classe n'alimenterait ni les modeles de programme ni les
  // filtres de fiabilite.
  const { matched, missing } = await applyCuration();
  console.log(`[ingest] curation : ${matched} exercices classes.`);
  if (missing.length) {
    console.warn(
      `[ingest] curation : ${missing.length} identifiant(s) absent(s) du dataset : `
      + missing.join(', '),
    );
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[ingest] echec :', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
