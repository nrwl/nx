import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { Configuration } from '@rspack/core';
import { RspackDevServer } from '@rspack/dev-server';
import { createCompiler, isMultiCompiler } from '../../utils/create-compiler';
import { isMode } from '../../utils/mode-utils';
import { DevServerExecutorSchema } from './schema';
type DevServer = Configuration['devServer'];
export default async function* runExecutor(
  options: DevServerExecutorSchema,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= options.mode ?? 'development';

  if (isMode(process.env.NODE_ENV)) {
    options.mode = process.env.NODE_ENV;
  }

  const buildTarget = parseTargetString(
    options.buildTarget,
    context.projectGraph
  );

  let devServerConfig: DevServer = {
    port: options.port ?? 4200,
    hot: true,
  };

  const buildOptions = readTargetOptions<any>(buildTarget, context);
  const compiler = await createCompiler(
    { ...buildOptions, devServer: devServerConfig, mode: options.mode },
    context
  );

  // Use the first one if it's MultiCompiler
  // https://webpack.js.org/configuration/dev-server/#root:~:text=Be%20aware%20that%20when%20exporting%20multiple%20configurations%20only%20the%20devServer%20options%20for%20the%20first%20configuration%20will%20be%20taken%20into%20account%20and%20used%20for%20all%20the%20configurations%20in%20the%20array.
  const firstCompiler = isMultiCompiler(compiler) ? compiler.compilers[0] : compiler;
  devServerConfig = {
    ...devServerConfig,
    ...firstCompiler.options.devServer,
  };

  yield* createAsyncIterable(({ next }) => {
    const server: any = new RspackDevServer(
      {
        ...devServerConfig,
        onListening: (server: any) => {
          next({
            success: true,
            baseUrl: `http://localhost:${options.port ?? 4200}`,
          });
        },
      },

      compiler
    );
    server.start();
  });
}
