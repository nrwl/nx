import type { Tree } from '@nrwl/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nrwl/devkit';
import type { Schema } from '../schema';

export function generateSSRFiles(tree: Tree, schema: Schema) {
  const projectRoot = readProjectConfiguration(tree, schema.project).root;

  const pathToFiles = joinPathFragments(__dirname, '../', 'files');

  generateFiles(tree, pathToFiles, projectRoot, { ...schema, tpl: '' });
}
