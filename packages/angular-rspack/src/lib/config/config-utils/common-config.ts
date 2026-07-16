import type { Compiler, Configuration } from '@rspack/core';
import { join, resolve } from 'node:path';
import {
  JS_ALL_EXT_REGEX,
  TS_ALL_EXT_REGEX,
} from '@nx/angular-rspack-compiler';
import { workspaceRoot } from '@nx/devkit';
import {
  HashFormat,
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { getStylesConfig } from './style-config-utils';
import { getCrossOriginLoading } from './helpers';
import { configureSourceMap } from './sourcemap-utils';
import { isServeMode } from '../../utils/rspack-serve-env';
import { StatsJsonPlugin } from '../../plugins/stats-json-plugin';
import { WatchFilesLogsPlugin } from '../../plugins/watch-file-logs-plugin';
import { getIndexInputFile } from '../../utils/index-file/get-index-input-file';
import { isRspackV2 } from '../../utils/rspack-version';

export async function getCommonConfig(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  i18nHash: string | (() => void),
  hashFormat: HashFormat
) {
  const isDevServer = isServeMode();
  const crossOriginLoading = getCrossOriginLoading(normalizedOptions);
  const sourceMapOptions = configureSourceMap(normalizedOptions.sourceMap);
  const stylesConfig = await getStylesConfig(
    normalizedOptions,
    hashFormat,
    normalizedOptions.hasServer ? 'server' : 'browser'
  );
  const indexInputFile = join(
    normalizedOptions.root,
    getIndexInputFile(normalizedOptions.index)
  );
  const indexInputWatchPlugin = {
    apply: (compiler: Compiler) => {
      compiler.hooks.thisCompilation.tap('build-angular', (compilation) => {
        compilation.fileDependencies.add(indexInputFile);
      });
    },
  };

  const defaultConfig: Configuration = {
    context: normalizedOptions.root,
    mode:
      normalizedOptions.optimization.scripts ||
      normalizedOptions.optimization.styles.minify
        ? 'production'
        : 'development',
    // `devtool` must stay coupled to `sourceMap.scripts`: with script
    // sourcemaps disabled the Angular compilation still emits inline maps
    // (required to keep TypeScript transpilation enabled, see
    // `setupCompilation`) but without `inlineSources`, and babel may pass a
    // stale pre-linker map comment through — the loaders can then extract a
    // map that must be discarded, which only happens while `devtool` is off
    // in exactly this configuration.
    devtool: normalizedOptions.sourceMap.scripts ? 'source-map' : false,
    infrastructureLogging: {
      appendOnly: false,
      debug: normalizedOptions.verbose,
      level: normalizedOptions.verbose ? 'verbose' : 'none',
    },
    performance: {
      hints: false,
    },
    stats: 'none', // This is handled in the AngularRspackPlugin by the rspackStatsLogger
    output: {
      uniqueName: normalizedOptions.projectName ?? 'rspack-angular',
      publicPath: normalizedOptions.deployUrl ?? '',
      clean: false, // already taken care for by AngularRspackPlugin
      crossOriginLoading,
      trustedTypes: { policyName: 'angular#bundler' },
      sourceMapFilename: normalizedOptions.sourceMap.scripts
        ? '[file].map'
        : undefined,
      ...(isDevServer ? {} : { scriptType: 'module' }),
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.mjs', '.js'],
      symlinks: !normalizedOptions.preserveSymlinks,
      // Make sure we add the root node_modules directory to the node resolver
      modules: ['node_modules', join(workspaceRoot, 'node_modules')],
      conditionNames: ['es2020', 'es2015', '...'],
      tsConfig: {
        configFile: normalizedOptions.tsConfig,
      },
      alias: {
        ...(i18n.shouldInline && normalizedOptions.aot
          ? { '@angular/localize/init': false }
          : {}),
        ...(normalizedOptions.fileReplacements?.reduce(
          (aliases, replacement) => ({
            ...aliases,
            [replacement.replace]: replacement.with,
          }),
          {}
        ) ?? {}),
      },
    },
    resolveLoader: {
      symlinks: !normalizedOptions.preserveSymlinks,
    },
    watch: normalizedOptions.watch,
    watchOptions: {
      // Default aggregateTimeout to batch rapid filesystem events (e.g., editor backup files)
      aggregateTimeout: 50,
      poll: normalizedOptions.poll,
      followSymlinks: normalizedOptions.preserveSymlinks,
      ignored:
        normalizedOptions.poll === undefined ? undefined : '**/node_modules/**',
      // User-provided watchOptions take precedence
      ...normalizedOptions.watchOptions,
    },
    ignoreWarnings: [
      // https://github.com/webpack-contrib/source-map-loader/blob/b2de4249c7431dd8432da607e08f0f65e9d64219/src/index.js#L83
      /Failed to parse source map from/,
      // https://github.com/webpack-contrib/postcss-loader/blob/bd261875fdf9c596af4ffb3a1a73fe3c549befda/src/index.js#L153-L158
      /Add postcss as project dependency/,
      // esbuild will issue a warning, while still hoists the @charset at the very top.
      // This is caused by a bug in css-loader https://github.com/webpack-contrib/css-loader/issues/1212
      /"@charset" must be the first rule in the file/,
    ],
    module: {
      parser: {
        javascript: {
          url: false,
        },
      },
      rules: [
        {
          test: /\.?(svg|html)$/,
          // Only process HTML and SVG which are known Angular component resources.
          resourceQuery: /\?ngResource/,
          type: 'asset/source',
        },
        ...stylesConfig.loaderRules,
        ...sourceMapOptions.sourceMapRules,
        { test: /[/\\]rxjs[/\\]add[/\\].+\.js$/, sideEffects: true },
        {
          test: TS_ALL_EXT_REGEX,
          use: [
            {
              // eslint-disable-next-line @nx/enforce-module-boundaries
              loader: require.resolve(
                '@nx/angular-rspack/loaders/angular-loader'
              ),
            },
          ],
        },
        {
          test: JS_ALL_EXT_REGEX,
          use: [
            {
              // eslint-disable-next-line @nx/enforce-module-boundaries
              loader: require.resolve(
                '@nx/angular-rspack/loaders/angular-partial-transform-loader'
              ),
            },
          ],
        },
      ],
    },
    plugins: [
      ...sourceMapOptions.sourceMapPlugins,
      ...(normalizedOptions.verbose ? [new WatchFilesLogsPlugin()] : []),
      ...(normalizedOptions.watch ? [indexInputWatchPlugin] : []),
      ...(normalizedOptions.statsJson
        ? [
            new StatsJsonPlugin(
              resolve(
                normalizedOptions.root,
                normalizedOptions.outputPath.base,
                'stats.json'
              )
            ),
          ]
        : []),
      ...(i18n.shouldInline
        ? [
            {
              apply(compiler) {
                compiler.hooks.compilation.tap(
                  'AngularRspackPlugin',
                  (compilation) => {
                    // Resolve from the live compiler: the statically imported
                    // copy can be a different @rspack/core major than the one
                    // running the build, and getCompilationHooks rejects
                    // foreign Compilation instances.
                    compiler.rspack.javascript.JavascriptModulesPlugin.getCompilationHooks(
                      compilation
                    ).chunkHash.tap('AngularRspackPlugin', (_, hash) => {
                      hash.update(Buffer.from('$localize' + i18nHash));
                    });
                  }
                );
              },
            },
          ]
        : []),
      ...stylesConfig.plugins,
    ],
  };
  // TODO(v24): drop once @rspack/core v1 is out of the support window.
  // v2 removed top-level `profile`; Rsdoctor replaces it.
  if (normalizedOptions.statsJson && !isRspackV2()) {
    (defaultConfig as { profile?: boolean }).profile = true;
  }
  return defaultConfig;
}
