import { ExecutorContext, parseTargetString, runExecutor } from '@nrwl/devkit';
import { InlineConfig, mergeConfig, preview, PreviewServer } from 'vite';
import {
  getNxTargetOptions,
  getViteSharedConfig,
  getViteBuildOptions,
  getVitePreviewOptions,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from '../build/schema';
import { VitePreviewServerExecutorOptions } from './schema';

export default async function* vitePreviewServerExecutor(
  options: VitePreviewServerExecutorOptions,
  context: ExecutorContext
) {
  // Retrieve the option for the configured buildTarget.
  const buildTargetOptions: ViteBuildExecutorOptions = getNxTargetOptions(
    options.buildTarget,
    context
  );

  // Merge the options from the build and preview-serve targets.
  // The latter takes precedence.
  const mergedOptions = {
    ...{ watch: {} },
    ...buildTargetOptions,
    ...options,
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
    process.off('SIGINT', processOnExit);
    process.off('SIGTERM', processOnExit);
    process.off('exit', processOnExit);
  };

  process.on('SIGINT', processOnExit);
  process.on('SIGTERM', processOnExit);
  process.on('exit', processOnExit);

  // Launch the build target.
  const target = parseTargetString(options.buildTarget, context.projectGraph);
  const build = await runExecutor(target, mergedOptions, context);

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

  await new Promise(() => {});
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
