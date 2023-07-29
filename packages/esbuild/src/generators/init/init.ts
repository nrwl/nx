import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  Tree,
} from '@nx/devkit';
import { Schema } from './schema';
import { esbuildVersion } from '@nx/js/src/utils/versions';
import { nxVersion } from '../../utils/versions';

export async function esbuildInitGenerator(tree: Tree, schema: Schema) {
  const task = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/esbuild': nxVersion,
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
