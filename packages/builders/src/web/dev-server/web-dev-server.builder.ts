import {
  Builder,
  BuildEvent,
  BuilderConfiguration,
  BuilderContext
} from '@angular-devkit/architect';
import { getSystemPath } from '@angular-devkit/core';
import { WebpackDevServerBuilder } from '@angular-devkit/build-webpack';

import { Observable } from 'rxjs';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { getDevServerConfig } from '../../utils/webpack/devserver.config';
import { concatMap, map, switchMap, tap } from 'rxjs/operators';
import { WebBuildBuilderOptions } from '../build/web-build.builder';
import { Configuration } from 'webpack';
import { writeFileSync } from 'fs';
import * as opn from 'opn';
import * as url from 'url';
import { resolve } from 'path';
import { buildServePath } from '../../utils/serve-path';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

export interface WebDevServerOptions {
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

export default class WebDevServerBuilder
  implements Builder<WebDevServerOptions> {
  webpackDevServerBuilder = new WebpackDevServerBuilder(this.context);

  root: string;

  constructor(private context: BuilderContext) {
    this.root = getSystemPath(this.context.workspace.root);
  }

  run(
    builderConfig: BuilderConfiguration<WebDevServerOptions>
  ): Observable<BuildEvent> {
    const serveOptions = builderConfig.options;
    return this.getBuildOptions(serveOptions).pipe(
      map(buildOptions => {
        buildOptions = normalizeWebBuildOptions(
          buildOptions,
          this.root,
          builderConfig.sourceRoot
        );
        let webpackConfig: Configuration = getDevServerConfig(
          buildOptions,
          serveOptions,
          this.context.logger
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
      tap(([_, options]) => {
        const path = buildServePath(options);
        const serverUrl = url.format({
          protocol: serveOptions.ssl ? 'https' : 'http',
          hostname:
            serveOptions.host === '0.0.0.0' ? 'localhost' : serveOptions.host,
          port: serveOptions.port.toString(),
          path: path
        });

        this.context.logger.info(stripIndents`
            **
            Web Development Server is listening at ${serverUrl}
            **
          `);
        if (serveOptions.open) {
          opn(serverUrl, {
            wait: false
          });
        }
      }),
      switchMap(([config, options]) => {
        return this.webpackDevServerBuilder.runWebpackDevServer(
          config,
          undefined,
          stats => {
            if (options.statsJson) {
              writeFileSync(
                resolve(this.root, options.outputPath, 'stats.json'),
                JSON.stringify(stats.toJson(), null, 2)
              );
            }

            this.context.logger.info(stats.toString());
          }
        );
      })
    );
  }

  private getBuildOptions(options: WebDevServerOptions) {
    const builderConfig = this.getBuildBuilderConfig(options);

    return this.context.architect.getBuilderDescription(builderConfig).pipe(
      concatMap(buildDescription =>
        this.context.architect.validateBuilderOptions(
          builderConfig,
          buildDescription
        )
      ),
      map(builderConfig => builderConfig.options)
    );
  }

  private getBuildBuilderConfig(options: WebDevServerOptions) {
    const [project, target, configuration] = options.buildTarget.split(':');

    return this.context.architect.getBuilderConfiguration<
      WebBuildBuilderOptions
    >({
      project,
      target,
      configuration,
      overrides: {
        watch: options.watch
      }
    });
  }
}
