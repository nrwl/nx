import * as webpack from 'webpack';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';

import { eachValueFrom } from '@nrwl/devkit/src/utils/rxjs-for-await';
import { map, tap } from 'rxjs/operators';
import * as WebpackDevServer from 'webpack-dev-server';

import { getDevServerConfig } from './lib/get-dev-server-config';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { runWebpackDevServer } from '../../utils/run-webpack';
import { resolveCustomWebpackConfig } from '../../utils/webpack/custom-webpack';
import { normalizeOptions } from '../webpack/lib/normalize-options';
import { getEmittedFiles } from '../webpack/lib/get-emitted-files';
import { WebpackExecutorOptions } from '../webpack/schema';
import { WebDevServerOptions } from './schema';

export async function* devServerExecutor(
  serveOptions: WebDevServerOptions,
  context: ExecutorContext
) {
  const { root: projectRoot, sourceRoot } =
    context.projectsConfigurations.projects[context.projectName];
  const buildOptions = normalizeOptions(
    getBuildOptions(serveOptions, context),
    context.root,
    sourceRoot
  );

  if (!buildOptions.index) {
    throw new Error(
      `Cannot run dev-server without "index" option. Check the build options for ${context.projectName}.`
    );
  }

  if (!buildOptions.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      'build', // should be generalized
      context.configurationName
    );
    buildOptions.tsConfig = createTmpTsConfig(
      buildOptions.tsConfig,
      context.root,
      target.data.root,
      dependencies
    );
  }

  let webpackConfig = getDevServerConfig(context, buildOptions, serveOptions);

  if (buildOptions.webpackConfig) {
    let customWebpack = resolveCustomWebpackConfig(
      buildOptions.webpackConfig,
      buildOptions.tsConfig
    );

    if (typeof customWebpack.then === 'function') {
      customWebpack = await customWebpack;
    }

    webpackConfig = await customWebpack(webpackConfig, {
      buildOptions,
      configuration: serveOptions.buildTarget.split(':')[2],
    });
  }

  return yield* eachValueFrom(
    runWebpackDevServer(webpackConfig, webpack, WebpackDevServer).pipe(
      tap(({ stats }) => {
        console.info(stats.toString((webpackConfig as any).stats));
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
): WebpackExecutorOptions {
  const target = parseTargetString(options.buildTarget, context.projectGraph);

  const overrides: Partial<WebpackExecutorOptions> = {
    watch: false,
  };
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

export default devServerExecutor;
