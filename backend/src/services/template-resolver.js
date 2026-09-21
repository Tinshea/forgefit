// Résolution d'un modèle : patron de mouvement → exercice réel.
//
// Un modèle décrit « un tirage vertical », pas « traction à la barre
// fixe ». C'est ce qui lui permet de s'instancier dans une salle
// complète, avec deux haltères ou à mains nues. La résolution est le
// seul endroit où le matériel entre en jeu.
//
// Deux exigences qui se contredisent :
//  - prendre le MEILLEUR exercice du patron (le mieux classé) ;
//  - ne pas répéter le même mouvement trois fois dans la semaine.
// D'où la mémoire des exercices déjà placés : le second passage sur un
// patron descend d'un rang plutôt que de reproduire le premier.

import { pool } from '../db.js';
import { EQUIPMENT_PROFILES } from './templates.js';
import { MOVEMENT_PATTERNS } from './exercise-evidence.js';

const CANDIDATE_FIELDS = `
  id, external_id, name_fr, target, equipment, discipline, gif_url, image_url,
  movement_pattern, pattern_rank, evidence_tier::text AS evidence_tier,
  evidence_note, evidence_sources
`;

/**
 * Charge tous les candidats curés, groupés par patron.
 *
 * Une seule requête pour tout le programme : résoudre créneau par
 * créneau ferait une trentaine d'allers-retours pour un modèle à six
 * jours, sans rien gagner.
 */
async function loadCandidates(equipment, executor) {
  const { rows } = await executor.query(
    `SELECT ${CANDIDATE_FIELDS}
       FROM exercises
      WHERE movement_pattern IS NOT NULL
        AND ($1::text[] IS NULL OR equipment = ANY($1))
      ORDER BY movement_pattern, pattern_rank`,
    [equipment],
  );

  const byPattern = new Map();
  for (const row of rows) {
    if (!byPattern.has(row.movement_pattern)) byPattern.set(row.movement_pattern, []);
    byPattern.get(row.movement_pattern).push(row);
  }
  return byPattern;
}

/**
 * Instancie un modèle en exercices.
 *
 * @returns {{days: Array, substitutions: Array, unresolved: Array}}
 *   `substitutions` liste les créneaux qui ont dû sortir du profil de
 *   matériel, `unresolved` ceux qu'aucun exercice ne couvre. Les taire
 *   produirait un programme qui prétend couvrir un patron sans le faire.
 */
export async function resolveTemplate(template, {
  equipmentProfile = template.equipment_profile,
  executor = pool,
} = {}) {
  const profile = EQUIPMENT_PROFILES[equipmentProfile] ?? EQUIPMENT_PROFILES.salle;

  const restricted = await loadCandidates(profile.equipment, executor);
  // Repli hors profil : chargé seulement s'il y a une restriction à
  // lever. En salle complète, les deux jeux seraient identiques.
  const unrestricted = profile.equipment ? await loadCandidates(null, executor) : restricted;

  const used = new Set();
  const substitutions = [];
  const unresolved = [];

  const pick = (pattern, dayTitle) => {
    const inProfile = restricted.get(pattern) ?? [];
    const fallback = unrestricted.get(pattern) ?? [];

    // Le mieux classé encore libre, dans le profil.
    const fresh = inProfile.find((x) => !used.has(x.id));
    if (fresh) return { exercise: fresh, substituted: false };

    // Tous déjà placés : on réutilise le mieux classé du profil plutôt
    // que de sortir du matériel disponible pour éviter une répétition.
    if (inProfile.length) return { exercise: inProfile[0], substituted: false };

    // Aucun exercice de ce patron avec ce matériel : on sort du profil,
    // et on le dit.
    const outside = fallback.find((x) => !used.has(x.id)) ?? fallback[0];
    if (outside) {
      substitutions.push({
        day: dayTitle,
        pattern,
        pattern_label: MOVEMENT_PATTERNS[pattern]?.label ?? pattern,
        exercise: outside.name_fr,
        equipment: outside.equipment,
        reason: `Aucun exercice de ce patron n’est réalisable avec « ${profile.label} ». `
          + `Le mouvement proposé demande : ${outside.equipment ?? 'matériel non précisé'}.`,
      });
      return { exercise: outside, substituted: true };
    }

    unresolved.push({
      day: dayTitle,
      pattern,
      pattern_label: MOVEMENT_PATTERNS[pattern]?.label ?? pattern,
      reason: 'Aucun exercice classé ne couvre ce patron dans le catalogue. '
        + 'Le créneau est laissé vide : à compléter à la main.',
    });
    return { exercise: null, substituted: false };
  };

  const days = template.days.map((day, i) => {
    const items = [];
    for (const slot of day.slots) {
      const { exercise, substituted } = pick(slot.pattern, day.title);
      if (!exercise) continue;
      used.add(exercise.id);
      items.push({ slot, exercise, substituted });
    }
    return {
      day_index: i + 1,
      title: day.title,
      focus: day.focus,
      items,
    };
  });

  return { days, substitutions, unresolved, profile: { key: equipmentProfile, ...profile } };
}
