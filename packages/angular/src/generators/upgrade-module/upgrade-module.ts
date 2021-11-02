import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { addUpgradeToPackageJson } from '../utils/upgrade';
import {
  addImportsToModule,
  createFiles,
  normalizeOptions,
  updateModuleBootstrap,
} from './lib';
import { UpgradeModuleGeneratorOptions } from './schema';

export async function upgradeModuleGenerator(
  tree: Tree,
  rawOptions: UpgradeModuleGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  createFiles(tree, options);
  addImportsToModule(tree, options);
  updateModuleBootstrap(tree, options);

  let installPackagesTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installPackagesTask = addUpgradeToPackageJson(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installPackagesTask;
}

export default upgradeModuleGenerator;
