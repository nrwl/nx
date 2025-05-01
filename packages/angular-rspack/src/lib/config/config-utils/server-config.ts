import { Configuration, ContextReplacementPlugin } from '@rspack/core';
import { resolve } from 'path';
import {
  getAllowedHostsConfig,
  getProxyConfig,
} from './dev-server-config-utils';
import { getOptimization } from './optimization-config';
import { isPackageInstalled } from '../../utils/misc-helpers';
import { NgRspackPlugin } from '../../plugins/ng-rspack';
import {
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { TS_ALL_EXT_REGEX } from '@nx/angular-rspack-compiler';
import { PrerenderPlugin } from '../../plugins/prerender-plugin';

export async function getServerConfig(
  root: string,
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  defaultConfig: Configuration
): Promise<Configuration> {
  return {
    ...defaultConfig,
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
    devServer: {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      allowedHosts: getAllowedHostsConfig(
        normalizedOptions.devServer.allowedHosts,
        normalizedOptions.devServer.disableHostCheck
      ),
      client: {
        webSocketURL: {
          hostname: normalizedOptions.devServer.host,
          port: normalizedOptions.devServer.port,
        },
        overlay: {
          errors: true,
          warnings: false,
          runtimeErrors: true,
        },
        reconnect: true,
      },
      host: normalizedOptions.devServer.host,
      port: normalizedOptions.devServer.port,
      hot: false,
      liveReload: true,
      watchFiles: ['./src/**/*.*', './public/**/*.*'],
      historyApiFallback: {
        index: '/index.html',
        rewrites: [{ from: /^\/$/, to: 'index.html' }],
      },
      devMiddleware: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
      },
      server: {
        options:
          normalizedOptions.devServer.sslKey &&
          normalizedOptions.devServer.sslCert
            ? {
                key: resolve(root, normalizedOptions.devServer.sslKey),
                cert: resolve(root, normalizedOptions.devServer.sslCert),
              }
            : {},
        type: normalizedOptions.devServer.ssl ? 'https' : 'http',
      },
      proxy: await getProxyConfig(
        root,
        normalizedOptions.devServer.proxyConfig
      ),
    },
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
      ...(normalizedOptions.prerender
        ? [new PrerenderPlugin(normalizedOptions, i18n)]
        : []),
    ],
  };
}
