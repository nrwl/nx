import type { GeneratorCallback, Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import {
  addExportsToBarrel,
  addImportsToModule,
  addNgRxToPackageJson,
  generateNgrxFilesFromTemplates,
  normalizeOptions,
  validateOptions,
} from './lib';
import type { NgRxGeneratorOptions } from './schema';

export async function ngrxGenerator(
  tree: Tree,
  schema: NgRxGeneratorOptions
): Promise<GeneratorCallback> {
  validateOptions(tree, schema);
  const options = normalizeOptions(tree, schema);

  if (!options.minimal || !options.root) {
    generateNgrxFilesFromTemplates(tree, options);
  }

  if (!options.skipImport) {
    addImportsToModule(tree, options);
    addExportsToBarrel(tree, options);
  }

  let packageInstallationTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    packageInstallationTask = addNgRxToPackageJson(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return packageInstallationTask;
}

export default ngrxGenerator;
