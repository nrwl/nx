import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import { NuxtServeExecutorOptions } from './schema';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import {
  getCommonNuxtConfigOverrides,
  loadNuxiDynamicImport,
  loadNuxtKitDynamicImport,
} from '../../utils/executor-utils';
import { NuxtOptions } from '@nuxt/schema';

export async function* nuxtServeExecutor(
  options: NuxtServeExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  const { loadNuxtConfig } = await loadNuxtKitDynamicImport();
  const config = await loadNuxtConfig({
    cwd: joinPathFragments(context.root, projectRoot),
  });

  yield* createAsyncIterable<{ success: boolean; baseUrl: string }>(
    async ({ next, error }) => {
      try {
        const { runCommand } = await loadNuxiDynamicImport();

        await runCommand('dev', [projectRoot], {
          // Options passed through CLI or project.json get precedence over nuxt.config.ts
          overrides: getConfigOverrides(options, config, projectRoot, context),
        });
        next({
          success: true,
          // Options passed through CLI or project.json get precedence over nuxt.config.ts
          baseUrl: `${
            options.https ? 'https' : config.devServer.https ? 'https' : 'http'
          }://${options.host ?? config.devServer.host ?? 'localhost'}:${
            options.port ?? config.devServer.port ?? '4200'
          }`,
        });
      } catch (err) {
        console.error(err);
        error(new Error(`Nuxt app exited with message ${err.message}`));
      }
    }
  );
}

function getConfigOverrides(
  options: NuxtServeExecutorOptions,
  config: NuxtOptions,
  projectRoot: string,
  context: ExecutorContext
): { [key: string]: any } {
  let outputPath = '';
  for (const [_targetName, targetConfig] of Object.entries(
    context.projectsConfigurations.projects[context.projectName].targets
  )) {
    if (targetConfig.executor === '@nx/nuxt:build') {
      outputPath = targetConfig.options.outputPath;
    }
  }
  const json = getCommonNuxtConfigOverrides(
    config,
    context.root,
    projectRoot,
    outputPath
  );

  if (options.debug !== undefined) {
    json.debug = options.debug;
  }

  if (options.dev !== undefined) {
    json.dev = options.dev;
  }

  if (options.ssr !== undefined) {
    json.ssr = options.ssr;
  }

  if (options.https !== undefined) {
    if (!json.devServer) {
      json.devServer = {};
    }
    json.devServer.https = options.https;
  }
  if (options.port) {
    if (!json.devServer) {
      json.devServer = {};
    }
    json.devServer.port = options.port;
  }
  if (options.host) {
    if (!json.devServer) {
      json.devServer = {};
    }
    json.devServer.host = options.host;
  }

  return json;
}

export default nuxtServeExecutor;
