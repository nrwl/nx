import { ExecutorContext } from '@nx/devkit';
import type { InlineConfig, ViteDevServer } from 'vite';

import {
  getNxTargetOptions,
  getViteBuildOptions,
  getViteServerOptions,
  getViteSharedConfig,
} from '../../utils/options-utils';

import { ViteDevServerExecutorOptions } from './schema';
import { ViteBuildExecutorOptions } from '../build/schema';
import { createBuildableTsConfig } from '../../utils/executor-utils';

export async function* viteDevServerExecutor(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean; baseUrl: string }> {
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { mergeConfig, createServer } = await (Function(
    'return import("vite")'
  )() as Promise<typeof import('vite')>);

  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  createBuildableTsConfig(projectRoot, options, context);

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
      server: await getViteServerOptions(mergedOptions, context),
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
