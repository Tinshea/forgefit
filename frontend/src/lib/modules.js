// Registre des modules — DONNÉES PURES.
//
// ┌─ CE QUE « MODULE » VEUT DIRE ICI ─────────────────────────────────┐
// │ ForgeFit n'est pas l'application : c'est le PREMIER MODULE d'une  │
// │ coquille qui peut en héberger plusieurs. Une bibliothèque, un     │
// │ carnet, ce qu'on voudra : chacun apporte ses propres sections, et │
// │ le téléphone sert à passer de l'un à l'autre.                     │
// │                                                                    │
// │ La barre du haut n'affiche que les sections du module COURANT.    │
// │ Avec un seul module, c'est exactement l'interface actuelle ; avec │
// │ deux, la barre change en passant de l'un à l'autre — et c'est ce  │
// │ qui donne la sensation de changer d'application sans quitter la   │
// │ coquille.                                                          │
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ AJOUTER UN MODULE ───────────────────────────────────────────────┐
// │ 1. décrire ses sections ici, avec des clés de section et de page  │
// │    UNIQUES dans toute l'application — l'URL reste `#/section/page`│
// │    et ne connaît pas les modules ;                                │
// │ 2. câbler chaque page dans `PAGES`, côté App.jsx ;                │
// │ 3. c'est tout. La navigation, le téléphone et le contrôle         │
// │    d'écrans se mettent à jour d'eux-mêmes.                        │
// │                                                                    │
// │ Aucun module fictif n'est déclaré : une tuile qui n'ouvre rien    │
// │ serait une promesse, pas une fonctionnalité.                      │
// └────────────────────────────────────────────────────────────────────┘

export const MODULES = [
  {
    key: 'forgefit',
    label: 'ForgeFit',
    glyph: 'halterophile',
    tagline: 'Entraînement, nutrition, santé',
    sections: [
      {
        key: 'entrainement',
        label: 'Entraînement',
        icon: '🏋️',
        glyph: 'halterophile',
        pages: [
          { key: 'seance', label: 'Séance', hint: 'Enregistrer une séance en cours' },
          { key: 'sports', label: 'Sports', hint: 'Toutes disciplines : enregistrer et suivre la charge' },
          { key: 'calendrier', label: 'Calendrier', hint: 'Séances prévues, séances faites' },
          { key: 'programme', label: 'Programme', hint: 'Modèles, générateur et construction à la main' },
          { key: 'exercices', label: 'Exercices', hint: 'Catalogue classé, muscles sollicités et exécution' },
        ],
      },
      {
        key: 'nutrition',
        label: 'Nutrition',
        icon: '🍽️',
        glyph: 'assiette',
        pages: [
          { key: 'journal', label: 'Journal', hint: 'Repas du jour et macros restantes' },
          { key: 'aliments', label: 'Aliments', hint: 'Catalogue, macros et prix' },
        ],
      },
      {
        key: 'progression',
        label: 'Progression',
        icon: '📈',
        glyph: 'courbe',
        pages: [
          { key: 'apercu', label: 'Aperçu', hint: 'Radar, charge musculaire et readiness' },
          { key: 'niveau', label: 'Niveau', hint: 'Progression, distinctions et charge par discipline' },
          { key: 'tendances', label: 'Tendances', hint: 'Courbes de composition, calories et volume' },
          { key: 'benchmark', label: 'Benchmark', hint: 'Paliers de force et charge du palier suivant' },
          { key: 'sante', label: 'Santé', hint: 'Sommeil, VFC, pas — depuis tes capteurs' },
        ],
      },
      {
        key: 'profil',
        label: 'Profil',
        icon: '⚙️',
        glyph: 'reglage',
        pages: [
          { key: 'profil', label: 'Profil', hint: 'Mesures, objectifs et méthode de calcul' },
        ],
      },
    ],
  },

  // ┌─ MODULE DE TEST ────────────────────────────────────────────────┐
  // │ Volontairement SANS RAPPORT avec l'entraînement. Une coquille   │
  // │ modulaire qui n'héberge qu'un module ne prouve rien : on ne     │
  // │ découvre ce qui était réellement couplé qu'en en ajoutant un    │
  // │ second.                                                          │
  // │                                                                  │
  // │ Il apporte sa section, sa table et sa route sans qu'une ligne   │
  // │ de ForgeFit change. Il se retire en supprimant cette entrée,    │
  // │ `pages/NotesPage.jsx`, `routes/notes.js` et sa table.           │
  // └──────────────────────────────────────────────────────────────────┘
  {
    key: 'carnet',
    label: 'Carnet',
    glyph: 'livre',
    tagline: 'Notes — module de test',
    sections: [
      {
        key: 'carnet',
        label: 'Carnet',
        icon: '📓',
        glyph: 'livre',
        pages: [
          { key: 'notes', label: 'Notes', hint: 'Banc d’essai de l’architecture modulaire' },
        ],
      },
    ],
  },
];

/** Toutes les sections, tous modules confondus. */
export const ALL_SECTIONS = MODULES.flatMap((m) => m.sections);

/** Le module qui possède une section donnée. */
export function moduleOf(sectionKey) {
  return MODULES.find((m) => m.sections.some((s) => s.key === sectionKey)) ?? MODULES[0];
}

/**
 * Vérifie l'unicité des clés.
 *
 * L'URL ne connaît pas les modules : deux sections homonymes dans deux
 * modules différents produiraient la même adresse, et l'une des deux
 * deviendrait inatteignable. Le contrôle vit ici pour que
 * `npm run check:nav` l'exécute sans navigateur.
 */
export function keyCollisions() {
  const problems = [];
  const sections = new Map();
  const pages = new Map();

  for (const mod of MODULES) {
    for (const section of mod.sections) {
      if (sections.has(section.key)) {
        problems.push(`section « ${section.key} » déclarée par ${sections.get(section.key)} et ${mod.key}`);
      }
      sections.set(section.key, mod.key);

      for (const page of section.pages) {
        if (pages.has(page.key)) {
          problems.push(`page « ${page.key} » déclarée par ${pages.get(page.key)} et ${section.key}`);
        }
        pages.set(page.key, section.key);
      }
    }
  }
  return problems;
}
