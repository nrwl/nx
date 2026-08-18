import {
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';
import { svgrWebpackVersion } from '../../utils/versions';

// The Nx 22 `add-svgr-to-webpack-config` migration inlined a `withSvgr` helper
// that resolves `@svgr/webpack` into user webpack configs, but never added the
// package to the workspace - it only resolved transitively through `@nx/react`.
// Now that `@nx/react` no longer depends on it, backfill it where a webpack
// config actually references it.
const webpackConfigFileNames = [
  'webpack.config.js',
  'webpack.config.ts',
  'webpack.config.cjs',
  'webpack.config.mjs',
  'webpack.config.prod.js',
  'webpack.config.prod.ts',
  'webpack.server.config.js',
  'webpack.server.config.ts',
];

export default async function addSvgrWebpackIfUsed(tree: Tree) {
  let needsSvgr = false;

  for (const [, project] of getProjects(tree)) {
    // Configs referenced by executor targets can live anywhere.
    for (const target of Object.values(project.targets ?? {})) {
      for (const options of [
        target.options,
        ...Object.values(target.configurations ?? {}),
      ]) {
        const webpackConfig = options?.webpackConfig;
        if (typeof webpackConfig === 'string') {
          needsSvgr ||= referencesSvgrWebpack(tree, webpackConfig);
        }
      }
    }

    // Inferred setups have no executor options pointing at a config, so also
    // check the conventional config file names at the project root.
    for (const fileName of webpackConfigFileNames) {
      needsSvgr ||= referencesSvgrWebpack(
        tree,
        joinPathFragments(project.root, fileName)
      );
    }

    if (needsSvgr) {
      break;
    }
  }

  if (!needsSvgr) {
    return;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { '@svgr/webpack': svgrWebpackVersion },
    undefined,
    true
  );
}

function referencesSvgrWebpack(tree: Tree, path: string): boolean {
  if (!tree.exists(path)) {
    return false;
  }

  return tree.read(path, 'utf-8').includes('@svgr/webpack');
}
