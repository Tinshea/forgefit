#!/usr/bin/env node
// Insère le catalogue de recettes.
//
//   npm run seed:recipes
//   npm run seed:recipes -- --check   (vérifie sans écrire)
//
// Idempotent : rejouable sans créer de doublons. Les ingrédients sont
// remplacés à chaque exécution, jamais fusionnés — une recette modifiée
// dans le fichier doit l'être en base, pas s'y ajouter.

import { pool, waitForDatabase, withTransaction } from '../db.js';
import { applySchemaUpdates } from '../db/schema-updates.js';
import { RECIPES, recipeStats } from '../services/recipe-catalogue.js';

const CHECK_ONLY = process.argv.includes('--check');

async function main() {
  await waitForDatabase();
  await applySchemaUpdates();

  // Résolution des ingrédients par NOM, sur le catalogue commun.
  const { rows: foods } = await pool.query(
    'SELECT id, name, reference_qty, unit FROM foods WHERE user_id IS NULL',
  );
  const byName = new Map(foods.map((f) => [f.name, f]));

  const missing = new Map();
  for (const recipe of RECIPES) {
    for (const [name] of recipe.ingredients) {
      if (!byName.has(name)) {
        if (!missing.has(name)) missing.set(name, []);
        missing.get(name).push(recipe.slug);
      }
    }
  }

  const stats = recipeStats();
  console.log(`[recettes] ${stats.total} recettes, ${stats.foods} ingrédients distincts`);
  for (const [meal, n] of Object.entries(stats.byMeal)) {
    console.log(`[recettes]   ${meal.padEnd(10)} ${n}`);
  }

  if (missing.size) {
    // Bloquant : une recette dont un ingrédient manque afficherait des
    // macros fausses sans le signaler. Mieux vaut ne rien insérer.
    console.error(`\n[recettes] ✖ ${missing.size} ingrédient(s) absent(s) du catalogue :`);
    for (const [name, slugs] of missing) {
      console.error(`  « ${name} » — utilisé par ${slugs.join(', ')}`);
    }
    console.error('\nAjoute-les au catalogue (npm run seed:foods) avant de rejouer.');
    process.exitCode = 1;
    return;
  }
  console.log('[recettes] tous les ingrédients sont résolus.');

  if (CHECK_ONLY) {
    console.log('[recettes] --check : aucune écriture.');
    return;
  }

  let written = 0;
  await withTransaction(async (client) => {
    for (const recipe of RECIPES) {
      const { rows: [row] } = await client.query(
        `INSERT INTO recipes
           (user_id, slug, name, meals, servings, prep_minutes, tags, steps, note, source)
         VALUES (NULL, $1, $2, $3::meal_slot[], $4, $5, $6::text[], $7::jsonb, $8, 'catalogue')
         ON CONFLICT (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug)
         DO UPDATE SET
           name = EXCLUDED.name, meals = EXCLUDED.meals, servings = EXCLUDED.servings,
           prep_minutes = EXCLUDED.prep_minutes, tags = EXCLUDED.tags,
           steps = EXCLUDED.steps, note = EXCLUDED.note
         RETURNING id`,
        [
          recipe.slug, recipe.name, recipe.meals, recipe.servings,
          recipe.prep_minutes ?? null, recipe.tags ?? [],
          JSON.stringify(recipe.steps ?? []), recipe.note ?? null,
        ],
      );

      // Remplacement intégral : une quantité modifiée dans le fichier
      // doit remplacer l'ancienne, pas coexister avec elle.
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [row.id]);

      let position = 1;
      for (const [name, quantity] of recipe.ingredients) {
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, food_id, quantity, position)
           VALUES ($1, $2, $3, $4)`,
          [row.id, byName.get(name).id, quantity, position],
        );
        position += 1;
      }
      written += 1;
    }
  });

  console.log(`[recettes] ${written} recettes enregistrées.`);

  // Relecture des macros calculées : c'est la vue qui fait foi, pas le
  // fichier. Une valeur aberrante se voit ici, pas en production.
  const { rows: sample } = await pool.query(
    `SELECT r.name, m.kcal, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g
       FROM recipes r JOIN recipe_macros m ON m.recipe_id = r.id
      WHERE r.user_id IS NULL
      ORDER BY m.kcal DESC`,
  );
  console.log('\n=== Macros par portion ===');
  for (const x of sample) {
    console.log(
      `  ${String(x.name).padEnd(42)} ${String(Math.round(x.kcal)).padStart(4)} kcal · `
      + `P ${String(Math.round(x.protein_g)).padStart(3)} · `
      + `G ${String(Math.round(x.carbs_g)).padStart(3)} · `
      + `L ${String(Math.round(x.fat_g)).padStart(3)} · `
      + `F ${String(Math.round(x.fiber_g)).padStart(2)}`,
    );
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[recettes] échec :', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
