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
import { registerTsConfigPaths } from 'nx/src/utils/register';
import { resolve } from 'path';

export async function* viteDevServerExecutor(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean; baseUrl: string }> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  registerTsConfigPaths(resolve(projectRoot, 'tsconfig.json'));

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

  try {
    const server = await createServer(serverConfig);
    await runViteDevServer(server);
    const resolvedUrls = [
      ...server.resolvedUrls.local,
      ...server.resolvedUrls.network,
    ];

    yield {
      success: true,
      baseUrl: resolvedUrls[0] ?? '',
    };
  } catch (e) {
    console.error(e);
    yield {
      success: false,
      baseUrl: '',
    };
  }

  await new Promise<void>((resolve) => {
    process.once('SIGINT', () => resolve());
    process.once('SIGTERM', () => resolve());
    process.once('exit', () => resolve());
  });
}

async function runViteDevServer(server: ViteDevServer): Promise<void> {
  await server.listen();
  server.printUrls();

  const processOnExit = async () => {
    await server.close();
  };

  process.once('SIGINT', processOnExit);
  process.once('SIGTERM', processOnExit);
  process.once('exit', processOnExit);
}

export default viteDevServerExecutor;
