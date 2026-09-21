#!/usr/bin/env node
// Catalogue d'aliments — repris du tableur de l'utilisateur.
//
//   npm run seed:foods
//   npm run seed:foods -- --check   (contrôle de cohérence seul)
//
// Chaque ligne porte : quantité de référence, kcal, lipides, glucides,
// protéines, fibres, et PRIX.
//
// Les fibres sont exprimées POUR LA QUANTITÉ DE RÉFÉRENCE, pas
// systématiquement pour 100 g : une barre de céréales de 25 g porte ses
// fibres pour 25 g. Valeurs manquantes complétées depuis la table de
// composition CIQUAL (ANSES). Elles comptent : les fibres sont une
// fraction des glucides, et les laisser à zéro surestimait l'énergie
// disponible de ces aliments. Le prix est ce qui distingue ce catalogue
// des bases publiques — c'est une donnée personnelle, liée aux magasins
// où l'on fait ses courses.
//
// Idempotent : rejouable sans créer de doublons.

import { pool, withTransaction, waitForDatabase } from '../db.js';
import { validateFoodCoherence } from '../services/nutrition.js';

const CHECK_ONLY = process.argv.includes('--check');

// [nom, qtéRéf, kcal, lipides, glucides, protéines, fibres, prix€, catégorie]
const FOODS = [
  // --- Féculents et céréales ---
  ['Torti blé complet', 100, 350, 2.3, 65, 13.4, 6, 0.202, 'feculents'],
  ['Spaghetti complètes', 100, 349, 2.3, 65, 13.4, 6, 0.202, 'feculents'],
  ['Pâtes blanches cuites', 100, 158, 0.9, 31, 5, 1.8, 0.15, 'feculents'],
  ['Riz blanc cuit', 100, 130, 0.3, 28, 2.7, 0.4, 0.15, 'feculents'],
  ['Riz complet cuit', 100, 123, 1, 23, 2.7, 1.8, 0.2, 'feculents'],
  ['Couscous cuit', 100, 112, 0.2, 23, 3.8, 1.4, 0.2, 'feculents'],
  ['Quinoa cuit', 100, 120, 1.9, 21, 4.4, 2.8, 0.8, 'feculents'],
  ['Pain complet', 100, 247, 3.4, 41, 13, 7, 0.3, 'feculents'],
  ['Pain de mie complet', 100, 236, 3.4, 37, 11, 7, null, 'feculents'],
  ['Flocons d’avoine', 100, 379, 6.9, 67, 13, 10, 0.35, 'feculents'],
  ['Pomme de terre cuite', 100, 87, 0.1, 20, 1.9, 2, 0.1, 'feculents'],
  ['Patate douce cuite', 100, 90, 0.1, 21, 1.6, 3, 0.3, 'feculents'],
  ['Lentilles cuites', 100, 116, 0.4, 20, 9, 7.9, 0.4, 'feculents'],
  ['Pois chiches cuits', 100, 164, 2.6, 27, 8.9, 7.6, 0.4, 'feculents'],
  ['Wrap tortilla', 60, 195, 5, 30, 6, 1.5, 0.4, 'feculents'],
  ['Galette de riz', 9, 35, 0.2, 7.4, 0.8, 1.5, 0.05, 'feculents'],

  // --- Viandes, poissons, œufs ---
  ['Blanc de poulet', 100, 110, 1.2, 0, 23, 0, 0.6, 'proteines'],
  ['Cuisse de poulet', 100, 173, 9.5, 0, 21, 0, 0.8, 'proteines'],
  ['Filet de dinde', 100, 110, 1.1, 0, 24, 0, 1.3, 'proteines'],
  ['Steak haché 5 %', 100, 130, 5, 0, 21, 0, 1.5, 'proteines'],
  ['Steak haché 15 %', 100, 220, 15, 0, 20, 0, 1, 'proteines'],
  ['Côte de porc', 100, 196, 11, 0, 23, 0, 1.1, 'proteines'],
  ['Jambon blanc', 100, 110, 3, 0.5, 21, 0, 1.2, 'proteines'],
  ['Bresaola', 100, 152, 2.5, 0, 33, 0, 4.5, 'proteines'],
  ['Saumon', 100, 208, 13, 0, 20, 0, 2.5, 'proteines'],
  ['Thon au naturel', 100, 116, 1, 0, 26, 0, 1.8, 'proteines'],
  ['Cabillaud', 100, 82, 0.7, 0, 18, 0, 2, 'proteines'],
  ['Sardines à l’huile', 100, 220, 14, 0, 24, 0, 1.5, 'proteines'],
  ['Crevettes décortiquées', 100, 99, 1.5, 0.2, 21, 0, 3, 'proteines'],
  ['Œuf entier', 50, 78, 5, 0.6, 6, 0, 0.25, 'proteines'],
  ['Blanc d’œuf', 30, 16, 0, 0, 3.6, 0, 0.1, 'proteines'],
  ['Tofu nature', 100, 76, 4.8, 1.9, 8, 0, 1.2, 'proteines'],

  // --- Produits laitiers ---
  ['Skyr nature', 100, 60, 0.2, 4, 10, 0, 0.5, 'laitiers'],
  ['Fromage blanc 0 %', 100, 45, 0.1, 4, 8, 0, 0.3, 'laitiers'],
  ['Yaourt grec 0 %', 100, 59, 0, 4, 10, 0, 0.45, 'laitiers'],
  ['Lait demi-écrémé', 100, 46, 1.5, 4.8, 3.2, 0, 0.1, 'laitiers'],
  ['Lait d’amande sans sucre', 100, 17, 1.1, 1.4, 0.4, 0, 0.25, 'laitiers'],
  ['Comté', 100, 408, 34, 0.5, 28, 0, 2.5, 'laitiers'],
  ['Parmesan', 100, 400, 30, 0, 35, 0, 5, 'laitiers'],
  ['Mozzarella light', 100, 200, 12, 1, 22, 0, 1.2, 'laitiers'],

  // --- Légumes ---
  ['Brocoli', 100, 34, 0.4, 7, 2.8, 2.6, 0.3, 'legumes'],
  ['Carotte', 100, 41, 0.2, 10, 0.9, 2.8, 0.15, 'legumes'],
  ['Tomate', 100, 18, 0.2, 3.9, 0.9, 1.2, 0.25, 'legumes'],
  ['Courgette', 100, 17, 0.3, 3, 1.2, 1, 0.2, 'legumes'],
  // "pinards" dans le tableur — coquille manifeste.
  ['Épinards', 100, 23, 0.4, 3.6, 2.9, 2.2, 0.4, 'legumes'],
  ['Haricots verts', 100, 31, 0.2, 7, 1.8, 2.7, 0.3, 'legumes'],
  ['Concombre', 100, 16, 0.1, 3.6, 0.7, 0.5, 0.15, 'legumes'],
  ['Champignons', 100, 22, 0.3, 3.3, 3.1, 1.0, 0.3, 'legumes'],
  ['Avocat', 100, 160, 15, 9, 2, 7, 1, 'legumes'],
  ['Soupe 10 légumes', 100, 25, 0.5, 4, 1, 1.5, 0.4, 'legumes'],

  // --- Fruits ---
  ['Banane', 100, 89, 0.3, 23, 1.1, 2.6, 0.15, 'fruits'],
  // Le tableur libellait cette ligne "Pomme de terre cuite" en double ;
  // 52 kcal et 14 g de glucides correspondent à une POMME.
  ['Pomme', 100, 52, 0.2, 14, 0.3, 2, 0.2, 'fruits'],
  ['Orange', 100, 47, 0.1, 12, 0.9, 2.4, 0.15, 'fruits'],
  ['Fraises', 100, 32, 0.3, 8, 0.7, 2.0, 0.4, 'fruits'],
  ['Kiwi', 100, 61, 0.5, 15, 1.1, 2.1, 0.3, 'fruits'],
  ['Myrtilles', 100, 60, 0.5, 12, 0.6, 2.4, 1.042, 'fruits'],
  ['Fruits rouges', 100, 50, 0.5, 8, 1, 5, 1.5, 'fruits'],
  ['Compote sans sucre', 100, 50, 0.1, 12, 0.3, 1.3, 0.3, 'fruits'],

  // --- Matières grasses, oléagineux ---
  ['Huile d’olive', 100, 884, 100, 0, 0, 0, 0.8, 'matieres_grasses'],
  ['Huile de colza', 100, 884, 100, 0, 0, 0, 0.3, 'matieres_grasses'],
  ['Amandes', 100, 579, 50, 22, 21, 12, 1.8, 'matieres_grasses'],
  ['Beurre de cacahuète', 100, 588, 50, 20, 25, 0, 0.8, 'matieres_grasses'],

  // --- Compléments ---
  ['Whey protéine (dose)', 30, 117, 1.8, 3, 24, 0, 1.5, 'complements'],
  ['Psyllium', 100, 200, 0.5, 77.3, 4.6, 77.3, null, 'complements'],
  // Glucides relevés à 0,81 g : le tableur indiquait 0,5 g pour 0,53 g
  // de fibres, or les fibres sont une fraction des glucides.
  ['Cannelle', 1, 2, 0, 0.81, 0, 0.53, 0.02, 'complements'],

  // --- Sauces et condiments ---
  ['Mayonnaise', 100, 680, 75, 1.4, 1.1, 0, 0.5, 'condiments'],
  ['Ketchup', 100, 112, 0.1, 27, 1.3, 1.0, 0.3, 'condiments'],
  ['Moutarde', 100, 66, 4, 5, 4.4, 3.3, 0.4, 'condiments'],
  ['Sauce soja', 100, 53, 0, 5, 8, 0.8, 0.8, 'condiments'],
  ['Vinaigrette', 100, 450, 50, 0, 0, 0, 0.4, 'condiments'],
  ['Hummus', 100, 230, 14, 18, 7, 5.4, 0.8, 'condiments'],

  // --- Plats préparés ---
  ['Pizza margherita', 100, 270, 11, 33, 11, 2.3, 0.6, 'plats'],
  ['Hamburger maison', 200, 540, 27, 40, 30, 4.0, 1.8, 'plats'],
  ['Sandwich jambon-beurre', 150, 380, 12, 50, 17, 3.8, 1.5, 'plats'],
  ['Sushi saumon (1 pièce)', 30, 50, 1, 8, 2, 0.2, 0.4, 'plats'],

  // --- Plaisirs ---
  ['Cookie chocolat', 15, 73, 3.8, 9, 0.8, 0.4, 0.4, 'plaisirs'],
  // Fibres à 11 pour 10 g dans le tableur : ce serait 110 g/100 g,
  // impossible. Valeur corrigée sur la teneur réelle du chocolat noir.
  ['Chocolat noir 70 %', 10, 60, 4.3, 4.4, 1, 1.1, 0.25, 'plaisirs'],
  ['Chocolat au lait', 10, 53, 3, 5.7, 0.8, 0.34, 0.2, 'plaisirs'],
  ['Petit Beurre LU', 8, 35, 1, 6, 0.6, 0.2, 0.05, 'plaisirs'],
  ['Barre céréales', 25, 95, 2, 17, 1.8, 1.0, 0.4, 'plaisirs'],
  ['Glace vanille', 100, 207, 11, 24, 3.5, 0.7, 0.8, 'plaisirs'],
  ['Coca-Cola', 100, 42, 0, 10.6, 0, 0, 0.12, 'boissons'],
  ['Coca-Cola Zero', 100, 0.3, 0, 0, 0, 0, 0.12, 'boissons'],
];

/**
 * Mise à jour EN PLACE, sur le nom.
 *
 * L'identifiant d'un aliment ne doit jamais changer : les recettes le
 * référencent, et les lignes du journal alimentaire y sont rattachées.
 * Supprimer puis réinsérer cassait les premières et détachait
 * silencieusement les secondes.
 */
const UPSERT = `
  INSERT INTO foods
    (user_id, name, source, reference_qty, unit,
     kcal, fat_g, carbs_g, protein_g, fiber_g, price_eur, category)
  VALUES (NULL, $1, 'seed', $2, 'g', $3, $4, $5, $6, $7, $8, $9::food_category)
  ON CONFLICT (name) WHERE user_id IS NULL AND source = 'seed'
  DO UPDATE SET
    reference_qty = EXCLUDED.reference_qty,
    kcal          = EXCLUDED.kcal,
    fat_g         = EXCLUDED.fat_g,
    carbs_g       = EXCLUDED.carbs_g,
    protein_g     = EXCLUDED.protein_g,
    fiber_g       = EXCLUDED.fiber_g,
    price_eur     = EXCLUDED.price_eur,
    category      = EXCLUDED.category,
    updated_at    = now()
`;

function report() {
  console.log(`\n=== Contrôle de cohérence (${FOODS.length} aliments) ===`);
  console.log('Les calories déclarées doivent correspondre aux macros à ±15 %.\n');

  let flagged = 0;
  for (const [name, qty, kcal, fat, carbs, protein, fiber] of FOODS) {
    const v = validateFoodCoherence({
      kcal, fat_g: fat, carbs_g: carbs, protein_g: protein, fiber_g: fiber,
    });
    if (!v.ok) {
      flagged += 1;
      // Surestimer l'énergie d'un aliment dont les fibres sont à zéro
      // désigne presque toujours la même cause : la teneur en fibres
      // n'a pas été renseignée, et ces glucides sont comptés comme
      // assimilables alors qu'ils ne le sont pas.
      const hint = fiber === 0 && v.computed > v.declared
        ? '  → fibres non renseignées ?'
        : '';
      console.log(`  ${name.padEnd(24)} ${v.message}${hint}`);
    }
    void qty;
  }
  console.log(flagged
    ? `\n${flagged} anomalie(s). Les données du tableur sont conservées telles `
      + 'quelles : ce sont tes valeurs, à toi de trancher.'
    : '\nAucune anomalie.');
}

async function main() {
  report();
  if (CHECK_ONLY) return;

  await waitForDatabase();

  // Le catalogue commun est mis à jour en place. Les aliments
  // personnels (user_id renseigné) ne sont jamais touchés.
  const result = await withTransaction(async (client) => {
    let n = 0;
    for (const [name, qty, kcal, fat, carbs, protein, fiber, price, category] of FOODS) {
      await client.query(UPSERT, [
        name, qty, kcal, fat, carbs, protein, fiber, price, category ?? 'autre',
      ]);
      n += 1;
    }

    // Retrait des aliments disparus de la liste — mais seulement s'ils
    // ne sont référencés nulle part. Un aliment utilisé par une recette
    // ou présent dans le journal est CONSERVÉ et signalé : le supprimer
    // effacerait de l'historique.
    const { rows: stale } = await client.query(
      `SELECT f.id, f.name,
              EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.food_id = f.id) AS in_recipe,
              EXISTS (SELECT 1 FROM food_entries fe WHERE fe.food_id = f.id) AS in_journal
         FROM foods f
        WHERE f.user_id IS NULL AND f.source = 'seed' AND f.name <> ALL($1::text[])`,
      [FOODS.map(([name]) => name)],
    );

    const removable = stale.filter((x) => !x.in_recipe && !x.in_journal);
    const kept = stale.filter((x) => x.in_recipe || x.in_journal);

    if (removable.length) {
      await client.query('DELETE FROM foods WHERE id = ANY($1::uuid[])',
        [removable.map((x) => x.id)]);
    }

    return { written: n, removed: removable.length, kept };
  });

  console.log(`\n[seed:foods] ${result.written} aliments mis à jour dans le catalogue commun.`);
  if (result.removed) console.log(`[seed:foods] ${result.removed} aliment(s) obsolète(s) retiré(s).`);
  for (const x of result.kept) {
    console.warn(
      `[seed:foods] ⚠ « ${x.name} » ne figure plus dans la liste mais reste utilisé `
      + `${x.in_recipe ? 'par une recette' : ''}`
      + `${x.in_recipe && x.in_journal ? ' et ' : ''}`
      + `${x.in_journal ? 'dans le journal' : ''} : conservé.`,
    );
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[seed:foods] échec :', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
