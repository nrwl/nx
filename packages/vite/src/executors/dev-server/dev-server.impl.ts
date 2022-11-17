import { ExecutorContext } from '@nrwl/devkit';

import 'dotenv/config';
import { InlineConfig, createServer, mergeConfig, ViteDevServer } from 'vite';

import {
  getBuildConfig,
  getBuildTargetOptions,
  getServerOptions,
} from '../../utils/helper-functions';

import { copyAssets, CopyAssetsResult } from '@nrwl/js';

import { ViteDevServerExecutorOptions } from './schema';
import { ViteBuildExecutorOptions } from '../build/schema';

export default async function* viteDevServerExecutor(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean; baseUrl: string }> {
  const mergedOptions = {
    ...getBuildTargetOptions(options, context),
    ...options,
  } as ViteDevServerExecutorOptions & ViteBuildExecutorOptions;

  let assetsResult: CopyAssetsResult;
  if (mergedOptions.assets) {
    assetsResult = await copyAssets(
      {
        outputPath: mergedOptions.outputPath,
        assets: mergedOptions.assets ?? [],
        watch: true,
      },
      context
    );
  }

  const serverConfig: InlineConfig = mergeConfig(
    await getBuildConfig(mergedOptions, context),
    {
      server: getServerOptions(mergedOptions, context),
    } as InlineConfig
  );

  const server = await createServer(serverConfig);

  const baseUrl = await runViteDevServer(server, assetsResult);

  yield {
    success: true,
    baseUrl: baseUrl,
  };

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

async function runViteDevServer(
  server: ViteDevServer,
  assetsResult: CopyAssetsResult
): Promise<string> {
  try {
    await server.listen();
    server.printUrls();

    const processOnExit = () => {
      assetsResult?.stop();
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
