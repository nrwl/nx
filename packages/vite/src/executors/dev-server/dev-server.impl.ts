import 'dotenv/config';
import { ExecutorContext } from '@nrwl/devkit';
import { createServer, InlineConfig, mergeConfig, ViteDevServer } from 'vite';

import {
  getBuildAndSharedConfig,
  getBuildTargetOptions,
  getServerOptions,
} from '../../utils/options-utils';

import { ViteDevServerExecutorOptions } from './schema';
import { ViteBuildExecutorOptions } from '../build/schema';

export default async function* viteDevServerExecutor(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean; baseUrl: string }> {
  const mergedOptions = {
    ...getBuildTargetOptions(options.buildTarget, context),
    ...options,
  } as ViteDevServerExecutorOptions & ViteBuildExecutorOptions;

  const serverConfig: InlineConfig = mergeConfig(
    await getBuildAndSharedConfig(mergedOptions, context),
    {
      server: getServerOptions(mergedOptions, context),
    } as InlineConfig
  );

  const server = await createServer(serverConfig);

  const baseUrl = await runViteDevServer(server);

  yield {
    success: true,
    baseUrl: baseUrl,
  };

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

async function runViteDevServer(server: ViteDevServer): Promise<string> {
  try {
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
    return `${server.config?.server?.https ? 'https' : 'http'}://${
      server.config?.server?.host
    }:${server.config?.server?.port}`;
  } catch (err) {
    console.log(err);
  }
}
