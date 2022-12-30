import type { Tree } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

export function parseASTOfWebpackConfig(
  tree: Tree,
  pathToWebpackConfig: string
) {
  if (!tree.exists(pathToWebpackConfig)) {
    throw new Error(
      `Cannot migrate webpack config at \`${pathToWebpackConfig}\` as it does not exist. Please ensure this file exists and that the path to the file is correct.`
    );
  }

  const source = tree.read(pathToWebpackConfig, 'utf-8');
  return tsquery.ast(source);
}
