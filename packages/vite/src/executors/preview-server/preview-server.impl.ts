import {
  ExecutorContext,
  joinPathFragments,
  offsetFromRoot,
  parseTargetString,
  runExecutor,
} from '@nx/devkit';
import {
  getNxTargetOptions,
  getProxyConfig,
  normalizeViteConfigFilePath,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from '../build/schema';
import { VitePreviewServerExecutorOptions } from './schema';
import { relative } from 'path';
import { getBuildExtraArgs } from '../build/build.impl';
import { loadViteDynamicImport } from '../../utils/executor-utils';

export async function* vitePreviewServerExecutor(
  options: VitePreviewServerExecutorOptions,
  context: ExecutorContext
) {
  process.env.VITE_CJS_IGNORE_WARNING = 'true';
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { mergeConfig, preview, loadConfigFromFile } =
    await loadViteDynamicImport();
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const target = parseTargetString(options.buildTarget, context);
  const targetConfiguration =
    context.projectsConfigurations.projects[target.project]?.targets[
      target.target
    ];
  if (!targetConfiguration) {
    throw new Error(`Invalid buildTarget: ${options.buildTarget}`);
  }

  const isCustomBuildTarget =
    targetConfiguration.executor !== '@nx/vite:build' &&
    targetConfiguration.executor !== '@nrwl/vite:build';

  // Retrieve the option for the configured buildTarget.
  const buildTargetOptions: ViteBuildExecutorOptions = getNxTargetOptions(
    options.buildTarget,
    context
  );

  const { configuration } = parseTargetString(options.buildTarget, context);

  const viteConfigPath = normalizeViteConfigFilePath(
    context.root,
    projectRoot,
    buildTargetOptions.configFile
  );

  const { buildOptions, otherOptions: otherOptionsFromBuild } =
    await getBuildExtraArgs(buildTargetOptions);

  const { previewOptions, otherOptions } = await getExtraArgs(
    options,
    configuration,
    otherOptionsFromBuild
  );
  const resolved = await loadConfigFromFile(
    {
      mode: otherOptions?.mode ?? otherOptionsFromBuild?.mode ?? 'production',
      command: 'build',
    },
    viteConfigPath
  );

  const outDir =
    options.staticFilePath ??
    joinPathFragments(
      offsetFromRoot(projectRoot),
      buildTargetOptions.outputPath
    ) ??
    resolved?.config?.build?.outDir;

  if (!outDir) {
    throw new Error(
      `Could not infer the "outputPath" or "outDir". It should be set in your vite.config.ts, or as a property of the "${options.buildTarget}" buildTarget or provided explicitly as a "staticFilePath" option.`
    );
  }
  const root =
    projectRoot === '.'
      ? process.cwd()
      : relative(context.cwd, joinPathFragments(context.root, projectRoot));

  // Merge the options from the build and preview-serve targets.
  // The latter takes precedence.
  const mergedOptions = {
    ...{ watch: {} },
    build: {
      outDir,
      ...(isCustomBuildTarget ? {} : buildOptions),
    },
    ...(isCustomBuildTarget ? {} : otherOptionsFromBuild),
    ...otherOptions,
    preview: {
      ...getProxyConfig(context, otherOptions.proxyConfig),
      ...previewOptions,
    },
  };

  // vite InlineConfig
  const serverConfig = mergeConfig(
    {
      // This should not be needed as it's going to be set in vite.config.ts
      // but leaving it here in case someone did not migrate correctly
      root: resolved.config.root ?? root,
      configFile: viteConfigPath,
    },
    {
      ...mergedOptions,
    }
  );

  if (serverConfig.mode === 'production') {
    console.warn('WARNING: preview is not meant to be run in production!');
  }

  // vite PreviewServer
  let server: Record<string, any> | undefined;

  const processOnExit = async () => {
    await closeServer(server);
  };

  process.once('SIGINT', processOnExit);
  process.once('SIGTERM', processOnExit);
  process.once('exit', processOnExit);

  // Launch the build target.
  // If customBuildTarget is set to true, do not provide any overrides to it
  const buildTargetOverrides = isCustomBuildTarget ? {} : mergedOptions;
  const build = await runExecutor(target, buildTargetOverrides, context);

  for await (const result of build) {
    if (result.success) {
      try {
        if (!server) {
          server = await preview(serverConfig);
        }
        server.printUrls();

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
    } else {
      yield {
        success: false,
        baseUrl: '',
      };
    }
  }

  await new Promise<void>((resolve) => {
    process.once('SIGINT', () => resolve());
    process.once('SIGTERM', () => resolve());
    process.once('exit', () => resolve());
  });
}

function closeServer(server?: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
    } else {
      const { httpServer } = server;
      if (httpServer['closeAllConnections']) {
        // https://github.com/vitejs/vite/pull/14834
        // closeAllConnections was added in Node v18.2.0
        // typically is "as http.Server" but no reason
        // to import http just for this
        (httpServer as any).closeAllConnections();
      }
      httpServer.close(() => resolve());
    }
  });
}

export default vitePreviewServerExecutor;

async function getExtraArgs(
  options: VitePreviewServerExecutorOptions,
  configuration: string | undefined,
  otherOptionsFromBuildTarget: Record<string, unknown> | undefined
): Promise<{
  // vite PreviewOptions
  previewOptions: Record<string, any>;
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

  const previewOptions = {};
  const previewSchemaKeys = [
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
    if (previewSchemaKeys.includes(key)) {
      previewOptions[key] = extraArgs[key];
    } else {
      otherOptions[key] = extraArgs[key];
    }
  }

  if (configuration) {
    otherOptions = {
      ...otherOptions,
      ...(otherOptionsFromBuildTarget ?? {}),
    };
  }

  return {
    previewOptions,
    otherOptions,
  };
}
