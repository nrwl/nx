import * as path from 'path';
import { type ExecutorContext } from '@nx/devkit';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import {
  Configuration,
  ProgressPlugin,
  RspackPluginInstance,
  SwcJsMinimizerRspackPlugin,
  CopyRspackPlugin,
  RspackOptionsNormalized,
} from '@rspack/core';
import { getRootTsConfigPath } from '@nx/js';

import { StatsJsonPlugin } from './plugins/stats-json-plugin';
import { GeneratePackageJsonPlugin } from './plugins/generate-package-json-plugin';
import { getOutputHashFormat } from './hash-format';
import { NxTsconfigPathsRspackPlugin } from './plugins/nx-tsconfig-paths-rspack-plugin';
import { getTerserEcmaVersion } from './get-terser-ecma-version';
import nodeExternals = require('webpack-node-externals');
import { NormalizedNxAppRspackPluginOptions } from './models';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getNonBuildableLibs } from './get-non-buildable-libs';

const IGNORED_RSPACK_WARNINGS = [
  /The comment file/i,
  /could not find any license/i,
];

const extensions = ['...', '.ts', '.tsx', '.mjs', '.js', '.jsx'];

const extensionAlias = {
  '.js': ['.ts', '.tsx', '.js', 'jsx'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs'],
  '.jsx': ['.tsx', '.jsx'],
};
const mainFields = ['module', 'main'];

export function applyBaseConfig(
  options: NormalizedNxAppRspackPluginOptions,
  config: Partial<RspackOptionsNormalized | Configuration> = {},
  {
    useNormalizedEntry,
  }: {
    // rspack.Configuration allows arrays to be set on a single entry
    // rspack then normalizes them to { import: "..." } objects
    // This option allows use to preserve existing composePlugins behavior where entry.main is an array.
    useNormalizedEntry?: boolean;
  } = {}
): void {
  // Defaults that was applied from executor schema previously.
  options.deleteOutputPath ??= true;
  options.externalDependencies ??= 'all';
  options.fileReplacements ??= [];
  options.memoryLimit ??= 2048;
  options.transformers ??= [];
  options.progress ??= true;
  options.outputHashing ??= 'all';

  applyNxIndependentConfig(options, config);

  // Some of the options only work during actual tasks, not when reading the rspack config during CreateNodes.
  if (global.NX_GRAPH_CREATION) return;

  applyNxDependentConfig(options, config, { useNormalizedEntry });
}

function applyNxIndependentConfig(
  options: NormalizedNxAppRspackPluginOptions,
  config: Partial<RspackOptionsNormalized | Configuration>
): void {
  const isProd =
    process.env.NODE_ENV === 'production' || options.mode === 'production';
  const isDevServer = process.env['WEBPACK_SERVE'];
  const hashFormat = getOutputHashFormat(options.outputHashing as string);
  config.context = path.join(options.root, options.projectRoot);
  config.target ??= options.target as 'async-node' | 'node' | 'web';
  config.node = false;
  config.mode =
    // When the target is Node avoid any optimizations, such as replacing `process.env.NODE_ENV` with build time value.
    config.target === 'node' || config.target === 'async-node'
      ? 'none'
      : // Otherwise, make sure it matches `process.env.NODE_ENV`.
        // When mode is development or production, rspack will automatically
        // configure DefinePlugin to replace `process.env.NODE_ENV` with the
        // build-time value. Thus, we need to make sure it's the same value to
        // avoid conflicts.
        //
        // When the NODE_ENV is something else (e.g. test), then set it to none
        // to prevent extra behavior from rspack.
        options.mode ??
        (process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'production'
          ? (process.env.NODE_ENV as 'development' | 'production')
          : 'none');
  // When target is Node, the Webpack mode will be set to 'none' which disables in memory caching and causes a full rebuild on every change.
  // So to mitigate this we enable in memory caching when target is Node and in watch mode.
  config.cache =
    (options.target === 'node' || options.target === 'async-node') &&
    options.watch
      ? true
      : undefined;

  config.devtool =
    options.sourceMap === true ? 'source-map' : options.sourceMap;

  config.output = {
    ...(config.output ?? {}),
    libraryTarget:
      options.target === 'node'
        ? 'commonjs'
        : options.target === 'async-node'
        ? 'commonjs-module'
        : undefined,
    path:
      config.output?.path ??
      (options.outputPath
        ? // If path is relative, it is relative from project root (aka cwd).
          // Otherwise, it is relative to workspace root (legacy behavior).
          options.outputPath.startsWith('.')
          ? path.join(options.root, options.projectRoot, options.outputPath)
          : path.join(options.root, options.outputPath)
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
    clean: config.output?.clean ?? options.deleteOutputPath,
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

  config.ignoreWarnings = [
    (x) =>
      IGNORED_RSPACK_WARNINGS.some((r) =>
        typeof x === 'string' ? r.test(x) : r.test(x.message)
      ),
    ...(config.ignoreWarnings ?? []),
  ];

  config.optimization = {
    ...(config.optimization ?? {}),
    ...(isProd
      ? {
          sideEffects: true,
          minimize:
            typeof options.optimization === 'object'
              ? !!options.optimization.scripts
              : !!options.optimization,
          minimizer: [
            new SwcJsMinimizerRspackPlugin({
              extractComments: false,
              minimizerOptions: {
                // this needs to be false to allow toplevel variables to be used in the global scope
                // important especially for module-federation which operates as such
                module: false,
                mangle: {
                  keep_classnames: true,
                },
                format: {
                  ecma: getTerserEcmaVersion(
                    path.join(options.root, options.projectRoot)
                  ),
                  ascii_only: true,
                  comments: false,
                  webkit: true,
                  safari10: true,
                },
              },
            }),
          ],
          concatenateModules: true,
          runtimeChunk: isDevServer
            ? config.optimization?.runtimeChunk ?? undefined
            : false,
        }
      : {}),
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
   * Initialize properties that get set when rspack is used during task execution.
   * These properties may be used by consumers who expect them to not be undefined.
   *
   * When @nx/rspack/plugin resolves the config, it is not during a task, and therefore
   * these values are not set, which can lead to errors being thrown when reading
   * the rspack options from the resolved file.
   */
  config.entry ??= {};
  config.resolve ??= {};
  config.module ??= {};
  config.plugins ??= [];
  config.externals ??= [];
}

function applyNxDependentConfig(
  options: NormalizedNxAppRspackPluginOptions,
  config: Partial<RspackOptionsNormalized | Configuration>,
  { useNormalizedEntry }: { useNormalizedEntry?: boolean } = {}
): void {
  const tsConfig = options.tsConfig ?? getRootTsConfigPath();
  const plugins: RspackPluginInstance[] = [];

  const isUsingTsSolution = isUsingTsSolutionSetup();

  const executorContext: Partial<ExecutorContext> = {
    projectName: options.projectName,
    targetName: options.targetName,
    projectGraph: options.projectGraph,
    configurationName: options.configurationName,
    root: options.root,
  };

  options.useTsconfigPaths ??= !isUsingTsSolution;
  // If the project is using ts solutions setup, the paths are not in tsconfig and we should not use the plugin's paths.
  if (options.useTsconfigPaths) {
    plugins.push(new NxTsconfigPathsRspackPlugin({ ...options, tsConfig }));
  }

  // New TS Solution already has a typecheck target but allow it to run during serve
  if (
    (!options?.skipTypeChecking && !isUsingTsSolution) ||
    (isUsingTsSolution &&
      options?.skipTypeChecking === false &&
      process.env['WEBPACK_SERVE'])
  ) {
    const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');
    plugins.push(
      new TsCheckerRspackPlugin({
        typescript: {
          configFile: path.isAbsolute(tsConfig)
            ? tsConfig
            : path.join(options.root, tsConfig),
          memoryLimit: options.memoryLimit || 8192, // default memory limit is 8192
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
      }) as unknown as RspackPluginInstance
    );
  }

  if (Array.isArray(options.assets) && options.assets.length > 0) {
    plugins.push(
      new CopyRspackPlugin({
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
  if (
    (options.target === 'node' || options.target === 'async-node') &&
    options.externalDependencies === 'all'
  ) {
    const modulesDir = `${options.root}/node_modules`;
    const graph = options.projectGraph;
    const projectName = options.projectName;

    // Collect non-buildable TS project references so that they are bundled
    // in the final output. This is needed for projects that are not buildable
    // but are referenced by buildable projects. This is needed for the new TS
    // solution setup.

    const nonBuildableWorkspaceLibs = isUsingTsSolution
      ? getNonBuildableLibs(graph, projectName)
      : [];

    externals.push(
      nodeExternals({ modulesDir, allowlist: nonBuildableWorkspaceLibs })
    );
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
    extensionAlias: {
      ...(config.resolve?.extensionAlias ?? {}),
      ...extensionAlias,
    },
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

  // Enabled for performance
  config.cache = true;
  config.module = {
    ...config.module,
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
      // Rspack's docs only suggest swc for TS compilation
      //https://rspack.dev/guide/tech/typescript
      {
        test: /\.([jt])sx?$/,
        loader: 'builtin:swc-loader',
        exclude: /node_modules/,

        type: 'javascript/auto',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
              tsx: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
              react: {
                runtime: 'automatic',
                pragma: 'React.createElement',
                pragmaFrag: 'React.Fragment',
                throwIfNamespace: true,
                // Config.mode is already set based on options.mode and `process.env.NODE_ENV`
                development: config.mode === 'development',
                refresh: config.mode === 'development',
                useBuiltins: false,
              },
            },
          },
        },
      },
    ].filter((r) => !!r),
  };

  config.plugins ??= [];
  config.plugins.push(...plugins);
}
