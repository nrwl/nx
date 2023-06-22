import * as path from 'path';
import { join } from 'path';
import { Configuration, ProgressPlugin, WebpackPluginInstance } from 'webpack';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { readTsConfig } from '@nx/js';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';

import { NormalizedWebpackExecutorOptions } from '../executors/webpack/schema';
import { StatsJsonPlugin } from '../plugins/stats-json-plugin';
import { createCopyPlugin } from './create-copy-plugin';
import { GeneratePackageJsonPlugin } from '../plugins/generate-package-json-plugin';
import { getOutputHashFormat } from './hash-format';
import { NxWebpackPlugin } from './config';
import { existsSync } from 'fs';
import TerserPlugin = require('terser-webpack-plugin');
import nodeExternals = require('webpack-node-externals');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import browserslist = require('browserslist');

const VALID_BROWSERSLIST_FILES = ['.browserslistrc', 'browserslist'];

function getTerserEcmaVersion(projectRoot: string) {
  let pathToBrowserslistFile = '';
  for (const browserslistFile of VALID_BROWSERSLIST_FILES) {
    const fullPathToFile = join(projectRoot, browserslistFile);
    if (existsSync(fullPathToFile)) {
      pathToBrowserslistFile = fullPathToFile;
      break;
    }
  }

  if (!pathToBrowserslistFile) {
    return 2020;
  }

  const env = browserslist.loadConfig({ path: pathToBrowserslistFile });
  const browsers = browserslist(env);
  return browsers.includes('ie 11') ? 5 : 2020;
}

const IGNORED_WEBPACK_WARNINGS = [
  /The comment file/i,
  /could not find any license/i,
];

const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
const mainFields = ['module', 'main'];

const processed = new Set();

export interface WithNxOptions {
  skipTypeChecking?: boolean;
}

/**
 * @param {WithNxOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withNx(pluginOptions?: WithNxOptions): NxWebpackPlugin {
  return function configure(
    config: Configuration,
    {
      options,
      context,
    }: {
      options: NormalizedWebpackExecutorOptions;
      context: ExecutorContext;
    }
  ): Configuration {
    if (processed.has(config)) return config;

    const plugins: WebpackPluginInstance[] = [];

    if (!pluginOptions?.skipTypeChecking) {
      plugins.push(
        new ForkTsCheckerWebpackPlugin({
          typescript: {
            configFile: options.tsConfig,
            memoryLimit: options.memoryLimit || 2018,
          },
        })
      );
    }
    const entry = {};

    if (options.main) {
      const mainEntry = options.outputFileName
        ? path.parse(options.outputFileName).name
        : 'main';
      entry[mainEntry] = [options.main];
    }

    if (options.additionalEntryPoints) {
      for (const { entryName, entryPath } of options.additionalEntryPoints) {
        entry[entryName] = entryPath;
      }
    }

    if (options.polyfills) {
      entry['polyfills'] = [
        ...(entry['polyfills'] || []),
        path.resolve(options.root, options.polyfills),
      ];
    }

    if (options.progress) {
      plugins.push(new ProgressPlugin({ profile: options.verbose }));
    }

    if (options.extractLicenses) {
      plugins.push(
        new LicenseWebpackPlugin({
          stats: {
            warnings: false,
            errors: false,
          },
          perChunkOutput: false,
          outputFilename: `3rdpartylicenses.txt`,
        }) as unknown as WebpackPluginInstance
      );
    }

    if (Array.isArray(options.assets) && options.assets.length > 0) {
      plugins.push(createCopyPlugin(options.assets));
    }

    if (options.generatePackageJson && context) {
      plugins.push(new GeneratePackageJsonPlugin(options, context));
    }

    if (options.statsJson) {
      plugins.push(new StatsJsonPlugin());
    }

    let externals = [];
    if (options.target === 'node' && options.externalDependencies === 'all') {
      const modulesDir = `${options.root}/node_modules`;
      externals.push(nodeExternals({ modulesDir }));
    } else if (Array.isArray(options.externalDependencies)) {
      externals.push(function (ctx, callback: Function) {
        if (options.externalDependencies.includes(ctx.request)) {
          // not bundled
          return callback(null, `commonjs ${ctx.request}`);
        }
        // bundled
        callback();
      });
    }

    const hashFormat = getOutputHashFormat(options.outputHashing as string);
    const filename = options.outputHashing
      ? `[name]${hashFormat.script}.js`
      : '[name].js';
    const chunkFilename = options.outputHashing
      ? `[name]${hashFormat.chunk}.js`
      : '[name].js';

    const updated = {
      ...config,
      context: context
        ? path.join(context.root, options.projectRoot)
        : undefined,
      target: options.target,
      node: false as const,
      mode:
        // When the target is Node avoid any optimizations, such as replacing `process.env.NODE_ENV` with build time value.
        options.target === ('node' as const)
          ? 'none'
          : // Otherwise, make sure it matches `process.env.NODE_ENV`.
          // When mode is development or production, webpack will automatically
          // configure DefinePlugin to replace `process.env.NODE_ENV` with the
          // build-time value. Thus, we need to make sure it's the same value to
          // avoid conflicts.
          //
          // When the NODE_ENV is something else (e.g. test), then set it to none
          // to prevent extra behavior from webpack.
          process.env.NODE_ENV === 'development' ||
            process.env.NODE_ENV === 'production'
          ? (process.env.NODE_ENV as 'development' | 'production')
          : ('none' as const),
      devtool:
        options.sourceMap === 'hidden'
          ? 'hidden-source-map'
          : options.sourceMap
          ? 'source-map'
          : (false as const),
      entry,
      output: {
        ...config.output,
        libraryTarget: options.target === 'node' ? 'commonjs' : undefined,
        path: options.outputPath,
        filename,
        chunkFilename,
        hashFunction: 'xxhash64',
        // Disabled for performance
        pathinfo: false,
        // Use CJS for Node since it has the widest support.
        scriptType: options.target === 'node' ? undefined : ('module' as const),
      },
      watch: options.watch,
      watchOptions: {
        poll: options.poll,
      },
      profile: options.statsJson,
      resolve: {
        ...config.resolve,
        extensions: [...extensions, ...(config?.resolve?.extensions ?? [])],
        alias: options.fileReplacements.reduce(
          (aliases, replacement) => ({
            ...aliases,
            [replacement.replace]: replacement.with,
          }),
          {}
        ),
        plugins: [
          ...(config.resolve?.plugins ?? []),
          new TsconfigPathsPlugin({
            configFile: options.tsConfig,
            extensions: [...extensions, ...(config?.resolve?.extensions ?? [])],
            mainFields,
          }),
        ],
        mainFields,
      },
      externals,
      optimization: {
        ...config.optimization,
        sideEffects: true,
        minimize:
          typeof options.optimization === 'object'
            ? !!options.optimization.scripts
            : !!options.optimization,
        minimizer: [
          options.compiler !== 'swc'
            ? new TerserPlugin({
                parallel: true,
                terserOptions: {
                  keep_classnames: true,
                  ecma: getTerserEcmaVersion(
                    join(options.root, options.projectRoot)
                  ),
                  safari10: true,
                  format: {
                    ascii_only: true,
                    comments: false,
                    webkit: true,
                  },
                },
                extractComments: false,
              })
            : new TerserPlugin({
                minify: TerserPlugin.swcMinify,
                // `terserOptions` options will be passed to `swc`
                terserOptions: {
                  mangle: false,
                },
              }),
        ],
        runtimeChunk: false,
        concatenateModules: true,
      },
      performance: {
        ...config.performance,
        hints: false as const,
      },
      experiments: { ...config.experiments, cacheUnaffected: true },
      ignoreWarnings: [
        (x) =>
          IGNORED_WEBPACK_WARNINGS.some((r) =>
            typeof x === 'string' ? r.test(x) : r.test(x.message)
          ),
      ],
      module: {
        ...config.module,
        // Enabled for performance
        unsafeCache: true,
        rules: [
          ...(config?.module?.rules ?? []),
          options.sourceMap && {
            test: /\.js$/,
            enforce: 'pre' as const,
            loader: require.resolve('source-map-loader'),
          },
          {
            // There's an issue resolving paths without fully specified extensions
            // See: https://github.com/graphql/graphql-js/issues/2721
            // TODO(jack): Add a flag to turn this option on like Next.js does via experimental flag.
            // See: https://github.com/vercel/next.js/pull/29880
            test: /\.m?jsx?$/,
            resolve: {
              fullySpecified: false,
            },
          },
          // There's an issue when using buildable libs and .js files (instead of .ts files),
          // where the wrong type is used (commonjs vs esm) resulting in export-imports throwing errors.
          // See: https://github.com/nrwl/nx/issues/10990
          {
            test: /\.js$/,
            type: 'javascript/auto',
          },
          createLoaderFromCompiler(options),
        ].filter((r) => !!r),
      },
      plugins: (config.plugins ?? []).concat(plugins),
      stats: {
        hash: true,
        timings: false,
        cached: false,
        cachedAssets: false,
        modules: false,
        warnings: true,
        errors: true,
        colors: !options.verbose && !options.statsJson,
        chunks: !options.verbose,
        assets: !!options.verbose,
        chunkOrigins: !!options.verbose,
        chunkModules: !!options.verbose,
        children: !!options.verbose,
        reasons: !!options.verbose,
        version: !!options.verbose,
        errorDetails: !!options.verbose,
        moduleTrace: !!options.verbose,
        usedExports: !!options.verbose,
      },
    };

    processed.add(updated);
    return updated;
  };
}

export function createLoaderFromCompiler(
  options: NormalizedWebpackExecutorOptions
) {
  switch (options.compiler) {
    case 'swc':
      return {
        test: /\.([jt])sx?$/,
        loader: require.resolve('swc-loader'),
        exclude: /node_modules/,
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
              tsx: true,
            },
            transform: {
              react: {
                runtime: 'automatic',
              },
            },
            loose: true,
          },
        },
      };
    case 'tsc':
      const { loadTsTransformers } = require('@nx/js');
      const { compilerPluginHooks, hasPlugin } = loadTsTransformers(
        options.transformers
      );
      return {
        test: /\.([jt])sx?$/,
        loader: require.resolve(`ts-loader`),
        exclude: /node_modules/,
        options: {
          configFile: options.tsConfig,
          transpileOnly: !hasPlugin,
          // https://github.com/TypeStrong/ts-loader/pull/685
          experimentalWatchApi: true,
          getCustomTransformers: (program) => ({
            before: compilerPluginHooks.beforeHooks.map((hook) =>
              hook(program)
            ),
            after: compilerPluginHooks.afterHooks.map((hook) => hook(program)),
            afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
              (hook) => hook(program)
            ),
          }),
        },
      };
    case 'babel':
      const tsConfig = readTsConfig(options.tsConfig);

      const babelConfig = {
        test: /\.([jt])sx?$/,
        loader: path.join(__dirname, './web-babel-loader'),
        exclude: /node_modules/,
        options: {
          cwd: path.join(options.root, options.sourceRoot),
          emitDecoratorMetadata: tsConfig.options.emitDecoratorMetadata,
          isModern: true,
          isTest: process.env.NX_CYPRESS_COMPONENT_TEST === 'true',
          envName: process.env.BABEL_ENV ?? process.env.NODE_ENV,
          cacheDirectory: true,
          cacheCompression: false,
        },
      };

      if (options.babelUpwardRootMode) {
        babelConfig.options['rootMode'] = 'upward';
        babelConfig.options['babelrc'] = true;
      } else {
        babelConfig.options['configFile'] =
          babelConfig.options?.['babelConfig'] ??
          path.join(options.root, options.projectRoot, '.babelrc');
      }

      return babelConfig;
    default:
      return null;
  }
}
