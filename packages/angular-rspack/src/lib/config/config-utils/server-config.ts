import type { SwcTranspilationTransform } from '@nx/angular-rspack-compiler';
import {
  type Configuration,
  ContextReplacementPlugin,
  DefinePlugin,
} from '@rspack/core';
import { resolve } from 'path';
import type {
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { NgRspackPlugin } from '../../plugins/ng-rspack';
import type { AngularRspackPlugin } from '../../plugins/angular-rspack-plugin';
import type { SharedLicenseInputs } from '../../plugins/extract-licenses-plugin';
import { PrerenderPlugin } from '../../plugins/prerender-plugin';
import { isPackageInstalled } from '../../utils/misc-helpers';
import { getDevServerConfig } from './dev-server-config-utils';
import { getOptimization } from './optimization-config';
import { getSwcTranspilationRules } from './swc-transpilation';
import { isServeMode } from '../../utils/rspack-serve-env';

export async function getServerConfig(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  defaultConfig: Configuration,
  swcTranspilationTransform: SwcTranspilationTransform,
  sharedLicenseInputs?: SharedLicenseInputs,
  sharedAngularPlugin?: AngularRspackPlugin
): Promise<Configuration> {
  const isDevServer = isServeMode();
  const { root } = normalizedOptions;

  return {
    ...defaultConfig,
    dependencies: ['browser'],
    name: 'server',
    target: ['node', 'es2015'],
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
    resolve: {
      ...defaultConfig.resolve,
      mainFields: ['es2020', 'es2015', 'module', 'main'],
    },
    devServer: await getDevServerConfig(normalizedOptions, 'server'),
    externals: normalizedOptions.externalDependencies,
    optimization: getOptimization(normalizedOptions, 'server'),
    module: {
      ...defaultConfig.module,
      rules: [
        ...getSwcTranspilationRules(swcTranspilationTransform),
        {
          // eslint-disable-next-line @nx/enforce-module-boundaries
          loader: require.resolve(
            '@nx/angular-rspack/loaders/platform-server-exports-loader'
          ),
          include: [
            resolve(root, (normalizedOptions.ssr as { entry: string }).entry),
          ],
          options: {
            angularSSRInstalled: isPackageInstalled(root, '@angular/ssr'),
            isZoneJsInstalled: isPackageInstalled(root, 'zone.js'),
          },
        },
        ...(defaultConfig.module?.rules ?? []),
      ],
    },
    plugins: [
      ...(defaultConfig.plugins ?? []),
      // Fixes Critical dependency: the request of a dependency is an expression
      new ContextReplacementPlugin(/@?hapi|express[\\/]/),
      // rspack inlines `import.meta.url` as the source file's URL, breaking
      // the `isMainModule` listen gate; point it at the emitted bundle.
      new DefinePlugin({
        'import.meta.url': "require('node:url').pathToFileURL(__filename).href",
      }),
      new NgRspackPlugin(normalizedOptions, {
        i18nOptions: i18n,
        platform: 'server',
        sharedLicenseInputs,
        sharedAngularPlugin,
      }),
      ...(normalizedOptions.prerender ||
      (normalizedOptions.appShell && !isDevServer)
        ? [new PrerenderPlugin(normalizedOptions, i18n)]
        : []),
    ],
  };
}
