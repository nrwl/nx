import {
  BuilderContext,
  createBuilder,
  targetFromTargetString
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';

import { Observable, from, forkJoin } from 'rxjs';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { map, switchMap, tap } from 'rxjs/operators';
import { WebBuildBuilderOptions } from '../build/build.impl';
import { Configuration } from 'webpack';
import { writeFileSync } from 'fs';
import * as opn from 'opn';
import * as url from 'url';
import { resolve } from 'path';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { getDevServerConfig } from '../../utils/devserver.config';
import { buildServePath } from '../../utils/serve-path';
import { getSourceRoot } from '../../utils/source-root';
import {
  runWebpackDevServer,
  DevServerBuildOutput
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
          configuration: serveOptions.buildTarget.split(':')[2]
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
        hostname:
          serveOptions.host === '0.0.0.0' ? 'localhost' : serveOptions.host,
        port: serveOptions.port.toString(),
        path: path
      });

      context.logger.info(stripIndents`
            **
            Web Development Server is listening at ${serverUrl}
            **
          `);
      if (serveOptions.open) {
        opn(serverUrl, {
          wait: false
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
        logging: stats => {
          if (options.statsJson) {
            writeFileSync(
              resolve(context.workspaceRoot, options.outputPath, 'stats.json'),
              JSON.stringify(stats.toJson(), null, 2)
            );
          }

          context.logger.info(stats.toString());
        }
      }).pipe(
        map(output => {
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
  return from(
    Promise.all([
      context.getTargetOptions(target),
      context.getBuilderNameForTarget(target)
    ]).then(([options, builderName]) =>
      context.validateOptions<WebBuildBuilderOptions & JsonObject>(
        options,
        builderName
      )
    )
  );
}
