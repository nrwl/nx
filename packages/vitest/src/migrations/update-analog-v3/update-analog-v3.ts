import { formatFiles, Tree, updateJson, globAsync, logger } from '@nx/devkit';

/**
 * Migration for AnalogJS 3.x breaking changes.
 *
 * Analog 3.0 restructured its module exports:
 * - `@analogjs/vite-plugin-angular/setup-vitest` was removed
 * - Setup imports now come from `@analogjs/vitest-angular` subpaths
 *
 * This migration:
 * 1. Bumps @analogjs/vitest-angular and @analogjs/vite-plugin-angular to ~3.0.0
 * 2. Replaces deprecated import paths in setup files and configs
 */
export default async function updateAnalogV3(tree: Tree) {
  let updated = false;

  // 1. Update package.json versions
  if (tree.exists('package.json')) {
    updateJson(tree, 'package.json', (json) => {
      let changed = false;
      if (json.devDependencies?.['@analogjs/vitest-angular']) {
        json.devDependencies['@analogjs/vitest-angular'] = '~3.0.0';
        changed = true;
      }
      if (json.devDependencies?.['@analogjs/vite-plugin-angular']) {
        json.devDependencies['@analogjs/vite-plugin-angular'] = '~3.0.0';
        changed = true;
      }
      if (json.dependencies?.['@analogjs/vitest-angular']) {
        json.dependencies['@analogjs/vitest-angular'] = '~3.0.0';
        changed = true;
      }
      if (json.dependencies?.['@analogjs/vite-plugin-angular']) {
        json.dependencies['@analogjs/vite-plugin-angular'] = '~3.0.0';
        changed = true;
      }
      if (changed) {
        updated = true;
      }
      return json;
    });
  }

  // 2. Update deprecated import paths in config and setup files
  const configFiles = await globAsync(tree, [
    '**/vitest.config.*',
    '**/vite.config.*',
    '**/test-setup.ts',
    '**/setup-test.ts',
  ]);

  for (const filePath of configFiles) {
    let content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    const original = content;

    // Replace deprecated setup-vitest import
    content = content.replace(
      /@analogjs\/vite-plugin-angular\/setup-vitest/g,
      '@analogjs/vitest-angular'
    );

    if (content !== original) {
      tree.write(filePath, content);
      updated = true;
      logger.info(`Updated Analog imports in ${filePath}`);
    }
  }

  if (updated) {
    await formatFiles(tree);
    logger.info(
      'AnalogJS packages updated to v3. Run `npm install` or `pnpm install` to apply.'
    );
  }
}
