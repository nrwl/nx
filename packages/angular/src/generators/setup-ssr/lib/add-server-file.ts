import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from '../schema';
import { DEFAULT_BROWSER_DIR } from './constants';

export function addServerFile(
  tree: Tree,
  schema: Schema,
  isUsingApplicationBuilder: boolean
) {
  const { root: projectRoot, targets } = readProjectConfiguration(
    tree,
    schema.project
  );
  const { outputPath } = targets.build.options;
  const browserBundleOutputPath = isUsingApplicationBuilder
    ? getApplicationBuilderBrowserOutputPath(outputPath)
    : outputPath;

  const pathToFiles = joinPathFragments(__dirname, '..', 'files');

  generateFiles(
    tree,
    joinPathFragments(
      pathToFiles,
      'server',
      isUsingApplicationBuilder ? 'application-builder' : 'server-builder'
    ),
    projectRoot,
    { ...schema, browserBundleOutputPath, tpl: '' }
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
