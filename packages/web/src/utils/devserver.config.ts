import { logger } from '@nrwl/devkit';
import { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

import * as opn from 'opn';
import * as url from 'url';
import { readFileSync } from 'fs';
import * as path from 'path';

import { getWebConfig } from './web.config';
import { Configuration } from 'webpack';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { WebDevServerOptions } from '../builders/dev-server/dev-server.impl';
import { buildServePath } from './serve-path';
import { OptimizationOptions } from './types';

export function getDevServerConfig(
  root: string,
  sourceRoot: string,
  buildOptions: WebBuildBuilderOptions,
  serveOptions: WebDevServerOptions
) {
  const webpackConfig: Configuration = getWebConfig(
    root,
    sourceRoot,
    buildOptions,
    true, // Don't need to support legacy browsers for dev.
    false
  );
  (webpackConfig as any).devServer = getDevServerPartial(
    root,
    serveOptions,
    buildOptions
  );

  return webpackConfig;
}

function getDevServerPartial(
  root: string,
  options: WebDevServerOptions,
  buildOptions: WebBuildBuilderOptions
): WebpackDevServerConfiguration {
  const servePath = buildServePath(buildOptions);

  const {
    scripts: scriptsOptimization,
    styles: stylesOptimization,
  } = buildOptions.optimization as OptimizationOptions;

  const config: WebpackDevServerConfiguration = {
    host: options.host,
    port: options.port,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: {
      index: `${servePath}/${path.basename(buildOptions.index)}`,
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
    noInfo: true,
    onListening(server: any) {
      // Depend on the info in the server for this function because the user might adjust the webpack config
      const serverUrl = url.format({
        protocol: server.options.https ? 'https' : 'http',
        hostname: server.hostname,
        port: server.listeningApp.address().port,
        pathname: buildServePath(buildOptions),
      });

      logger.info(`NX Web Development Server is listening at ${serverUrl}`);
      if (options.open) {
        opn(serverUrl, {
          wait: false,
        });
      }
    },
    stats: false,
    compress: scriptsOptimization || stylesOptimization,
    https: options.ssl,
    overlay: {
      errors: !(scriptsOptimization || stylesOptimization),
      warnings: false,
    },
    watchOptions: {
      poll: buildOptions.poll,
    },
    public: options.publicHost,
    publicPath: servePath,
    contentBase: false,
    allowedHosts: [],
    liveReload: options.liveReload,
  };

  if (options.ssl && options.sslKey && options.sslCert) {
    config.https = getSslConfig(root, options);
  }

  if (options.proxyConfig) {
    config.proxy = getProxyConfig(root, options);
  }

  if (options.allowedHosts) {
    config.allowedHosts = options.allowedHosts.split(',');
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
