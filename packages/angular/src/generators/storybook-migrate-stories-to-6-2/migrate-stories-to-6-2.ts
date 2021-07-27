import type { Tree } from '@nrwl/devkit';
import { migrateStoriesTo62Generator } from '@nrwl/storybook';

export async function angularMigrateStoriesTo62Generator(tree: Tree) {
  await migrateStoriesTo62Generator(tree);
}

export default angularMigrateStoriesTo62Generator;
