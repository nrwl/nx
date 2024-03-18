import { logger } from '@nx/devkit';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';
import * as path from 'path';
import { readFileSync } from 'fs';
import { WebDevServerOptions } from '../schema';
import { buildServePath } from './serve-path';
import { NormalizedWebpackExecutorOptions } from '../../webpack/schema';

export function getDevServerOptions(
  root: string,
  serveOptions: WebDevServerOptions,
  buildOptions: NormalizedWebpackExecutorOptions
): WebpackDevServerConfiguration {
  const servePath = buildServePath(buildOptions);

  let scriptsOptimization: boolean;
  let stylesOptimization: boolean;
  if (typeof buildOptions.optimization === 'boolean') {
    scriptsOptimization = stylesOptimization = buildOptions.optimization;
  } else if (buildOptions.optimization) {
    scriptsOptimization = buildOptions.optimization.scripts;
    stylesOptimization = buildOptions.optimization.styles;
  } else {
    scriptsOptimization = stylesOptimization = false;
  }

  const config: WebpackDevServerConfiguration = {
    host: serveOptions.host,
    port: serveOptions.port,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: {
      index:
        buildOptions.index &&
        `${servePath}${path.basename(buildOptions.index)}`,
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
    onListening(server: any) {
      const isHttps =
        server.options.https || server.options.server?.type === 'https';
      logger.info(
        `NX Web Development Server is listening at ${
          isHttps ? 'https' : 'http'
        }://${server.options.host}:${server.options.port}${buildServePath(
          buildOptions
        )}`
      );
    },
    open: serveOptions.open,
    static: false,
    compress: scriptsOptimization || stylesOptimization,
    devMiddleware: {
      publicPath: servePath,
      stats: false,
    },
    client: {
      webSocketURL: serveOptions.publicHost,
      overlay: {
        errors: !(scriptsOptimization || stylesOptimization),
        warnings: false,
      },
    },
    liveReload: serveOptions.hmr ? false : serveOptions.liveReload, // disable liveReload if hmr is enabled
    hot: serveOptions.hmr,
  };

  if (serveOptions.ssl) {
    config.server = {
      type: 'https',
    };
    if (serveOptions.sslKey && serveOptions.sslCert) {
      config.server.options = getSslConfig(root, serveOptions);
    }
  }

  if (serveOptions.proxyConfig) {
    config.proxy = getProxyConfig(root, serveOptions);
  }

  if (serveOptions.allowedHosts) {
    config.allowedHosts = serveOptions.allowedHosts.split(',');
  }

  return config;
}

function getSslConfig(root: string, options: WebDevServerOptions) {
  return {
    key: readFileSync(path.resolve(root, options.sslKey), 'utf-8'),
    cert: readFileSync(path.resolve(root, options.sslCert), 'utf-8'),
  };
}

function getProxyConfig(root: string, options: WebDevServerOptions) {
  const proxyPath = path.resolve(root, options.proxyConfig as string);
  return require(proxyPath);
}
