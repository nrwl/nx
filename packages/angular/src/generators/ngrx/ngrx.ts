import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import {
  addExportsToBarrel,
  addImportsToModule,
  addNgRxToPackageJson,
  generateNgrxFilesFromTemplates,
  normalizeOptions,
} from './lib';
import type { NgRxGeneratorOptions } from './schema';

export async function ngrxGenerator(
  tree: Tree,
  options: NgRxGeneratorOptions
): Promise<GeneratorCallback> {
  const normalizedOptions = normalizeOptions(options);

  if (!tree.exists(normalizedOptions.module)) {
    throw new Error(`Module does not exist: ${normalizedOptions.module}.`);
  }

  if (!normalizedOptions.minimal || !normalizedOptions.root) {
    generateNgrxFilesFromTemplates(tree, normalizedOptions);
  }

  if (!normalizedOptions.skipImport) {
    addImportsToModule(tree, normalizedOptions);
    addExportsToBarrel(tree, normalizedOptions);
  }

  let packageInstallationTask: GeneratorCallback = () => {};
  if (!normalizedOptions.skipPackageJson) {
    packageInstallationTask = addNgRxToPackageJson(tree);
  }

  if (!normalizedOptions.skipFormat) {
    await formatFiles(tree);
  }

  return packageInstallationTask;
}

export default ngrxGenerator;
