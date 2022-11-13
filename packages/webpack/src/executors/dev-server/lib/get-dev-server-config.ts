import { ExecutorContext, logger } from '@nrwl/devkit';
import type { Configuration as WebpackConfiguration } from 'webpack';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';
import * as path from 'path';
import { basename, resolve } from 'path';

import { getWebpackConfig } from '../../webpack/lib/get-webpack-config';
import { WebDevServerOptions } from '../schema';
import { buildServePath } from './serve-path';
import { readFileSync } from 'fs-extra';
import { generateEntryPoints } from '../../../utils//webpack/package-chunk-sort';
import { IndexHtmlWebpackPlugin } from '../../../utils/webpack/plugins/index-html-webpack-plugin';
import { NormalizedWebpackExecutorOptions } from '../../webpack/schema';

export function getDevServerConfig(
  context: ExecutorContext,
  buildOptions: NormalizedWebpackExecutorOptions,
  serveOptions: WebDevServerOptions
): Partial<WebpackConfiguration> {
  const workspaceRoot = context.root;
  const { root: projectRoot, sourceRoot } =
    context.workspace.projects[context.projectName];
  const webpackConfig = getWebpackConfig(
    context,
    buildOptions,
    true,
    typeof buildOptions.optimization === 'boolean'
      ? buildOptions.optimization
      : buildOptions.optimization?.scripts
  );

  (webpackConfig as any).devServer = getDevServerPartial(
    workspaceRoot,
    serveOptions,
    buildOptions
  );

  const {
    deployUrl,
    subresourceIntegrity,
    scripts = [],
    styles = [],
    index,
    baseHref,
  } = buildOptions;

  webpackConfig.plugins.push(
    new IndexHtmlWebpackPlugin({
      indexPath: resolve(workspaceRoot, index),
      outputPath: basename(index),
      baseHref,
      entrypoints: generateEntryPoints({ scripts, styles }),
      deployUrl,
      sri: subresourceIntegrity,
      moduleEntrypoints: [],
      noModuleEntrypoints: ['polyfills-es5'],
    })
  );

  return webpackConfig as WebpackConfiguration;
}

function getDevServerPartial(
  root: string,
  options: WebDevServerOptions,
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
    host: options.host,
    port: options.port,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: {
      index: `${servePath}${path.basename(buildOptions.index)}`,
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
    onListening(server: any) {
      logger.info(
        `NX Web Development Server is listening at ${
          server.options.server.type === 'http' ? 'http' : 'https'
        }://${server.options.host}:${server.options.port}${buildServePath(
          buildOptions
        )}`
      );
    },
    open: options.open,
    static: false,
    compress: scriptsOptimization || stylesOptimization,
    devMiddleware: {
      publicPath: servePath,
      stats: false,
    },
    client: {
      webSocketURL: options.publicHost,
      overlay: {
        errors: !(scriptsOptimization || stylesOptimization),
        warnings: false,
      },
    },
    liveReload: options.hmr ? false : options.liveReload, // disable liveReload if hmr is enabled
    hot: options.hmr,
  };

  if (options.ssl) {
    config.server = {
      type: 'https',
    };
    if (options.sslKey && options.sslCert) {
      config.server.options = getSslConfig(root, options);
    }
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
