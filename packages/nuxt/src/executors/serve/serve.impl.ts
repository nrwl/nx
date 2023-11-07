import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import { NuxtServeExecutorOptions } from './schema';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';

// Required because nuxi is ESM package.
export function loadNuxiDynamicImport() {
  return Function('return import("nuxi")')() as Promise<typeof import('nuxi')>;
}

export async function* nuxtServeExecutor(
  options: NuxtServeExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  yield* createAsyncIterable<{ success: boolean; baseUrl: string }>(
    async ({ next, error }) => {
      try {
        const { runCommand } = await loadNuxiDynamicImport();
        await runCommand('dev', [projectRoot], {
          overrides: getConfigOverrides(options, context.root, projectRoot),
        });
        next({
          success: true,
          baseUrl: `${options.https ? 'https' : 'http'}://${
            options.host ?? 'localhost'
          }:${options.port ?? '4200'}`,
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
  workspaceRoot: string,
  projectRoot: string
): { [key: string]: any } {
  const json: { [key: string]: any } = {
    workspaceDir: workspaceRoot,
    typescript: {
      typeCheck: true,
      tsConfig: {
        extends: joinPathFragments(
          workspaceRoot,
          projectRoot,
          'tsconfig.app.json'
        ),
      },
    },
  };

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
