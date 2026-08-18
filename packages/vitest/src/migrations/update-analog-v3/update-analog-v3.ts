import { formatFiles, Tree, globAsync, logger } from '@nx/devkit';

/**
 * Rewrites Analog 3.x removed `@analogjs/vite-plugin-angular/setup-vitest`
 * imports. Package pins are owned by the `23.2.0-analog-v3` packageJsonUpdates
 * group, not this generator.
 */
export default async function updateAnalogV3(tree: Tree) {
  let updated = false;

  const configFiles = await globAsync(tree, [
    '**/vitest.config.*',
    '**/vite.config.*',
    '**/test-setup.ts',
    '**/setup-test.ts',
  ]);

  for (const filePath of configFiles) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    const next = content.replace(
      /@analogjs\/vite-plugin-angular\/setup-vitest/g,
      '@analogjs/vitest-angular'
    );

    if (next !== content) {
      tree.write(filePath, next);
      updated = true;
      logger.info(`Updated Analog imports in ${filePath}`);
    }
  }

  if (updated) {
    await formatFiles(tree);
  }
}
