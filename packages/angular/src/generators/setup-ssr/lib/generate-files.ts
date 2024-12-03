import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedGeneratorOptions } from '../schema';

export function generateSSRFiles(
  tree: Tree,
  options: NormalizedGeneratorOptions
) {
  const project = readProjectConfiguration(tree, options.project);

  if (
    project.targets.server ||
    (options.isUsingApplicationBuilder &&
      project.targets.build.options?.server !== undefined)
  ) {
    // server has already been added
    return;
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const baseFilesPath = join(__dirname, '..', 'files');
  let pathToFiles: string;
  if (angularMajorVersion >= 19) {
    pathToFiles = join(
      baseFilesPath,
      'v19+',
      options.isUsingApplicationBuilder
        ? 'application-builder'
        : 'server-builder',
      options.standalone ? 'standalone-src' : 'ngmodule-src'
    );
  } else {
    pathToFiles = join(
      baseFilesPath,
      'pre-v19',
      options.standalone ? 'standalone-src' : 'ngmodule-src'
    );
  }

  const sourceRoot =
    project.sourceRoot ?? joinPathFragments(project.root, 'src');

  generateFiles(tree, pathToFiles, sourceRoot, { ...options, tpl: '' });

  if (angularMajorVersion >= 19 && !options.serverRouting) {
    tree.delete(joinPathFragments(sourceRoot, 'app/app.routes.server.ts'));
  }
}
