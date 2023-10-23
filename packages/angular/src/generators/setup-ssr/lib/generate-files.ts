import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';
import { join } from 'path';

export function generateSSRFiles(tree: Tree, schema: Schema) {
  const projectConfig = readProjectConfiguration(tree, schema.project);
  const projectRoot = projectConfig.root;
  const browserBundleOutputPath =
    projectConfig.targets.build.options.outputPath;

  const pathToFiles = joinPathFragments(__dirname, '..', 'files');

  generateFiles(tree, join(pathToFiles, 'base'), projectRoot, {
    ...schema,
    tpl: '',
  });

  if (schema.standalone) {
    generateFiles(
      tree,
      joinPathFragments(pathToFiles, 'standalone'),
      projectRoot,

      { ...schema, browserBundleOutputPath, tpl: '' }
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(pathToFiles, 'ngmodule', 'base'),
      projectRoot,

      { ...schema, browserBundleOutputPath, tpl: '' }
    );

    const { version: angularVersion } = getInstalledAngularVersionInfo(tree);

    if (lt(angularVersion, '15.2.0')) {
      generateFiles(
        tree,
        joinPathFragments(pathToFiles, 'ngmodule', 'pre-v15-2'),
        projectRoot,

        { ...schema, browserBundleOutputPath, tpl: '' }
      );
    }
  }
}
