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

/**
 * L'identité de la COQUILLE, qui n'est celle d'aucun module.
 *
 * ┌─ POURQUOI CETTE DISTINCTION A SA PLACE ICI ───────────────────────┐
 * │ « ForgeFit » désignait à la fois l'application et son premier     │
 * │ module. L'en-tête affichait donc « ForgeFit » y compris à         │
 * │ l'intérieur du Carnet, qui n'a rien à voir — et le hub, qui n'est │
 * │ au-dessus de rien de particulier, portait la marque d'un seul de  │
 * │ ses quatre domaines.                                              │
 * │                                                                    │
 * │ Atlas est la coquille. ForgeFit est ce qui occupe « Corps ».      │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const APP = {
  name: 'Atlas',
  tagline: 'Quatre domaines, un recueil',
};

export const MODULES = [
  {
    key: 'forgefit',
    label: 'ForgeFit',
    // Le domaine du hub auquel ce module appartient. Voir
    // `constellations.js` : les quatre domaines existent d'abord, les
    // modules viennent s'y loger.
    category: 'corps',
    glyph: 'halterophile',
    tagline: 'Entraînement, nutrition, santé',
    // Le lettrage en deux tons est la marque de CE module. Un module
    // sans `brandParts` voit simplement son libellé s'afficher.
    brandParts: ['Forge', 'Fit'],
    // Le bandeau de date affiche l'avancement dans le CYCLE
    // D'ENTRAÎNEMENT — « Semaine 3 / 4 », la séance du jour. C'est du
    // contenu de ce module : il s'affichait jusque dans le Carnet, où
    // il ne veut rien dire. Un module qui ne le réclame pas ne voit
    // que la date.
    showsProgram: true,
    sections: [
      {
        key: 'entrainement',
        label: 'Entraînement',
        icon: '🏋️',
        glyph: 'halterophile',
        pages: [
          { key: 'coach', label: 'Aujourd’hui', hint: 'Ce qu’il y a à faire, et pourquoi' },
          { key: 'seance', label: 'Séance', hint: 'Enregistrer une séance en cours' },
          { key: 'sports', label: 'Sports', hint: 'Toutes disciplines : enregistrer et suivre la charge' },
          { key: 'syllabus', label: 'Syllabus', hint: 'Ton programme de grade, et ce que tu tiens déjà' },
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
          { key: 'recettes', label: 'Recettes', hint: 'Quoi cuisiner, avec macros, temps et prix' },
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
    category: 'savoir',
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
      // `hub` est l'adresse du tableau d'étoiles (`#/hub`). Une section
      // ainsi nommée serait analysée comme le hub et ne s'ouvrirait
      // jamais — une panne muette, que rien d'autre ne signalerait.
      if (section.key === 'hub') {
        problems.push(`section « hub » dans ${mod.key} : ce nom est réservé à la route du hub`);
      }
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
