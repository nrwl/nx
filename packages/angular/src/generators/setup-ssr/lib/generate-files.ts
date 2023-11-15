import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function generateSSRFiles(
  tree: Tree,
  schema: Schema,
  isUsingApplicationBuilder: boolean
) {
  const { root: projectRoot, targets } = readProjectConfiguration(
    tree,
    schema.project
  );
  const baseOutputPath = targets.build.options.outputPath;
  const browserBundleOutputPath = joinPathFragments(baseOutputPath, 'browser');

  const pathToFiles = joinPathFragments(__dirname, '..', 'files');
  const { version: angularVersion, major: angularMajorVersion } =
    getInstalledAngularVersionInfo(tree);

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

    if (lt(angularVersion, '15.2.0')) {
      generateFiles(
        tree,
        joinPathFragments(pathToFiles, 'ngmodule', 'pre-v15-2'),
        projectRoot,
        { ...schema, browserBundleOutputPath, tpl: '' }
      );
    }
  }

  generateFiles(
    tree,
    joinPathFragments(
      pathToFiles,
      'server',
      ...(isUsingApplicationBuilder
        ? ['application-builder']
        : angularMajorVersion >= 17
        ? ['server-builder', 'v17+']
        : ['server-builder', 'pre-v17'])
    ),
    projectRoot,
    { ...schema, browserBundleOutputPath, tpl: '' }
  );
}
