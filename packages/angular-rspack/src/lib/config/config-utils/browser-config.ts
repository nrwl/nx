import { TS_ALL_EXT_REGEX } from '@nx/angular-rspack-compiler';
import type { Configuration } from '@rspack/core';
import { isRspackV2 } from '../../utils/rspack-version';
import { isServeMode } from '../../utils/rspack-serve-env';
import type {
  HashFormat,
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { NgRspackPlugin } from '../../plugins/ng-rspack';
import type { SharedLicenseInputs } from '../../plugins/extract-licenses-plugin';
import { getDevServerConfig } from './dev-server-config-utils';
import { getPolyfillsEntry, toRspackEntries } from './entry-points';
import { getOptimization } from './optimization-config';
import { resolve } from 'path';
import { HmrLoader } from '../../plugins/loaders/hmr-accept-loader';

export async function getBrowserConfig(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  hashFormat: HashFormat,
  defaultConfig: Configuration,
  sharedLicenseInputs?: SharedLicenseInputs
): Promise<Configuration> {
  const isDevServer = isServeMode();
  const isProduction = process.env['NODE_ENV'] === 'production';
  const { root } = normalizedOptions;

  return {
    ...defaultConfig,
    name: 'browser',
    target: ['web', 'es2015'],
    entry: {
      main: {
        import: [
          ...(i18n.shouldInline ? ['@angular/localize/init'] : []),
          normalizedOptions.browser,
        ],
      },
      ...getPolyfillsEntry(normalizedOptions.polyfills, normalizedOptions.aot),
      ...toRspackEntries(
        normalizedOptions.globalStyles,
        normalizedOptions.root,
        'ngGlobalStyles'
      ),
      ...toRspackEntries(
        normalizedOptions.globalScripts,
        normalizedOptions.root
      ),
    },
    devServer: await getDevServerConfig(normalizedOptions, 'browser'),
    output: {
      ...defaultConfig.output,
      hashFunction: isProduction ? 'xxhash64' : undefined,
      path: normalizedOptions.outputPath.browser,
      cssFilename: `[name]${hashFormat.file}.css`,
      filename: `[name]${hashFormat.chunk}.js`,
      chunkFilename: `[name]${hashFormat.chunk}.js`,
      ...(isDevServer
        ? {}
        : {
            scriptType: 'module',
            module: true,
            chunkFormat: 'module',
            chunkLoading: 'import',
            workerChunkLoading: 'import',
          }),
    },
    // v2 folded experiments.outputModule into top-level output.module.
    experiments:
      isDevServer || isRspackV2()
        ? {}
        : ({ outputModule: true } as unknown as Configuration['experiments']),
    resolve: {
      ...defaultConfig.resolve,
      mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
    },
    optimization: getOptimization(normalizedOptions, 'browser'),
    module: {
      ...defaultConfig.module,
      rules: [
        {
          test: TS_ALL_EXT_REGEX,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                  },
                  target: 'es2022',
                },
              },
            },
          ],
        },
        ...(normalizedOptions.devServer?.hmr
          ? [
              {
                loader: HmrLoader,
                include: [resolve(root, normalizedOptions.browser)],
              },
            ]
          : []),
        ...(defaultConfig.module?.rules ?? []),
      ],
    },
    plugins: [
      ...(defaultConfig.plugins ?? []),
      new NgRspackPlugin(normalizedOptions, {
        i18nOptions: i18n,
        platform: 'browser',
        sharedLicenseInputs,
      }),
    ],
  };
}
