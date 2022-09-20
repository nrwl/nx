import { convertNxGenerator, formatFiles, Tree } from '@nrwl/devkit';
import { Schema } from './schema';

export async function esbuildInitGenerator(tree: Tree, schema: Schema) {
  /*
   * Empty for now, might need to add setup files later.
   */
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default esbuildInitGenerator;

export const esbuildInitSchematic = convertNxGenerator(esbuildInitGenerator);
