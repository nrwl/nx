import * as webpack from 'webpack';
import {
  ExecutorContext,
  joinPathFragments,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';

import { eachValueFrom } from 'rxjs-for-await';
import { map, tap } from 'rxjs/operators';
import * as WebpackDevServer from 'webpack-dev-server';

import { normalizeWebBuildOptions } from '../../utils/normalize';
import { WebWebpackExecutorOptions } from '../webpack/webpack.impl';
import { getDevServerConfig } from '../../utils/devserver.config';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { getEmittedFiles, runWebpackDevServer } from '../../utils/run-webpack';
import { tsNodeRegister } from '../../utils/webpack/tsNodeRegister';

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
  hmr: boolean;
  watch: boolean;
  allowedHosts: string;
  maxWorkers?: number;
  memoryLimit?: number;
  baseHref?: string;
}

export default async function* devServerExecutor(
  serveOptions: WebDevServerOptions,
  context: ExecutorContext
) {
  const { root: projectRoot, sourceRoot } =
    context.workspace.projects[context.projectName];
  const buildOptions = normalizeWebBuildOptions(
    getBuildOptions(serveOptions, context),
    context.root,
    sourceRoot
  );
  let webpackConfig = getDevServerConfig(
    context.root,
    projectRoot,
    sourceRoot,
    buildOptions,
    serveOptions
  );

  if (buildOptions.webpackConfig) {
    const customWebpack = resolveCustomWebpackConfig(
      buildOptions.webpackConfig,
      buildOptions.tsConfig
    );

    webpackConfig = customWebpack(webpackConfig, {
      buildOptions,
      configuration: serveOptions.buildTarget.split(':')[2],
    });
  }

  if (!buildOptions.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.root,
      context.projectName,
      'build', // should be generalized
      context.configurationName
    );
    buildOptions.tsConfig = createTmpTsConfig(
      joinPathFragments(context.root, buildOptions.tsConfig),
      context.root,
      target.data.root,
      dependencies
    );
  }

  return yield* eachValueFrom(
    runWebpackDevServer(webpackConfig, webpack, WebpackDevServer).pipe(
      tap(({ stats }) => {
        console.info(stats.toString(webpackConfig.stats));
      }),
      map(({ baseUrl, stats }) => {
        return {
          baseUrl,
          emittedFiles: getEmittedFiles(stats),
          success: !stats.hasErrors(),
        };
      })
    )
  );
}

function getBuildOptions(
  options: WebDevServerOptions,
  context: ExecutorContext
): WebWebpackExecutorOptions {
  const target = parseTargetString(options.buildTarget);
  const overrides: Partial<WebWebpackExecutorOptions> = {
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

function resolveCustomWebpackConfig(path: string, tsConfig: string) {
  tsNodeRegister(path, tsConfig);

  const customWebpackConfig = require(path);
  // If the user provides a configuration in TS file
  // then there are 2 cases for exporing an object. The first one is:
  // `module.exports = { ... }`. And the second one is:
  // `export default { ... }`. The ESM format is compiled into:
  // `{ default: { ... } }`
  return customWebpackConfig.default || customWebpackConfig;
}
