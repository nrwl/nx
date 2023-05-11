import type { Tree } from '@nx/devkit';
import { formatFiles, GeneratorCallback } from '@nx/devkit';
import type { Schema } from './schema';

import {
  addImportsToModule,
  addNgRxToPackageJson,
  normalizeOptions,
  validateOptions,
} from './lib';

import ngrxFeatureStoreGenerator from '../ngrx-feature-store/ngrx-feature-store';

export async function ngrxRootStoreGenerator(tree: Tree, schema: Schema) {
  validateOptions(tree, schema);
  const options = normalizeOptions(tree, schema);

  if (!options.skipImport) {
    addImportsToModule(tree, options);
  }

  if (!options.minimal) {
    await ngrxFeatureStoreGenerator(tree, {
      name: options.name,
      parent: options.parent,
      directory: options.directory,
      minimal: false,
      facade: options.facade,
      barrels: false,
      skipImport: false,
      skipPackageJson: true,
      skipFormat: true,
    });
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

export default ngrxRootStoreGenerator;
