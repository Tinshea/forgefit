// Application du catalogue curé sur la table `exercises`.
//
// La curation vit en JS (`exercise-evidence.js`) et non en base : c'est
// un jugement éditorial qui se relit, se discute et se versionne dans
// git. La base n'en garde qu'une projection, reconstruite à chaque
// exécution — donc jamais divergente de sa source.
//
// Idempotent : on remet à zéro les colonnes de curation avant de
// réécrire. Retirer une entrée du catalogue la déclasse réellement, au
// lieu de laisser un palier fantôme sur la ligne.

import { pool } from '../db.js';
import {
  CURATED, MOVEMENT_PATTERNS, isCompound, resolveRefs,
} from './exercise-evidence.js';

/** Charge utile envoyée à Postgres en un seul paramètre JSONB. */
function curationPayload() {
  return CURATED.map((x) => ({
    external_id: x.id,
    pattern: x.pattern,
    tier: x.tier,
    rank: x.rank,
    // Sans note propre, on retombe sur la description du patron : une
    // ligne vide dans l'interface n'apprend rien à personne.
    note: x.note ?? MOVEMENT_PATTERNS[x.pattern]?.label ?? null,
    sources: resolveRefs(x.refs),
    compound: isCompound(x.pattern),
  }));
}

/**
 * Projette le catalogue curé en base.
 *
 * @param {object} [executor] client de transaction ; le pool par défaut.
 * @returns {{matched: number, missing: string[], cleared: number}}
 *   `missing` liste les identifiants curés absents de la table : c'est
 *   le signal qu'une entrée du catalogue vise un exercice que le dataset
 *   ne fournit plus. Sans ce retour, la curation échouerait en silence.
 */
export async function applyCuration(executor = pool) {
  const payload = curationPayload();

  const cleared = await executor.query(
    `UPDATE exercises
        SET evidence_tier = NULL, movement_pattern = NULL, is_compound = NULL,
            evidence_note = NULL, evidence_sources = '[]'::jsonb, pattern_rank = NULL
      WHERE evidence_tier IS NOT NULL`,
  );

  const { rows } = await executor.query(
    `WITH v AS (
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(
         external_id TEXT, pattern TEXT, tier TEXT, rank INT,
         note TEXT, sources JSONB, compound BOOLEAN
       )
     )
     UPDATE exercises ex
        SET evidence_tier    = v.tier::evidence_tier,
            movement_pattern = v.pattern,
            pattern_rank     = v.rank,
            is_compound      = v.compound,
            evidence_note    = v.note,
            evidence_sources = v.sources
       FROM v
      WHERE ex.external_id = v.external_id
      RETURNING ex.external_id`,
    [JSON.stringify(payload)],
  );

  const matchedIds = new Set(rows.map((r) => r.external_id));
  const missing = payload
    .map((p) => p.external_id)
    .filter((id) => !matchedIds.has(id));

  return { matched: rows.length, missing, cleared: cleared.rowCount };
}
