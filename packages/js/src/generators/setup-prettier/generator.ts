import {
  ensurePackage,
  formatFiles,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { generatePrettierSetup } from '../../utils/prettier';
import { prettierVersion } from '../../utils/versions';
import type { GeneratorOptions } from './schema';

export async function setupPrettierGenerator(
  tree: Tree,
  options: GeneratorOptions
): Promise<GeneratorCallback> {
  const prettierTask = generatePrettierSetup(tree, {
    skipPackageJson: options.skipPackageJson,
  });

  if (!options.skipPackageJson) {
    ensurePackage('prettier', prettierVersion);
  }

  if (!options.skipFormat) {
    // even if skipPackageJson === true, we can safely run formatFiles, prettier might
    // have been installed earlier and if not, the formatFiles function still handles it
    await formatFiles(tree);
  }

  return prettierTask;
}

export default setupPrettierGenerator;
