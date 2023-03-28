import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import { createAsyncIterable } from '@nrwl/devkit/src/utils/async-iterable';
import { DevServer } from '@rspack/core/dist/config';
import { RspackDevServer } from '@rspack/dev-server';
import { createCompiler } from '../../utils/create-compiler';
import { isMode } from '../../utils/mode-utils';
import { DevServerExecutorSchema } from './schema';

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

  // If I don't typecast, it throws an error
  // that port does not exist on type DevServer
  // however, it does exist, since DevServer extends
  // WebpackDevServer.Configuration which has port
  let devServerConfig: DevServer = {
    port: options.port ?? 4200,
    hot: true,
  } as DevServer;

  const buildOptions = readTargetOptions<any>(buildTarget, context);
  const compiler = await createCompiler(
    { ...buildOptions, devServer: devServerConfig, mode: options.mode },
    context
  );

  devServerConfig = {
    ...devServerConfig,
    ...compiler.options.devServer,
  };

  yield* createAsyncIterable(({ next }) => {
    const server: any = new RspackDevServer(
      // If I don't typecast, it throws an error
      // that onListening does not exist on type DevServer
      // however, it does exist, since DevServer extends
      // WebpackDevServer.Configuration which has onListening
      {
        ...devServerConfig,
        onListening: (server: any) => {
          next({
            success: true,
            baseUrl: `http://localhost:${options.port ?? 4200}`,
          });
        },
      } as DevServer,

      compiler
    );
    server.start();
  });
}
