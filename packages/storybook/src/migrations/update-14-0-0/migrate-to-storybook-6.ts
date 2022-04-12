import { Tree } from '@nrwl/devkit';
import { migrateDefaultsGenerator } from './migrate-defaults-5-to-6/migrate-defaults-5-to-6';
import { migrateStoriesTo62Generator } from './migrate-stories-to-6-2/migrate-stories-to-6-2';

export default async function migrateToStorybook6(tree: Tree) {
  migrateStoriesTo62Generator(tree);
  return migrateDefaultsGenerator(tree);
}
