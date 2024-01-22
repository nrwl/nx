import type { Tree } from '@nx/devkit';
import { formatFiles, GeneratorCallback } from '@nx/devkit';
import type { Schema } from './schema';
import {
  addExportsToBarrel,
  addImportsToModule,
  addNgRxToPackageJson,
  generateFilesFromTemplates,
  normalizeOptions,
  validateOptions,
} from './lib';

export async function ngrxFeatureStoreGenerator(tree: Tree, schema: Schema) {
  validateOptions(tree, schema);
  const options = normalizeOptions(tree, schema);

  if (!options.minimal) {
    generateFilesFromTemplates(tree, options);
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

export default ngrxFeatureStoreGenerator;
