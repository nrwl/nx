import { logger } from '@nx/devkit';
import type { Configuration as RspackDevServerConfiguration } from '@rspack/dev-server';
import { readFileSync } from 'fs';
import * as path from 'path';
import { RspackExecutorSchema } from '../../rspack/schema';
import { DevServerExecutorSchema } from '../schema';
import { buildServePath } from './serve-path';

export function getDevServerOptions(
  root: string,
  serveOptions: DevServerExecutorSchema,
  buildOptions: RspackExecutorSchema
): RspackDevServerConfiguration {
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

  const config: RspackDevServerConfiguration = {
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
    onListening(server) {
      const isHttps =
        server.options.https ||
        (server.options.server as { type: string })?.type === 'https';
      logger.info(
        `NX Web Development Server is listening at ${
          isHttps ? 'https' : 'http'
        }://${server.options.host}:${server.options.port}${buildServePath(
          buildOptions
        )}`
      );
    },
    open: false,
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
    hot: true,
  };

  if (serveOptions.ssl) {
    config.server = {
      type: 'https',
    };
    if (serveOptions.sslKey && serveOptions.sslCert) {
      config.server.options = getSslConfig(root, serveOptions);
    }
  }

  return config;
}

function getSslConfig(root: string, options: DevServerExecutorSchema) {
  return {
    key: readFileSync(path.resolve(root, options.sslKey), 'utf-8'),
    cert: readFileSync(path.resolve(root, options.sslCert), 'utf-8'),
  };
}
