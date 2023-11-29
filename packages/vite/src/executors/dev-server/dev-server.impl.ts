import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import {
  loadConfigFromFile,
  type InlineConfig,
  type ViteDevServer,
} from 'vite';

import {
  getNxTargetOptions,
  getViteServerOptions,
  normalizeViteConfigFilePath,
} from '../../utils/options-utils';

import { ViteDevServerExecutorOptions } from './schema';
import { ViteBuildExecutorOptions } from '../build/schema';
import { createBuildableTsConfig } from '../../utils/executor-utils';
import { relative } from 'path';

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
  const root =
    projectRoot === '.'
      ? process.cwd()
      : relative(context.cwd, joinPathFragments(context.root, projectRoot));
  createBuildableTsConfig(projectRoot, options, context);

  // Retrieve the option for the configured buildTarget.
  const buildTargetOptions: ViteBuildExecutorOptions = getNxTargetOptions(
    options.buildTarget,
    context
  );
  const viteConfigPath = normalizeViteConfigFilePath(
    context.root,
    projectRoot,
    buildTargetOptions.configFile
  );
  const extraArgs = await getExtraArgs(options);
  const resolved = await loadConfigFromFile(
    {
      mode: extraArgs?.mode ?? 'production',
      command: 'build',
    },
    viteConfigPath
  );

  const serverConfig: InlineConfig = mergeConfig(
    {
      // This should not be needed as it's going to be set in vite.config.ts
      // but leaving it here in case someone did not migrate correctly
      root: resolved.config.root ?? root,
      configFile: viteConfigPath,
    },
    {
      server: {
        ...(await getViteServerOptions(options, context)),
        ...extraArgs,
      },
      ...extraArgs,
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

async function getExtraArgs(
  options: ViteDevServerExecutorOptions
): Promise<InlineConfig> {
  // support passing extra args to vite cli
  const schema = await import('./schema.json');
  const extraArgs = {};
  for (const key of Object.keys(options)) {
    if (!schema.properties[key]) {
      extraArgs[key] = options[key];
    }
  }

  return extraArgs as InlineConfig;
}
