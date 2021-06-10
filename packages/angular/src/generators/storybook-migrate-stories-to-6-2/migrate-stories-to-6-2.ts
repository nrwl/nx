import type { Tree } from '@nrwl/devkit';
import type { migrateStoriesTo62Generator } from '@nrwl/storybook';

export async function angularMigrateStoriesTo62Generator(tree: Tree) {
  let storybookMigrateStoriesTo62Generator: typeof migrateStoriesTo62Generator;
  try {
    storybookMigrateStoriesTo62Generator = require('@nrwl/storybook')
      .migrateStoriesTo62Generator;
  } catch {
    throw new Error(
      `You don't have @nrwl/storybook installed. Please, install it before running this generator.`
    );
  }

  await storybookMigrateStoriesTo62Generator(tree);
}

export default angularMigrateStoriesTo62Generator;
