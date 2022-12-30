import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { addUpgradeToPackageJson } from '../utils/upgrade';
import {
  addEntryComponentsToModule,
  normalizeOptions,
  updateModuleBootstrap,
  updateMain,
} from './lib';
import type { DowngradeModuleGeneratorOptions } from './schema';

export async function downgradeModuleGenerator(
  tree: Tree,
  rawOptions: DowngradeModuleGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  updateMain(tree, options);
  addEntryComponentsToModule(tree, options);
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

export default downgradeModuleGenerator;
