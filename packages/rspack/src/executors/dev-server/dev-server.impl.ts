import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import { createAsyncIterable } from '@nrwl/devkit/src/utils/async-iterable';
import { RspackDevServer } from '@rspack/dev-server';
import { createCompiler } from '../../utils/create-compiler';
import { DevServerExecutorSchema } from './schema';

export default async function* runExecutor(
  options: DevServerExecutorSchema,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= 'development';
  const buildTarget = parseTargetString(
    options.buildTarget,
    context.projectGraph
  );
  const devServerConfig = {
    port: options.port ?? 4200,
    hot: true,
  };
  const buildOptions = readTargetOptions<any>(buildTarget, context);
  const compiler = await createCompiler(
    { ...buildOptions, devServer: devServerConfig },
    context
  );

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
      } as any,
      compiler
    );
    server.start();
  });
}
