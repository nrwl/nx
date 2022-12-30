import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  Tree,
} from '@nrwl/devkit';
import { Schema } from './schema';
import { esbuildVersion } from '@nrwl/js/src/utils/versions';

export async function esbuildInitGenerator(tree: Tree, schema: Schema) {
  const task = addDependenciesToPackageJson(
    tree,
    {},
    {
      esbuild: esbuildVersion,
    }
  );

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default esbuildInitGenerator;

export const esbuildInitSchematic = convertNxGenerator(esbuildInitGenerator);
