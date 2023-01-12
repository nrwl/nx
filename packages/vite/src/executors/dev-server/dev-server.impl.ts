import 'dotenv/config';
import { ExecutorContext } from '@nrwl/devkit';
import { createServer, InlineConfig, mergeConfig, ViteDevServer } from 'vite';

import {
  getViteSharedConfig,
  getNxTargetOptions,
  getViteServerOptions,
  getViteBuildOptions,
} from '../../utils/options-utils';

import { ViteDevServerExecutorOptions } from './schema';
import { ViteBuildExecutorOptions } from '../build/schema';

export default async function* viteDevServerExecutor(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean; baseUrl: string }> {
  // Retrieve the option for the configured buildTarget.
  const buildTargetOptions: ViteBuildExecutorOptions = getNxTargetOptions(
    options.buildTarget,
    context
  );

  // Merge the options from the build and dev-serve targets.
  // The latter takes precedence.
  const mergedOptions = {
    ...buildTargetOptions,
    ...options,
  };

  // Add the server specific configuration.
  const serverConfig: InlineConfig = mergeConfig(
    getViteSharedConfig(mergedOptions, options.clearScreen, context),
    {
      build: getViteBuildOptions(mergedOptions, context),
      server: getViteServerOptions(mergedOptions, context),
    }
  );

  if (serverConfig.mode === 'production') {
    console.warn('WARNING: serve is not meant to be run in production!');
  }

  try {
    const server = await createServer(serverConfig);
    const baseUrl = await runViteDevServer(server);

    yield {
      success: true,
      baseUrl,
    };
  } catch (e) {
    console.error(e);
    yield {
      success: false,
      baseUrl: '',
    };
  }

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

async function runViteDevServer(server: ViteDevServer): Promise<string> {
  await server.listen();
  server.printUrls();

  const processOnExit = () => {
    process.off('SIGINT', processOnExit);
    process.off('SIGTERM', processOnExit);
    process.off('exit', processOnExit);
  };

  process.on('SIGINT', processOnExit);
  process.on('SIGTERM', processOnExit);
  process.on('exit', processOnExit);
  return `${server.config.server.https ? 'https' : 'http'}://${
    server.config.server.host ?? 'localhost'
  }:${server.config.server.port}`;
}
