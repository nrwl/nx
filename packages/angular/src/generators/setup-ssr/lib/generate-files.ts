import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { getInstalledAngularMajorVersion } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function generateSSRFiles(tree: Tree, schema: Schema) {
  const projectRoot = readProjectConfiguration(tree, schema.project).root;

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'base'),
    projectRoot,
    { ...schema, tpl: '' }
  );

  const angularMajorVersion = getInstalledAngularMajorVersion(tree);
  if (angularMajorVersion < 15) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'v14'),
      projectRoot,
      { ...schema, tpl: '' }
    );
  }
}
