import { Tree } from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { join, relative } from 'path';

const FILE_EXTENSION_REGEX = /\.[^.]+$/;

export async function getCustomWebpackConfig(
  tree: Tree,
  projectRoot: string,
  pathToCustomWebpackConfig: string
) {
  const configFile = await loadConfigFile(
    join(tree.root, pathToCustomWebpackConfig)
  );
  const webpackConfig =
    'default' in configFile ? configFile.default : configFile;
  return {
    isWebpackConfigFunction: typeof webpackConfig === 'function',
    normalizedPathToCustomWebpackConfig: `./${relative(
      projectRoot,
      pathToCustomWebpackConfig
    ).replace(FILE_EXTENSION_REGEX, '')}`,
  };
}
