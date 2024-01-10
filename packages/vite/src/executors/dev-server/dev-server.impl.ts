import {
  ExecutorContext,
  joinPathFragments,
  parseTargetString,
} from '@nx/devkit';
import {
  getNxTargetOptions,
  getViteServerOptions,
  normalizeViteConfigFilePath,
} from '../../utils/options-utils';
import { ViteDevServerExecutorOptions } from './schema';
import { ViteBuildExecutorOptions } from '../build/schema';
import {
  createBuildableTsConfig,
  loadViteDynamicImport,
} from '../../utils/executor-utils';
import { relative } from 'path';
import { getBuildExtraArgs } from '../build/build.impl';

export async function* viteDevServerExecutor(
  options: ViteDevServerExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean; baseUrl: string }> {
  process.env.VITE_CJS_IGNORE_WARNING = 'true';
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { mergeConfig, createServer, loadConfigFromFile } =
    await loadViteDynamicImport();

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

  const { configuration } = parseTargetString(options.buildTarget, context);

  const { buildOptions, otherOptions: otherOptionsFromBuild } =
    await getBuildExtraArgs(buildTargetOptions);

  const viteConfigPath = normalizeViteConfigFilePath(
    context.root,
    projectRoot,
    buildTargetOptions.configFile
  );
  const { serverOptions, otherOptions } = await getServerExtraArgs(
    options,
    configuration,
    buildOptions,
    otherOptionsFromBuild
  );
  const resolved = await loadConfigFromFile(
    {
      mode: otherOptions?.mode ?? buildTargetOptions?.['mode'] ?? 'development',
      command: 'serve',
    },
    viteConfigPath
  );

  // vite InlineConfig
  const serverConfig = mergeConfig(
    {
      // This should not be needed as it's going to be set in vite.config.ts
      // but leaving it here in case someone did not migrate correctly
      root: resolved.config.root ?? root,
      configFile: viteConfigPath,
    },
    {
      server: {
        ...(await getViteServerOptions(options, context)),
        ...serverOptions,
      },
      ...otherOptions,
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
// vite ViteDevServer
async function runViteDevServer(server: Record<string, any>): Promise<void> {
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

async function getServerExtraArgs(
  options: ViteDevServerExecutorOptions,
  configuration: string | undefined,
  buildOptionsFromBuildTarget: Record<string, unknown> | undefined,
  otherOptionsFromBuildTarget: Record<string, unknown> | undefined
): Promise<{
  // vite ServerOptions
  serverOptions: Record<string, unknown>;
  otherOptions: Record<string, any>;
}> {
  // support passing extra args to vite cli
  const schema = await import('./schema.json');
  const extraArgs = {};
  for (const key of Object.keys(options)) {
    if (!schema.properties[key]) {
      extraArgs[key] = options[key];
    }
  }

  let serverOptions: Record<string, unknown> = {};
  const serverSchemaKeys = [
    'hmr',
    'warmup',
    'watch',
    'middlewareMode',
    'fs',
    'origin',
    'preTransformRequests',
    'sourcemapIgnoreList',
    'port',
    'strictPort',
    'host',
    'https',
    'open',
    'proxy',
    'cors',
    'headers',
  ];

  let otherOptions = {};
  for (const key of Object.keys(extraArgs)) {
    if (serverSchemaKeys.includes(key)) {
      serverOptions[key] = extraArgs[key];
    } else {
      otherOptions[key] = extraArgs[key];
    }
  }

  if (configuration) {
    serverOptions = {
      ...serverOptions,
      watch: buildOptionsFromBuildTarget?.watch ?? serverOptions?.watch,
    };
    otherOptions = {
      ...otherOptions,
      ...(otherOptionsFromBuildTarget ?? {}),
    };
  }

  return {
    serverOptions,
    otherOptions,
  };
}
