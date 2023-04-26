import type { Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

export function parseASTOfWebpackConfig(
  tree: Tree,
  pathToWebpackConfig: string
) {
  if (!tree.exists(pathToWebpackConfig)) {
    throw new Error(
      `Cannot migrate webpack config at \`${pathToWebpackConfig}\` as it does not exist. Please ensure this file exists and that the path to the file is correct.`
    );
  }
  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');

  const source = tree.read(pathToWebpackConfig, 'utf-8');
  return tsquery.ast(source);
}
