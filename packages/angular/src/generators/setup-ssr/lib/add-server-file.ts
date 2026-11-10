import type { Tree } from '@nx/devkit';
import { generateFiles, readProjectConfiguration } from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/internal';
import { join } from 'path';
import { isZonelessApp } from '../../../utils/zoneless';
import {
  getInstalledAngularVersionInfo,
  supportsSsrAllowedHosts,
} from '../../utils/version-utils';
import type { NormalizedGeneratorOptions } from '../schema';
import { DEFAULT_BROWSER_DIR } from './constants';

export function addServerFile(tree: Tree, options: NormalizedGeneratorOptions) {
  const project = readProjectConfiguration(tree, options.project);
  const { outputPath } = project.targets.build.options;
  const usesApplicationEngine =
    options.isUsingApplicationBuilder || options.isRspack;
  let browserDistDirectory: string;
  if (options.isRspack) {
    // rspack always emits the browser bundle under the default directory name
    browserDistDirectory = DEFAULT_BROWSER_DIR;
  } else if (options.isUsingApplicationBuilder) {
    browserDistDirectory = getApplicationBuilderBrowserOutputPath(outputPath);
  } else {
    browserDistDirectory = outputPath;
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const pathToFiles = join(
    __dirname,
    '..',
    'files',
    'v20+',
    usesApplicationEngine ? 'application-builder' : 'server-builder',
    'server'
  );

  const sourceRoot = getProjectSourceRoot(project, tree);
  const zoneless = isZonelessApp(project);

  generateFiles(tree, pathToFiles, sourceRoot, {
    ...options,
    browserDistDirectory,
    zoneless,
    useDefaultImport: angularMajorVersion >= 21,
    angularMajorVersion,
    supportsAllowedHosts: supportsSsrAllowedHosts(tree),
    tpl: '',
  });
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
