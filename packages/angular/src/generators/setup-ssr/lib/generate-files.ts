import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import {
  getInstalledAngularMajorVersion,
  getInstalledAngularVersionInfo,
} from '../../utils/version-utils';
import type { Schema } from '../schema';
import { lt } from 'semver';

export function generateSSRFiles(tree: Tree, schema: Schema) {
  const projectRoot = readProjectConfiguration(tree, schema.project).root;

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'base'),
    projectRoot,
    { ...schema, tpl: '' }
  );

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 15) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'v14'),
      projectRoot,
      { ...schema, tpl: '' }
    );
  }

  if (lt(angularVersion, '15.2.0')) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'pre-v15-2'),
      projectRoot,
      { ...schema, tpl: '' }
    );
  }
}
