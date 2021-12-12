import { join } from 'path';
import * as webpack from 'webpack';
import { Configuration, WebpackPluginInstance } from 'webpack';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as TerserWebpackPlugin from 'terser-webpack-plugin';
import { AssetGlobPattern, BuildBuilderOptions } from './shared-models';
import { getOutputHashFormat } from './hash-format';

// Inlining tsconfig-paths-webpack-plugin with a patch
// See: https://github.com/dividab/tsconfig-paths-webpack-plugin/pull/85
// TODO(jack): Remove once the patch lands in original package
import { TsconfigPathsPlugin } from './webpack/plugins/tsconfig-paths/tsconfig-paths.plugin';
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const IGNORED_WEBPACK_WARNINGS = [
  /The comment file/i,
  /could not find any license/i,
];

export function getBaseWebpackPartial(
  options: BuildBuilderOptions,
  esm?: boolean,
  isScriptOptimizeOn?: boolean,
  emitDecoratorMetadata?: boolean,
  configuration?: string
): Configuration {
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  const mainFields = [...(esm ? ['es2015'] : []), 'module', 'main'];
  const hashFormat = getOutputHashFormat(options.outputHashing);
  const suffixFormat = esm ? '.esm' : '.es5';
  const filename = isScriptOptimizeOn
    ? `[name]${hashFormat.script}${suffixFormat}.js`
    : '[name].js';
  const chunkFilename = isScriptOptimizeOn
    ? `[name]${hashFormat.chunk}${suffixFormat}.js`
    : '[name].js';
  const mode = isScriptOptimizeOn ? 'production' : 'development';

  const webpackConfig: Configuration = {
    target: 'web', // webpack defaults to 'browserslist' which breaks Fast Refresh

    entry: {
      main: [options.main],
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
        options.compiler === 'babel' && {
          test: /\.([jt])sx?$/,
          loader: join(__dirname, 'web-babel-loader'),
          exclude: /node_modules/,
          options: {
            rootMode: 'upward',
            cwd: join(options.root, options.sourceRoot),
            emitDecoratorMetadata,
            isModern: esm,
            envName: isScriptOptimizeOn ? 'production' : configuration,
            babelrc: true,
            cacheDirectory: true,
            cacheCompression: false,
          },
        },
        options.compiler === 'swc' && {
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
        },
      ].filter(Boolean),
    },
    resolve: {
      extensions,
      alias: getAliases(options),
      plugins: [
        // TODO  Remove the never type when module is updated
        // PR opened for the proper typing here; https://github.com/dividab/tsconfig-paths-webpack-plugin/pull/66
        new TsconfigPathsPlugin({
          configFile: options.tsConfig,
          extensions,
          mainFields,
        }),
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

  if (options.compiler !== 'swc' && isScriptOptimizeOn) {
    webpackConfig.optimization = {
      sideEffects: false,
      minimizer: [
        new TerserWebpackPlugin({
          parallel: true,
          terserOptions: {
            ecma: esm ? 2016 : 5,
            safari10: true,
            output: {
              ascii_only: true,
              comments: false,
              webkit: true,
            },
          },
        }),
      ],
      runtimeChunk: true,
    };
  }

  const extraPlugins: WebpackPluginInstance[] = [];

  if (esm) {
    extraPlugins.push(
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          enabled: true,
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

  webpackConfig.plugins = [...webpackConfig.plugins, ...extraPlugins];

  return webpackConfig;
}

function getAliases(options: BuildBuilderOptions): { [key: string]: string } {
  return options.fileReplacements.reduce(
    (aliases, replacement) => ({
      ...aliases,
      [replacement.replace]: replacement.with,
    }),
    {}
  );
}

function getStatsConfig(options: BuildBuilderOptions) {
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

// This is shamelessly taken from CRA and modified for NX use
// https://github.com/facebook/create-react-app/blob/4784997f0682e75eb32a897b4ffe34d735912e6c/packages/react-scripts/config/env.js#L71
function getClientEnvironment(mode) {
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
