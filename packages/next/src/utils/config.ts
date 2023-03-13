import { join, resolve } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';
import { FileReplacement } from './types';
import { createCopyPlugin, normalizeAssets } from '@nrwl/webpack';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/js/src/utils/buildable-libs-utils';

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = [],
  assets: any = null,
  dependencies: DependentBuildableProjectNode[] = [],
  libsDir = ''
): (a, b) => Configuration {
  return function webpackConfig(
    config: Configuration,
    {
      isServer,
      defaultLoaders,
    }: {
      buildId: string;
      dev: boolean;
      isServer: boolean;
      defaultLoaders: any;
    }
  ): Configuration {
    const mainFields = ['es2015', 'module', 'main'];
    const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
    let tsConfigPath = join(projectRoot, 'tsconfig.json');
    if (dependencies.length > 0) {
      tsConfigPath = createTmpTsConfig(
        join(workspaceRoot, tsConfigPath),
        workspaceRoot,
        projectRoot,
        dependencies
      );
    }

    config.resolve.plugins = [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
        extensions,
        mainFields,
      }) as never, // TODO: Remove never type when 'tsconfig-paths-webpack-plugin' types fixed
    ];

    fileReplacements
      .map((fileReplacement) => ({
        replace: resolve(workspaceRoot, fileReplacement.replace),
        with: resolve(workspaceRoot, fileReplacement.with),
      }))
      .reduce((alias, replacement) => {
        alias[replacement.replace] = replacement.with;
        return alias;
      }, config.resolve.alias);

    config.module.rules.push({
      test: /\.([jt])sx?$/,
      include: [libsDir],
      exclude: /node_modules/,
      use: [defaultLoaders.babel],
    });

    // Copy (shared) assets to `public` folder during client-side compilation
    if (!isServer && Array.isArray(assets) && assets.length > 0) {
      config.plugins.push(
        createCopyPlugin(
          normalizeAssets(assets, workspaceRoot, projectRoot).map((asset) => ({
            ...asset,
            output: join('../public', asset.output),
          }))
        )
      );
    }

    return config;
  };
}
