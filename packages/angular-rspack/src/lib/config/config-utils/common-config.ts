import { type Compiler, type Configuration, javascript } from '@rspack/core';
import { join, resolve } from 'node:path';
import {
  JS_ALL_EXT_REGEX,
  TS_ALL_EXT_REGEX,
} from '@nx/angular-rspack-compiler';
import {
  HashFormat,
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { getStylesConfig } from './style-config-utils';
import { getCrossOriginLoading } from './helpers';
import { configureSourceMap } from './sourcemap-utils';
import { StatsJsonPlugin } from '../../plugins/stats-json-plugin';
import { WatchFilesLogsPlugin } from '../../plugins/watch-file-logs-plugin';
import { getIndexInputFile } from '../../utils/index-file/get-index-input-file';

export async function getCommonConfig(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  i18nHash: string | (() => void),
  hashFormat: HashFormat
) {
  const isDevServer = process.env['WEBPACK_SERVE'];
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
    profile: normalizedOptions.statsJson,
    mode:
      normalizedOptions.optimization.scripts ||
      normalizedOptions.optimization.styles.minify
        ? 'production'
        : 'development',
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
      modules: ['node_modules'],
      conditionNames: ['es2020', 'es2015', '...'],
      tsConfig: {
        configFile: normalizedOptions.tsConfig,
      },
      ...(i18n.shouldInline && normalizedOptions.aot
        ? { alias: { '@angular/localize/init': false } }
        : {}),
    },
    resolveLoader: {
      symlinks: !normalizedOptions.preserveSymlinks,
    },
    watch: normalizedOptions.watch,
    watchOptions: {
      poll: normalizedOptions.poll,
      followSymlinks: normalizedOptions.preserveSymlinks,
      ignored:
        normalizedOptions.poll === undefined ? undefined : '**/node_modules/**',
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
                    javascript.JavascriptModulesPlugin.getCompilationHooks(
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
  return defaultConfig;
}
