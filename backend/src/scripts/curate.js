#!/usr/bin/env node
// Applique le catalogue curé sur la base.
//
//   npm run curate
//
// L'ingestion l'appelle déjà en fin de course : ce script sert à
// rejouer la curation seule, après avoir modifié `exercise-evidence.js`,
// sans retélécharger les 1324 exercices.

import { pool, waitForDatabase } from '../db.js';
import { applyCuration } from '../services/curation.js';
import { curationStats } from '../services/exercise-evidence.js';

async function main() {
  await waitForDatabase();

  const stats = curationStats();
  const { matched, missing, cleared } = await applyCuration();

  console.log(`[curate] catalogue : ${stats.total} exercices classés`);
  for (const [tier, n] of Object.entries(stats.byTier)) {
    console.log(`[curate]   ${tier.padEnd(12)} ${n}`);
  }
  console.log(`[curate] ${cleared} ligne(s) déclassée(s), ${matched} mise(s) à jour`);

  if (missing.length) {
    // Pas une erreur fatale : le reste du catalogue est valable. Mais il
    // faut le voir, sinon un exercice recommandé disparaît sans bruit.
    console.warn(
      `[curate] ⚠ ${missing.length} identifiant(s) curé(s) absents du dataset : `
      + missing.join(', '),
    );
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[curate] échec :', err.message);
    await pool.end();
    process.exit(1);
  });
