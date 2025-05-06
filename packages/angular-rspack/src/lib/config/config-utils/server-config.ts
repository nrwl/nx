import { TS_ALL_EXT_REGEX } from '@nx/angular-rspack-compiler';
import { type Configuration, ContextReplacementPlugin } from '@rspack/core';
import { resolve } from 'path';
import type {
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { NgRspackPlugin } from '../../plugins/ng-rspack';
import { PrerenderPlugin } from '../../plugins/prerender-plugin';
import { isPackageInstalled } from '../../utils/misc-helpers';
import { getDevServerConfig } from './dev-server-config-utils';
import { getOptimization } from './optimization-config';

export async function getServerConfig(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  defaultConfig: Configuration
): Promise<Configuration> {
  const isDevServer = !!process.env['WEBPACK_SERVE'];
  const { root } = normalizedOptions;

  return {
    ...defaultConfig,
    dependencies: ['browser'],
    name: 'server',
    target: 'node',
    entry: {
      server: {
        import: [
          ...(isPackageInstalled(root, '@angular/platform-server')
            ? // This import must come before any imports (direct or transitive) that rely on DOM built-ins being
              // available, such as `@angular/elements`.
              ['@angular/platform-server/init']
            : []),
          ...(i18n.shouldInline ? ['@angular/localize/init'] : []),
          (normalizedOptions.ssr as { entry: string }).entry,
        ],
      },
    },
    output: {
      ...defaultConfig.output,
      path: normalizedOptions.outputPath.server,
      filename: '[name].js',
      chunkFilename: '[name].js',
      library: { type: 'commonjs' },
    },
    devServer: await getDevServerConfig(normalizedOptions, 'server'),
    externals: normalizedOptions.externalDependencies,
    optimization: getOptimization(normalizedOptions, 'server'),
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
        {
          loader: require.resolve(
            '@nx/angular-rspack/loaders/platform-server-exports-loader'
          ),
          include: [
            resolve(root, (normalizedOptions.ssr as { entry: string }).entry),
          ],
          options: {
            angularSSRInstalled: isPackageInstalled(root, '@angular/ssr'),
          },
        },
        ...(defaultConfig.module?.rules ?? []),
      ],
    },
    plugins: [
      ...(defaultConfig.plugins ?? []),
      // Fixes Critical dependency: the request of a dependency is an expression
      new ContextReplacementPlugin(/@?hapi|express[\\/]/),
      new NgRspackPlugin(normalizedOptions, {
        i18nOptions: i18n,
        platform: 'server',
      }),
      ...(normalizedOptions.prerender && !isDevServer
        ? [new PrerenderPlugin(normalizedOptions, i18n)]
        : []),
    ],
  };
}
