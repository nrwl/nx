import type { Tree } from '@nx/devkit';
import { assertSupportedAngularVersion } from '../../utils/assert-supported-angular-version';
import { migrateFromAngularCli } from './migrate-from-angular-cli';
import type { GeneratorOptions } from './schema';

export async function ngAddGenerator(tree: Tree, options: GeneratorOptions) {
  assertSupportedAngularVersion(tree);
  return await migrateFromAngularCli(tree, options);
}

export default ngAddGenerator;
