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
  schema: NgRxGeneratorOptions
): Promise<GeneratorCallback> {
  if (!schema.module && !schema.parent) {
    throw new Error('Please provide a value for `--parent`!');
  }

  if (schema.module && !tree.exists(schema.module)) {
    throw new Error(`Module does not exist: ${schema.module}.`);
  }

  if (schema.parent && !tree.exists(schema.parent)) {
    throw new Error(`Parent does not exist: ${schema.parent}.`);
  }

  const options = normalizeOptions(schema);

  if (!options.minimal || !options.root) {
    generateNgrxFilesFromTemplates(tree, options);
  }

  if (!options.skipImport) {
    addImportsToModule(tree, options);
    addExportsToBarrel(tree, options);
  }

  let packageInstallationTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    packageInstallationTask = addNgRxToPackageJson(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return packageInstallationTask;
}

export default ngrxGenerator;
