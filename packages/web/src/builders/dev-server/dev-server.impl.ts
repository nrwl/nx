import {
  BuilderContext,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';

import { Observable, from, forkJoin } from 'rxjs';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { map, switchMap } from 'rxjs/operators';
import { WebBuildBuilderOptions } from '../build/build.impl';
import { Configuration } from 'webpack';
import * as opn from 'opn';
import * as url from 'url';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { getDevServerConfig } from '../../utils/devserver.config';
import { buildServePath } from '../../utils/serve-path';
import { getSourceRoot } from '../../utils/source-root';
import {
  runWebpackDevServer,
  DevServerBuildOutput,
} from '@angular-devkit/build-webpack';

export interface WebDevServerOptions extends JsonObject {
  host: string;
  port: number;
  publicHost?: string;
  ssl: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
  buildTarget: string;
  open: boolean;
  liveReload: boolean;
  watch: boolean;
  allowedHosts: string;
  maxWorkers?: number;
  memoryLimit?: number;
}

export default createBuilder<WebDevServerOptions>(run);

function run(
  serveOptions: WebDevServerOptions,
  context: BuilderContext
): Observable<DevServerBuildOutput> {
  return forkJoin(
    getBuildOptions(serveOptions, context),
    from(getSourceRoot(context))
  ).pipe(
    map(([buildOptions, sourceRoot]) => {
      buildOptions = normalizeWebBuildOptions(
        buildOptions,
        context.workspaceRoot,
        sourceRoot
      );
      let webpackConfig: Configuration = getDevServerConfig(
        context.workspaceRoot,
        sourceRoot,
        buildOptions,
        serveOptions,
        context.logger
      );
      if (buildOptions.webpackConfig) {
        webpackConfig = require(buildOptions.webpackConfig)(webpackConfig, {
          buildOptions,
          configuration: serveOptions.buildTarget.split(':')[2],
        });
      }
      return [webpackConfig, buildOptions] as [
        Configuration,
        WebBuildBuilderOptions
      ];
    }),
    map(([_, options]) => {
      const path = buildServePath(options);
      const serverUrl = url.format({
        protocol: serveOptions.ssl ? 'https' : 'http',
        hostname: serveOptions.host,
        port: serveOptions.port.toString(),
        pathname: path,
      });

      context.logger.info(stripIndents`
            **
            Web Development Server is listening at ${serverUrl}
            **
          `);
      if (serveOptions.open) {
        opn(serverUrl, {
          wait: false,
        });
      }
      return [_, options, serverUrl] as [
        Configuration,
        WebBuildBuilderOptions,
        string
      ];
    }),
    switchMap(([config, options, serverUrl]) => {
      return runWebpackDevServer(config, context, {
        logging: (stats) => {
          context.logger.info(stats.toString(config.stats));
        },
        webpackFactory: require('webpack'),
        webpackDevServerFactory: require('webpack-dev-server'),
      }).pipe(
        map((output) => {
          output.baseUrl = serverUrl;
          return output;
        })
      );
    })
  );
}

function getBuildOptions(
  options: WebDevServerOptions,
  context: BuilderContext
): Observable<WebBuildBuilderOptions> {
  const target = targetFromTargetString(options.buildTarget);
  const overrides: Partial<WebBuildBuilderOptions> = {};
  if (options.maxWorkers) {
    overrides.maxWorkers = options.maxWorkers;
  }
  if (options.memoryLimit) {
    overrides.memoryLimit = options.memoryLimit;
  }
  return from(
    Promise.all([
      context.getTargetOptions(target),
      context.getBuilderNameForTarget(target),
    ])
      .then(([options, builderName]) =>
        context.validateOptions<WebBuildBuilderOptions & JsonObject>(
          options,
          builderName
        )
      )
      .then((options) => ({
        ...options,
        ...overrides,
      }))
  );
}
