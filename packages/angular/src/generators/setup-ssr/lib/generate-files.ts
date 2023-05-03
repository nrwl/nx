import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function generateSSRFiles(tree: Tree, schema: Schema) {
  const projectRoot = readProjectConfiguration(tree, schema.project).root;

  const pathToFiles = joinPathFragments(__dirname, '..', 'files');

  generateFiles(tree, joinPathFragments(pathToFiles, 'base'), projectRoot, {
    ...schema,
    tpl: '',
  });

  if (schema.standalone) {
    generateFiles(
      tree,
      joinPathFragments(pathToFiles, 'standalone'),
      projectRoot,
      { ...schema, tpl: '' }
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(pathToFiles, 'ngmodule', 'base'),
      projectRoot,
      { ...schema, tpl: '' }
    );

    const { major: angularMajorVersion, version: angularVersion } =
      getInstalledAngularVersionInfo(tree);

    if (angularMajorVersion < 15) {
      generateFiles(
        tree,
        joinPathFragments(pathToFiles, 'ngmodule', 'v14'),
        projectRoot,
        { ...schema, tpl: '' }
      );
    }
    if (lt(angularVersion, '15.2.0')) {
      generateFiles(
        tree,
        joinPathFragments(pathToFiles, 'ngmodule', 'pre-v15-2'),
        projectRoot,
        { ...schema, tpl: '' }
      );
    }
  }
}
