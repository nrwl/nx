import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { Configuration } from '@rspack/core';
import { RspackDevServer } from '@rspack/dev-server';
import { createCompiler, isMultiCompiler } from '../../utils/create-compiler';
import { isMode } from '../../utils/mode-utils';
import { normalizeOptions } from '../rspack/lib/normalize-options';
import { getDevServerOptions } from './lib/get-dev-server-config';
import { DevServerExecutorSchema } from './schema';

type DevServer = Configuration['devServer'];
export default async function* runExecutor(
  options: DevServerExecutorSchema,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
  process.env.NODE_ENV ??= options.mode ?? 'development';

  if (isMode(process.env.NODE_ENV)) {
    options.mode = process.env.NODE_ENV;
  }

  const buildTarget = parseTargetString(
    options.buildTarget,
    context.projectGraph
  );

  const buildOptions = readTargetOptions(buildTarget, context);

  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${buildOptions.buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = options.buildTarget;

  const metadata = context.projectsConfigurations.projects[context.projectName];
  const sourceRoot = getProjectSourceRoot(metadata);
  const normalizedBuildOptions = normalizeOptions(
    buildOptions,
    context.root,
    metadata.root,
    sourceRoot
  );
  let devServerConfig: DevServer = getDevServerOptions(
    context.root,
    options,
    normalizedBuildOptions
  );
  const compiler = await createCompiler(
    {
      ...normalizedBuildOptions,
      devServer: devServerConfig,
      mode: options.mode,
    },
    context
  );

  // Use the first one if it's MultiCompiler
  // https://webpack.js.org/configuration/dev-server/#root:~:text=Be%20aware%20that%20when%20exporting%20multiple%20configurations%20only%20the%20devServer%20options%20for%20the%20first%20configuration%20will%20be%20taken%20into%20account%20and%20used%20for%20all%20the%20configurations%20in%20the%20array.
  const firstCompiler = isMultiCompiler(compiler)
    ? compiler.compilers[0]
    : compiler;
  devServerConfig = {
    ...devServerConfig,
    ...firstCompiler.options.devServer,
  };

  const baseUrl = `http://localhost:${devServerConfig.port ?? 4200}`;

  return yield* createAsyncIterable(({ next }) => {
    const server = new RspackDevServer(
      {
        ...devServerConfig,
        onListening: () => {
          next({
            success: true,
            baseUrl,
          });
        },
      },

      compiler
    );
    server.compiler.hooks.done.tap('NX Rspack Dev Server', (stats) => {
      if (stats.hasErrors()) {
        logger.error(`NX Compilation failed. See above for more details.`);
      } else {
        logger.info(`NX Server ready at ${baseUrl}`);
      }
    });
    server.start();
  });
}
