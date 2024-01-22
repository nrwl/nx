import type { Tree } from '@nx/devkit';
import { migrateFromAngularCli } from './migrate-from-angular-cli';
import type { GeneratorOptions } from './schema';

export async function ngAddGenerator(tree: Tree, options: GeneratorOptions) {
  return await migrateFromAngularCli(tree, options);
}

export default ngAddGenerator;
