import { performance } from 'node:perf_hooks';

performance.mark(`plugin worker ${process.pid} code loading -- start`);

import {
  consumeMessagesFromSocket,
  parseMessage,
} from '../../../utils/consume-messages-from-socket';
import { logger } from '../../../utils/logger';
import { createSerializableError } from '../../../utils/serializable-error';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import { consumeMessage, isPluginWorkerMessage } from './messaging';

import { unlinkSync } from 'fs';
import { createServer } from 'net';
import { startAnalytics } from '../../../analytics';
import '../../../utils/perf-logging';

type Environment = Pick<
  NodeJS.ProcessEnv,
  'NX_PERF_LOGGING' | 'NX_PLUGIN_NO_TIMEOUTS'
>;

const environment: Environment = process.env as Environment;

startAnalytics();

performance.mark(`plugin worker ${process.pid} code loading -- end`);
performance.measure(
  `plugin worker ${process.pid} code loading`,
  `plugin worker ${process.pid} code loading -- start`,
  `plugin worker ${process.pid} code loading -- end`
);

global.NX_GRAPH_CREATION = true;
global.NX_PLUGIN_WORKER = true;
let plugin: LoadedNxPlugin;

const socketPath = process.argv[2];
const expectedPluginName = process.argv[3];

const CONNECT_TIMEOUT_MS = 30_000;

let connectErrorTimeout = setErrorTimeout(
  CONNECT_TIMEOUT_MS,
  `The plugin worker for ${expectedPluginName} is exiting as it was not connected to within ${CONNECT_TIMEOUT_MS / 1000} seconds. ` +
    'Plugin workers expect to receive a socket connection from the parent process shortly after being started. ' +
    'If you are seeing this issue, please report it to the Nx team at https://github.com/nrwl/nx/issues.'
);

const server = createServer((socket) => {
  connectErrorTimeout?.clear();

  logger.verbose(
    `[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) connected`
  );
  // This handles cases where the host process was killed
  // after the worker connected but before the worker was
  // instructed to load the plugin.
  let loadErrorTimeout = setErrorTimeout(
    10_000,
    `Plugin Worker for ${expectedPluginName} is exiting as it did not receive a load message within 10 seconds of connecting. ` +
      'This likely indicates that the host process was terminated before the worker could be instructed to load the plugin. ' +
      'If you are seeing this issue, please report it to the Nx team at https://github.com/nrwl/nx/issues.'
  );
  socket.on(
    'data',
    consumeMessagesFromSocket((raw) => {
      const message = parseMessage<any>(raw);
      if (!isPluginWorkerMessage(message)) {
        return;
      }
      return consumeMessage(socket, message, {
        load: async ({
          plugin: pluginConfiguration,
          root,
          name,
          pluginPath,
          shouldRegisterTSTranspiler,
        }) => {
          loadErrorTimeout?.clear();
          process.chdir(root);
          return withErrorHandling(async () => {
            const { loadResolvedNxPluginAsync } = await Promise.resolve(
              require(require.resolve('../load-resolved-plugin'))
            );

            // Register the ts-transpiler if we are pointing to a
            // plain ts file that's not part of a plugin project
            if (shouldRegisterTSTranspiler) {
              (
                require('../transpiler') as typeof import('../transpiler')
              ).registerPluginTSTranspiler();
            }
            plugin = await loadResolvedNxPluginAsync(
              pluginConfiguration,
              pluginPath,
              name
            );
            logger.verbose(
              `[plugin-worker] "${name}" (pid: ${process.pid}) loaded successfully`
            );
            return {
              name: plugin.name,
              include: plugin.include,
              exclude: plugin.exclude,
              createNodesPattern: plugin.createNodes?.[0],
              hasCreateDependencies:
                'createDependencies' in plugin && !!plugin.createDependencies,
              hasProcessProjectGraph:
                'processProjectGraph' in plugin && !!plugin.processProjectGraph,
              hasCreateMetadata:
                'createMetadata' in plugin && !!plugin.createMetadata,
              hasPreTasksExecution:
                'preTasksExecution' in plugin && !!plugin.preTasksExecution,
              hasPostTasksExecution:
                'postTasksExecution' in plugin && !!plugin.postTasksExecution,
              success: true as const,
            };
          });
        },
        createNodes: async ({ configFiles, context }) =>
          withErrorHandling(async () => {
            const result = await plugin.createNodes[1](configFiles, context);
            return { result, success: true as const };
          }),
        createDependencies: async ({ context }) =>
          withErrorHandling(async () => {
            const result = await plugin.createDependencies(context);
            return { dependencies: result, success: true as const };
          }),
        createMetadata: async ({ graph, context }) =>
          withErrorHandling(async () => {
            const result = await plugin.createMetadata(graph, context);
            return { metadata: result, success: true as const };
          }),
        preTasksExecution: async ({ context }) =>
          withErrorHandling(async () => {
            const mutations = await plugin.preTasksExecution?.(context);
            return { success: true as const, mutations };
          }),
        postTasksExecution: async ({ context }) =>
          withErrorHandling(() => plugin.postTasksExecution?.(context)),
        setWorkerEnv: (env) =>
          withErrorHandling(() => {
            for (const envKey in env) {
              process.env[envKey] = env[envKey];
            }
          }),
      });
    })
  );

  // When the host disconnects, clean up and exit.
  socket.on('end', () => {
    socket.destroySoon();
    try {
      unlinkSync(socketPath);
    } catch (e) {}
    process.exit(0);
  });
});

server.listen(socketPath);
logger.verbose(
  `[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) listening on ${socketPath}`
);

async function withErrorHandling(
  cb: () => void | Promise<void>
): Promise<{ success: true } | { success: false; error: Error }>;
async function withErrorHandling<T>(
  cb: () => T | Promise<T>
): Promise<T | { success: false; error: Error }>;
async function withErrorHandling<T>(
  cb: () => T | Promise<T>
): Promise<T | { success: true } | { success: false; error: Error }> {
  try {
    const result = await cb();
    return result ?? ({ success: true as const } as any);
  } catch (e) {
    return {
      success: false as const,
      error: createSerializableError(e) as Error,
    };
  }
}

function setErrorTimeout(
  timeoutMs: number,
  errorMessage: string
): { clear: () => void } | undefined {
  if (environment.NX_PLUGIN_NO_TIMEOUTS === 'true') {
    return;
  }
  let cleared = false;
  const timeout = setTimeout(() => {
    if (!cleared) {
      console.error(errorMessage);
      process.exit(1);
    }
  }, timeoutMs).unref();
  return {
    clear: () => {
      cleared = true;
      clearTimeout(timeout);
    },
  };
}

const exitHandler = (exitCode: number) => () => {
  server.close();
  try {
    unlinkSync(socketPath);
  } catch (e) {}
  process.exit(exitCode);
};

const events = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'exit'];

events.forEach((event) => process.once(event, exitHandler(0)));
process.once('uncaughtException', exitHandler(1));
process.once('unhandledRejection', exitHandler(1));
