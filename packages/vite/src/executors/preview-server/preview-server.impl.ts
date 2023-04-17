import { ExecutorContext, parseTargetString, runExecutor } from '@nx/devkit';
import { InlineConfig, mergeConfig, preview, PreviewServer } from 'vite';
import {
  getNxTargetOptions,
  getViteSharedConfig,
  getViteBuildOptions,
  getVitePreviewOptions,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from '../build/schema';
import { VitePreviewServerExecutorOptions } from './schema';

interface CustomBuildTargetOptions {
  outputPath: string;
}

export async function* vitePreviewServerExecutor(
  options: VitePreviewServerExecutorOptions,
  context: ExecutorContext
) {
  const target = parseTargetString(options.buildTarget, context.projectGraph);
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
  const buildTargetOptions:
    | ViteBuildExecutorOptions
    | CustomBuildTargetOptions = getNxTargetOptions(
    options.buildTarget,
    context
  );

  const outputPath = options.staticFilePath ?? buildTargetOptions.outputPath;

  if (!outputPath) {
    throw new Error(
      `Could not infer the "outputPath". It should either be a property of the "${options.buildTarget}" buildTarget or provided explicitly as a "staticFilePath" option.`
    );
  }

  // Merge the options from the build and preview-serve targets.
  // The latter takes precedence.
  const mergedOptions = {
    ...{ watch: {} },
    ...(isCustomBuildTarget ? {} : buildTargetOptions),
    ...options,
    outputPath,
  };

  // Retrieve the server configuration.
  const serverConfig: InlineConfig = mergeConfig(
    getViteSharedConfig(mergedOptions, options.clearScreen, context),
    {
      build: getViteBuildOptions(mergedOptions, context),
      preview: getVitePreviewOptions(mergedOptions, context),
    }
  );

  if (serverConfig.mode === 'production') {
    console.warn('WARNING: preview is not meant to be run in production!');
  }

  let server: PreviewServer | undefined;

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

function closeServer(server?: PreviewServer): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
    } else {
      const { httpServer } = server;
      // closeAllConnections was added in Node v18.2.0
      httpServer.closeAllConnections && httpServer.closeAllConnections();
      httpServer.close(() => resolve());
    }
  });
}

export default vitePreviewServerExecutor;
