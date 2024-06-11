import * as path from 'path';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import {
  Configuration,
  ProgressPlugin,
  WebpackOptionsNormalized,
  WebpackPluginInstance,
} from 'webpack';
import { getRootTsConfigPath } from '@nx/js';

import { StatsJsonPlugin } from '../../stats-json-plugin';
import { GeneratePackageJsonPlugin } from '../../generate-package-json-plugin';
import { getOutputHashFormat } from '../../../utils/hash-format';
import { NxTsconfigPathsWebpackPlugin } from '../../nx-typescript-webpack-plugin/nx-tsconfig-paths-webpack-plugin';
import { getTerserEcmaVersion } from './get-terser-ecma-version';
import { createLoaderFromCompiler } from './compiler-loaders';
import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';
import TerserPlugin = require('terser-webpack-plugin');
import nodeExternals = require('webpack-node-externals');

const IGNORED_WEBPACK_WARNINGS = [
  /The comment file/i,
  /could not find any license/i,
];

const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
const mainFields = ['module', 'main'];

export function applyBaseConfig(
  options: NormalizedNxAppWebpackPluginOptions,
  config: Partial<WebpackOptionsNormalized | Configuration> = {},
  {
    useNormalizedEntry,
  }: {
    // webpack.Configuration allows arrays to be set on a single entry
    // webpack then normalizes them to { import: "..." } objects
    // This option allows use to preserve existing composePlugins behavior where entry.main is an array.
    useNormalizedEntry?: boolean;
  } = {}
): void {
  // Defaults that was applied from executor schema previously.
  options.compiler ??= 'babel';
  options.deleteOutputPath ??= true;
  options.externalDependencies ??= 'all';
  options.fileReplacements ??= [];
  options.memoryLimit ??= 2048;
  options.transformers ??= [];

  applyNxIndependentConfig(options, config);

  // Some of the options only work during actual tasks, not when reading the webpack config during CreateNodes.
  if (!process.env['NX_TASK_TARGET_PROJECT']) return;

  applyNxDependentConfig(options, config, { useNormalizedEntry });
}

function applyNxIndependentConfig(
  options: NormalizedNxAppWebpackPluginOptions,
  config: Partial<WebpackOptionsNormalized | Configuration>
): void {
  const hashFormat = getOutputHashFormat(options.outputHashing as string);
  config.context = path.join(options.root, options.projectRoot);
  config.target ??= options.target;
  config.node = false;
  config.mode =
    // When the target is Node avoid any optimizations, such as replacing `process.env.NODE_ENV` with build time value.
    config.target === 'node'
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
      : 'none';
  // When target is Node, the Webpack mode will be set to 'none' which disables in memory caching and causes a full rebuild on every change.
  // So to mitigate this we enable in memory caching when target is Node and in watch mode.
  config.cache =
    options.target === 'node' && options.watch ? { type: 'memory' } : undefined;

  config.devtool =
    options.sourceMap === 'hidden'
      ? 'hidden-source-map'
      : options.sourceMap
      ? 'source-map'
      : false;

  config.output = {
    ...config.output,
    libraryTarget:
      (config as Configuration).output?.libraryTarget ??
      (options.target === 'node' ? 'commonjs' : undefined),
    path:
      config.output?.path ??
      (options.outputPath
        ? path.join(options.root, options.outputPath)
        : undefined),
    filename:
      config.output?.filename ??
      (options.outputHashing ? `[name]${hashFormat.script}.js` : '[name].js'),
    chunkFilename:
      config.output?.chunkFilename ??
      (options.outputHashing ? `[name]${hashFormat.chunk}.js` : '[name].js'),
    hashFunction: config.output?.hashFunction ?? 'xxhash64',
    // Disabled for performance
    pathinfo: config.output?.pathinfo ?? false,
    // Use CJS for Node since it has the widest support.
    scriptType:
      config.output?.scriptType ??
      (options.target === 'node' ? undefined : 'module'),
  };

  config.watch = options.watch;

  config.watchOptions = {
    poll: options.poll,
  };

  config.profile = options.statsJson;

  config.performance = {
    ...config.performance,
    hints: false,
  };

  config.experiments = { ...config.experiments, cacheUnaffected: true };

  config.ignoreWarnings = [
    (x) =>
      IGNORED_WEBPACK_WARNINGS.some((r) =>
        typeof x === 'string' ? r.test(x) : r.test(x.message)
      ),
  ];

  config.optimization = {
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
                path.join(options.root, options.projectRoot)
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
              module: true,
              mangle: false,
            },
          }),
    ],
    runtimeChunk: false,
    concatenateModules: true,
  };

  config.stats = {
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

  /**
   * Initialize properties that get set when webpack is used during task execution.
   * These properties may be used by consumers who expect them to not be undefined.
   *
   * When @nx/webpack/plugin resolves the config, it is not during a task, and therefore
   * these values are not set, which can lead to errors being thrown when reading
   * the webpack options from the resolved file.
   */
  config.entry ??= {};
  config.resolve ??= {};
  config.module ??= {};
  config.plugins ??= [];
  config.externals ??= [];
}

function applyNxDependentConfig(
  options: NormalizedNxAppWebpackPluginOptions,
  config: Partial<WebpackOptionsNormalized | Configuration>,
  { useNormalizedEntry }: { useNormalizedEntry?: boolean } = {}
): void {
  const tsConfig = options.tsConfig ?? getRootTsConfigPath();
  const plugins: WebpackPluginInstance[] = [];

  const executorContext: Partial<ExecutorContext> = {
    projectName: options.projectName,
    targetName: options.targetName,
    projectGraph: options.projectGraph,
    configurationName: options.configurationName,
    root: options.root,
  };

  plugins.push(new NxTsconfigPathsWebpackPlugin({ ...options, tsConfig }));

  if (!options?.skipTypeChecking) {
    const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
    plugins.push(
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: path.isAbsolute(tsConfig)
            ? tsConfig
            : path.join(options.root, tsConfig),
          memoryLimit: options.memoryLimit || 2018,
        },
      })
    );
  }
  const entries: Array<{ name: string; import: string[] }> = [];

  if (options.main) {
    const mainEntry = options.outputFileName
      ? path.parse(options.outputFileName).name
      : 'main';
    entries.push({
      name: mainEntry,
      import: [path.resolve(options.root, options.main)],
    });
  }

  if (options.additionalEntryPoints) {
    for (const { entryName, entryPath } of options.additionalEntryPoints) {
      entries.push({
        name: entryName,
        import: [path.resolve(options.root, entryPath)],
      });
    }
  }

  if (options.polyfills) {
    entries.push({
      name: 'polyfills',
      import: [path.resolve(options.root, options.polyfills)],
    });
  }

  config.entry ??= {};
  entries.forEach((entry) => {
    if (useNormalizedEntry) {
      config.entry[entry.name] = { import: entry.import };
    } else {
      config.entry[entry.name] = entry.import;
    }
  });

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
    plugins.push(
      new CopyWebpackPlugin({
        patterns: options.assets.map((asset) => {
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
      })
    );
  }
  if (options.generatePackageJson && executorContext) {
    plugins.push(new GeneratePackageJsonPlugin({ ...options, tsConfig }));
  }

  if (options.statsJson) {
    plugins.push(new StatsJsonPlugin());
  }

  const externals = [];
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

  config.resolve = {
    ...config.resolve,
    extensions: [...(config?.resolve?.extensions ?? []), ...extensions],
    alias: {
      ...(config.resolve?.alias ?? {}),
      ...(options.fileReplacements?.reduce(
        (aliases, replacement) => ({
          ...aliases,
          [replacement.replace]: replacement.with,
        }),
        {}
      ) ?? {}),
    },
    mainFields: config.resolve?.mainFields ?? mainFields,
  };

  config.externals = externals;

  config.module = {
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
  };

  config.plugins ??= [];
  config.plugins.push(...plugins);
}
