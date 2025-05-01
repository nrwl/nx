import type { Configuration, DevServer } from '@rspack/core';
import { resolve } from 'path';
import { getPolyfillsEntry, toRspackEntries } from './entry-points';
import {
  getAllowedHostsConfig,
  getProxyConfig,
} from './dev-server-config-utils';
import { getOptimization } from './optimization-config';
import { NgRspackPlugin } from '../../plugins/ng-rspack';
import {
  HashFormat,
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import { TS_ALL_EXT_REGEX } from '@nx/angular-rspack-compiler';

export async function getBrowserConfig(
  root: string,
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  hashFormat: HashFormat,
  defaultConfig: Configuration
): Promise<Configuration> {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const isDevServer = !!process.env['WEBPACK_SERVE'];

  return {
    ...defaultConfig,
    name: 'browser',
    ...(normalizedOptions.hasServer && isDevServer
      ? { dependencies: ['server'] }
      : {}),
    target: 'web',
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
      host: normalizedOptions.devServer.host,
      port: normalizedOptions.devServer.port,
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
      onListening: (devServer) => {
        if (!devServer) {
          throw new Error('@rspack/dev-server is not defined');
        }

        const port =
          (devServer.server?.address() as { port: number })?.port ??
          normalizedOptions.devServer.port;
        console.log('Listening on port:', port);
      },
    } as DevServer,

    output: {
      ...defaultConfig.output,
      hashFunction: isProduction ? 'xxhash64' : undefined,
      path: normalizedOptions.outputPath.browser,
      cssFilename: `[name]${hashFormat.file}.css`,
      filename: `[name]${hashFormat.chunk}.js`,
      chunkFilename: `[name]${hashFormat.chunk}.js`,
      scriptType: 'module',
      module: true,
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
        ...(defaultConfig.module?.rules ?? []),
      ],
    },
    plugins: [
      ...(defaultConfig.plugins ?? []),
      new NgRspackPlugin(normalizedOptions, {
        i18nOptions: i18n,
        platform: 'browser',
      }),
    ],
  };
}
