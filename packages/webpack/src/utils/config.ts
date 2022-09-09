import { join, parse } from 'path';
import * as webpack from 'webpack';
import { Configuration, WebpackPluginInstance } from 'webpack';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import { getOutputHashFormat } from './hash-format';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { ExecutorContext } from '@nrwl/devkit';
import { loadTsTransformers } from '@nrwl/js';

import {
  AssetGlobPattern,
  NormalizedWebpackExecutorOptions,
} from '../executors/webpack/schema';
import { GeneratePackageJsonWebpackPlugin } from './generate-package-json-webpack-plugin';
import nodeExternals = require('webpack-node-externals');
import TerserPlugin = require('terser-webpack-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const IGNORED_WEBPACK_WARNINGS = [
  /The comment file/i,
  /could not find any license/i,
];

export interface InternalBuildOptions {
  esm?: boolean;
  isScriptOptimizeOn?: boolean;
  emitDecoratorMetadata?: boolean;
  configuration?: string;
  skipTypeCheck?: boolean;
}

const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

export function getBaseWebpackPartial(
  options: NormalizedWebpackExecutorOptions,
  internalOptions: InternalBuildOptions,
  context?: ExecutorContext
): Configuration {
  const mainFields = [
    ...(internalOptions.esm ? ['es2015'] : []),
    'module',
    'main',
  ];
  const hashFormat = getOutputHashFormat(options.outputHashing);
  const suffixFormat = internalOptions.esm ? '' : '.es5';
  const filename = internalOptions.isScriptOptimizeOn
    ? `[name]${hashFormat.script}${suffixFormat}.js`
    : '[name].js';
  const chunkFilename = internalOptions.isScriptOptimizeOn
    ? `[name]${hashFormat.chunk}${suffixFormat}.js`
    : '[name].js';
  const mode = internalOptions.isScriptOptimizeOn
    ? 'production'
    : 'development';

  let mainEntry = 'main';
  if (options.outputFileName) {
    mainEntry = parse(options.outputFileName).name;
  }
  const additionalEntryPoints =
    options.additionalEntryPoints?.reduce(
      (obj, current) => ({
        ...obj,
        [current.entryName]: current.entryPath,
      }),
      {} as { [entryName: string]: string }
    ) ?? {};

  const webpackConfig: Configuration = {
    target: options.target ?? 'web', // webpack defaults to 'browserslist' which breaks Fast Refresh
    entry: {
      [mainEntry]: [options.main],
      ...additionalEntryPoints,
    },
    devtool:
      options.sourceMap === 'hidden'
        ? 'hidden-source-map'
        : options.sourceMap
        ? 'source-map'
        : false,
    mode,
    output: {
      path: options.outputPath,
      filename,
      chunkFilename,
      hashFunction: 'xxhash64',
      // Disabled for performance
      pathinfo: false,
    },
    module: {
      // Enabled for performance
      unsafeCache: true,
      rules: [
        options.target === 'web' && {
          test: /\.(bmp|png|jpe?g|gif|webp|avif)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10_000, // 10 kB
            },
          },
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
        createLoaderFromCompiler(options, internalOptions),
      ].filter(Boolean),
    },
    resolve: {
      extensions,
      alias: getAliases(options),
      plugins: [
        new TsconfigPathsPlugin({
          configFile: options.tsConfig,
          extensions,
          mainFields,
        }) as never, // TODO: Remove never type when 'tsconfig-paths-webpack-plugin' types fixed
      ],
      mainFields,
    },
    performance: {
      hints: false,
    },
    plugins: [new webpack.DefinePlugin(getClientEnvironment(mode).stringified)],
    watch: options.watch,
    watchOptions: {
      poll: options.poll,
    },
    stats: getStatsConfig(options),
    ignoreWarnings: [
      (x) =>
        IGNORED_WEBPACK_WARNINGS.some((r) =>
          typeof x === 'string' ? r.test(x) : r.test(x.message)
        ),
    ],
    experiments: {
      cacheUnaffected: true,
    },
  };

  if (options.target === 'node') {
    webpackConfig.output.libraryTarget = 'commonjs';
    webpackConfig.node = false;
  }

  if (options.compiler !== 'swc' && internalOptions.isScriptOptimizeOn) {
    webpackConfig.optimization = {
      sideEffects: true,
      minimizer: [
        options.target === 'web'
          ? new TerserPlugin({
              parallel: true,
              terserOptions: {
                ecma: (internalOptions.esm
                  ? 2016
                  : 5) as TerserPlugin.TerserECMA,
                safari10: true,
                output: {
                  ascii_only: true,
                  comments: false,
                  webkit: true,
                },
              },
            })
          : new TerserPlugin({
              terserOptions: {
                mangle: false,
                keep_classnames: true,
              },
            }),
      ],
      runtimeChunk: options.target !== 'node',
    };
  }

  const extraPlugins: WebpackPluginInstance[] = [];

  if (!internalOptions.skipTypeCheck && internalOptions.esm) {
    extraPlugins.push(
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: options.tsConfig,
          memoryLimit: options.memoryLimit || 2018,
        },
      })
    );
  }

  if (options.progress) {
    extraPlugins.push(new webpack.ProgressPlugin());
  }

  // TODO  LicenseWebpackPlugin needs a PR for proper typing
  if (options.extractLicenses) {
    extraPlugins.push(
      new LicenseWebpackPlugin({
        stats: {
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`,
      }) as unknown as WebpackPluginInstance
    );
  }

  if (Array.isArray(options.assets) && options.assets.length > 0) {
    extraPlugins.push(createCopyPlugin(options.assets));
  }

  if (
    options.target === 'node' &&
    options.externalDependencies === 'all' &&
    context
  ) {
    const modulesDir = `${context.root}/node_modules`;
    webpackConfig.externals = [nodeExternals({ modulesDir })];
  } else if (Array.isArray(options.externalDependencies)) {
    webpackConfig.externals = [
      function (context, callback: Function) {
        if (options.externalDependencies.includes(context.request)) {
          // not bundled
          return callback(null, `commonjs ${context.request}`);
        }
        // bundled
        callback();
      },
    ];
  }

  if (options.generatePackageJson && context) {
    extraPlugins.push(new GeneratePackageJsonWebpackPlugin(context, options));
  }

  webpackConfig.plugins = [...webpackConfig.plugins, ...extraPlugins];

  return webpackConfig;
}

function getAliases(options: NormalizedWebpackExecutorOptions): {
  [key: string]: string;
} {
  return options.fileReplacements.reduce(
    (aliases, replacement) => ({
      ...aliases,
      [replacement.replace]: replacement.with,
    }),
    {}
  );
}

function getStatsConfig(options: NormalizedWebpackExecutorOptions) {
  return {
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
  };
}

export function getClientEnvironment(mode) {
  // Grab NODE_ENV and NX_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_APP = /^NX_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        NODE_ENV: process.env.NODE_ENV || mode,
      }
    );

  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}

export function createCopyPlugin(assets: AssetGlobPattern[]) {
  return new CopyWebpackPlugin({
    patterns: assets.map((asset) => {
      return {
        context: asset.input,
        // Now we remove starting slash to make Webpack place it from the output root.
        to: asset.output,
        from: asset.glob,
        globOptions: {
          ignore: [
            '.gitkeep',
            '**/.DS_Store',
            '**/Thumbs.db',
            ...(asset.ignore ?? []),
          ],
          dot: true,
        },
      };
    }),
  });
}

export function createLoaderFromCompiler(
  options: NormalizedWebpackExecutorOptions,
  extraOptions: InternalBuildOptions
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
    default:
      return {
        test: /\.([jt])sx?$/,
        loader: join(__dirname, 'web-babel-loader'),
        exclude: /node_modules/,
        options: {
          rootMode: 'upward',
          cwd: join(options.root, options.sourceRoot),
          emitDecoratorMetadata: extraOptions.emitDecoratorMetadata,
          isModern: extraOptions.esm,
          envName: extraOptions.isScriptOptimizeOn
            ? 'production'
            : extraOptions.configuration,
          babelrc: true,
          cacheDirectory: true,
          cacheCompression: false,
        },
      };
  }
}
