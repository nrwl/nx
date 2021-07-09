import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  joinPathFragments,
} from '@nrwl/devkit';

import { eachValueFrom } from 'rxjs-for-await';
import { map, tap } from 'rxjs/operators';
import * as WebpackDevServer from 'webpack-dev-server';
import {
  getEmittedFiles,
  runWebpackDevServer,
} from '@nrwl/workspace/src/utilities/run-webpack';

import { normalizeWebBuildOptions } from '../../utils/normalize';
import { WebBuildBuilderOptions } from '../build/build.impl';
import { getDevServerConfig } from '../../utils/devserver.config';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { createProjectGraphAsync } from '@nrwl/workspace/src/core/project-graph';

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
  const { webpack } = require('../../webpack/entry');
  const sourceRoot = context.workspace.projects[context.projectName].sourceRoot;
  const buildOptions = normalizeWebBuildOptions(
    getBuildOptions(serveOptions, context),
    context.root,
    sourceRoot
  );
  let webpackConfig = getDevServerConfig(
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

  if (!buildOptions.buildLibsFromSource) {
    const projGraph = await createProjectGraphAsync();
    const { target, dependencies } = calculateProjectDependencies(
      projGraph,
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
