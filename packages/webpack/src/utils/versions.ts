import { join } from 'path';
import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';

export const nxVersion = require(join('@nx/webpack', 'package.json')).version;

export const swcLoaderVersion = '0.1.15';
export const tsLibVersion = '^2.3.0';

// Floor for the generator-level support check. The plugin's runtime code uses
// webpack 5-only APIs (e.g. `ids.HashedModuleIdsPlugin`, `webpack.sources`,
// `experiments.cacheUnaffected`), so webpack 5 is the supported floor.
export const minSupportedWebpackVersion = '5.0.0';

// Fresh-install versions written when the package is not already present.
export const webpackVersion = '^5.101.3';
export const webpackDevServerVersion = '^5.2.1';
export const webpackCliVersion = '^7.0.0';

// React apps
export const reactRefreshWebpackPluginVersion = '^0.5.7';
export const svgrWebpackVersion = '^8.0.1';
export const reactRefreshVersion = '^0.10.0';

export function assertSupportedWebpackVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'webpack', minSupportedWebpackVersion);
}
