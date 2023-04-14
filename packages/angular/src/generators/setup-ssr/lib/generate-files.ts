import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from '../schema';

export function generateSSRFiles(tree: Tree, schema: Schema) {
  const projectRoot = readProjectConfiguration(tree, schema.project).root;

  const pathToFiles = joinPathFragments(__dirname, '../', 'files');

  generateFiles(tree, pathToFiles, projectRoot, { ...schema, tpl: '' });
}
