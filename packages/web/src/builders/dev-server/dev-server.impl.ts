import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import { Configuration } from 'webpack';

import { eachValueFrom } from 'rxjs-for-await';
import { map, tap } from 'rxjs/operators';
import { runWebpackDevServer } from '@nrwl/workspace/src/utilities/run-webpack';

import { normalizeWebBuildOptions } from '../../utils/normalize';
import { WebBuildBuilderOptions } from '../build/build.impl';
import { getDevServerConfig } from '../../utils/devserver.config';

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
  allowedHosts: string;
  maxWorkers?: number;
  memoryLimit?: number;
  baseHref?: string;
}

export default function devServerExecutor(
  serveOptions: WebDevServerOptions,
  context: ExecutorContext
) {
  const sourceRoot = context.workspace.projects[context.projectName].sourceRoot;
  const buildOptions = normalizeWebBuildOptions(
    getBuildOptions(serveOptions, context),
    context.root,
    sourceRoot
  );
  let webpackConfig: Configuration = getDevServerConfig(
    context.root,
    sourceRoot,
    buildOptions,
    serveOptions
  );
  if (buildOptions.webpackConfig) {
    webpackConfig = require(buildOptions.webpackConfig)(webpackConfig, {
      buildOptions,
      configuration: serveOptions.buildTarget.split(':')[2],
    });
  }

  return eachValueFrom(
    runWebpackDevServer(webpackConfig).pipe(
      tap(({ stats }) => {
        console.info(stats.toString(webpackConfig.stats));
      }),
      map(({ baseUrl, stats }) => {
        return {
          stats,
          baseUrl,
          success: !stats.hasErrors(),
        };
      })
    )
  );
}

function getBuildOptions(
  options: WebDevServerOptions,
  context: ExecutorContext
): WebBuildBuilderOptions {
  const target = parseTargetString(options.buildTarget);
  const overrides: Partial<WebBuildBuilderOptions> = {
    watch: false,
  };
  if (options.maxWorkers) {
    overrides.maxWorkers = options.maxWorkers;
  }
  if (options.memoryLimit) {
    overrides.memoryLimit = options.memoryLimit;
  }
  if (options.baseHref) {
    overrides.baseHref = options.baseHref;
  }

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
    ...overrides,
  };
}
