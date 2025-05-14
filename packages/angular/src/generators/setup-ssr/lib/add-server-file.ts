import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedGeneratorOptions } from '../schema';
import { DEFAULT_BROWSER_DIR } from './constants';

export function addServerFile(tree: Tree, options: NormalizedGeneratorOptions) {
  const project = readProjectConfiguration(tree, options.project);
  const { outputPath } = project.targets.build.options;
  const browserDistDirectory = options.isUsingApplicationBuilder
    ? getApplicationBuilderBrowserOutputPath(outputPath)
    : outputPath;

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const baseFilesPath = join(__dirname, '..', 'files');
  let pathToFiles: string;
  if (angularMajorVersion >= 20) {
    pathToFiles = join(
      baseFilesPath,
      'v20+',
      options.isUsingApplicationBuilder
        ? 'application-builder'
        : 'server-builder',
      'server'
    );
  } else if (angularMajorVersion === 19) {
    pathToFiles = join(
      baseFilesPath,
      'v19',
      options.isUsingApplicationBuilder
        ? 'application-builder' +
            (options.serverRouting ? '' : '-common-engine')
        : 'server-builder',
      'server'
    );
  } else {
    pathToFiles = join(
      baseFilesPath,
      'pre-v19',
      'server',
      options.isUsingApplicationBuilder
        ? 'application-builder'
        : 'server-builder'
    );
  }

  const sourceRoot =
    project.sourceRoot ?? joinPathFragments(project.root, 'src');

  generateFiles(
    tree,
    pathToFiles,
    angularMajorVersion >= 19 ? sourceRoot : project.root,
    {
      ...options,
      browserDistDirectory,
      tpl: '',
    }
  );
}

function getApplicationBuilderBrowserOutputPath(
  outputPath: string | { browser: string }
): string {
  if (outputPath) {
    if (typeof outputPath === 'string') {
      // when `outputPath` is a string, it's the base path, so we return the default browser path
      return DEFAULT_BROWSER_DIR;
    }

    return outputPath.browser ?? DEFAULT_BROWSER_DIR;
  }

  return DEFAULT_BROWSER_DIR;
}
