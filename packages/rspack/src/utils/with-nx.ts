import {
  Configuration,
  ExternalItem,
  ResolveAlias,
  RspackPluginInstance,
  rspack,
} from '@rspack/core';
import { existsSync, readFileSync } from 'fs';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as path from 'path';
import { join } from 'path';
import { GeneratePackageJsonPlugin } from '../plugins/generate-package-json-plugin';
import { getCopyPatterns } from './get-copy-patterns';
import { SharedConfigContext } from './model';
import { normalizeAssets } from './normalize-assets';

export function withNx(_opts = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isProd =
      process.env.NODE_ENV === 'production' || options.mode === 'production';

    const project = context.projectGraph.nodes[context.projectName];
    const sourceRoot = path.join(context.root, project.data.sourceRoot);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tsconfigPaths = require('tsconfig-paths');
    const { paths } = tsconfigPaths.loadConfig(options.tsConfig);
    const alias: ResolveAlias = Object.keys(paths).reduce((acc, k) => {
      acc[k] = path.join(context.root, paths[k][0]);
      return acc;
    }, {});

    const plugins = config.plugins ?? [];
    if (options.extractLicenses) {
      /**
       * Needed to prevent an issue with Rspack and Workspaces where the
       * workspace's root package.json file is added to the dependency tree
       */
      let rootPackageJsonName;
      const pathToRootPackageJson = join(context.root, 'package.json');
      if (existsSync(pathToRootPackageJson)) {
        try {
          const rootPackageJson = JSON.parse(
            readFileSync(pathToRootPackageJson, 'utf-8')
          );
          rootPackageJsonName = rootPackageJson.name;
        } catch {
          // do nothing
        }
      }
      plugins.push(
        new LicenseWebpackPlugin({
          stats: {
            warnings: false,
            errors: false,
          },
          outputFilename: `3rdpartylicenses.txt`,
          /**
           * Needed to prevent an issue with Rspack and Workspaces where the
           * workspace's root package.json file is added to the dependency tree
           */
          excludedPackageTest: (packageName) => {
            if (!rootPackageJsonName) {
              return false;
            }
            return packageName === rootPackageJsonName;
          },
        }) as unknown as RspackPluginInstance
      );
    }

    if (options.generatePackageJson) {
      const mainOutputFile =
        options.main.split('/').pop().split('.')[0] + '.js';

      plugins.push(
        new GeneratePackageJsonPlugin(
          {
            tsConfig: options.tsConfig,
            outputFileName: options.outputFileName ?? mainOutputFile,
          },
          context
        )
      );
    }

    plugins.push(
      new rspack.CopyRspackPlugin({
        patterns: getCopyPatterns(
          normalizeAssets(options.assets, context.root, sourceRoot)
        ),
      })
    );
    plugins.push(new rspack.ProgressPlugin());

    options.fileReplacements.forEach((item) => {
      alias[item.replace] = item.with;
    });

    const externals: ExternalItem = {};
    let externalsType: Configuration['externalsType'];
    if (options.target === 'node') {
      const projectDeps =
        context.projectGraph.dependencies[context.projectName];
      for (const dep of Object.values(projectDeps)) {
        const externalNode = context.projectGraph.externalNodes[dep.target];
        if (externalNode) {
          externals[externalNode.data.packageName] =
            externalNode.data.packageName;
        }
      }
      externalsType = 'commonjs';
    }

    const updated: Configuration = {
      ...config,
      target: options.target,
      mode: options.mode,
      entry: {},
      context: join(
        context.root,
        context.projectGraph.nodes[context.projectName].data.root
      ),
      devtool:
        options.sourceMap === 'hidden'
          ? ('hidden-source-map' as const)
          : options.sourceMap
          ? ('source-map' as const)
          : (false as const),
      output: {
        path: path.join(context.root, options.outputPath),
        publicPath: '/',
        filename:
          isProd && options.target !== 'node'
            ? '[name].[contenthash:8].js'
            : '[name].js',
        chunkFilename:
          isProd && options.target !== 'node'
            ? '[name].[contenthash:8].js'
            : '[name].js',
        cssFilename:
          isProd && options.target !== 'node'
            ? '[name].[contenthash:8].css'
            : '[name].css',
        cssChunkFilename:
          isProd && options.target !== 'node'
            ? '[name].[contenthash:8].css'
            : '[name].css',
        assetModuleFilename:
          isProd && options.target !== 'node'
            ? '[name].[contenthash:8][ext]'
            : '[name][ext]',
      },
      devServer: {
        ...(config.devServer ?? {}),
        port: config.devServer?.port ?? 4200,
        hot: config.devServer?.hot ?? true,
      } as any,
      module: {
        rules: [
          {
            test: /\.js$/,
            loader: 'builtin:swc-loader',
            exclude: /node_modules/,
            options: {
              jsc: {
                parser: {
                  syntax: 'ecmascript',
                },
                externalHelpers: true,
              },
            },
            type: 'javascript/auto',
          },
          {
            test: /\.ts$/,
            loader: 'builtin:swc-loader',
            exclude: /node_modules/,
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  decorators: true,
                },
                transform: {
                  legacyDecorator: true,
                  decoratorMetadata: true,
                },
                externalHelpers: true,
              },
            },
            type: 'javascript/auto',
          },
        ],
      },
      plugins: plugins,
      resolve: {
        // There are some issues resolving workspace libs in a monorepo.
        // It looks to be an issue with rspack itself, but will check back after Nx 16 release
        // once I can reproduce a small example repo with rspack only.
        alias,
        // We need to define the extensions that rspack can resolve
        extensions: ['...', '.ts', '.tsx', '.jsx'],
        // tsConfigPath: path.join(context.root, options.tsConfig),
      },
      infrastructureLogging: {
        debug: false,
      },
      externals,
      externalsType,
      stats: {
        colors: true,
        preset: 'normal',
      },
    };

    const mainEntry = options.main
      ? options.outputFileName
        ? path.parse(options.outputFileName).name
        : 'main'
      : 'main';
    updated.entry[mainEntry] = path.resolve(context.root, options.main);

    return updated;
  };
}
