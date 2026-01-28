import { performance } from 'node:perf_hooks';

performance.mark(`plugin worker ${process.pid} code loading -- start`);

import { consumeMessagesFromSocket } from '../../../utils/consume-messages-from-socket';
import { createSerializableError } from '../../../utils/serializable-error';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import { consumeMessage, isPluginWorkerMessage } from './messaging';

import { unlinkSync } from 'fs';
import { createServer } from 'net';

type Environment = Pick<
  NodeJS.ProcessEnv,
  'NX_PERF_LOGGING' | 'NX_PLUGIN_NO_TIMEOUTS'
>;

const environment: Environment = process.env as Environment;

if (process.env.NX_PERF_LOGGING === 'true') {
  require('../../../utils/perf-logging');
}

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

let connectErrorTimeout = setErrorTimeout(
  5000,
  `The plugin worker for ${expectedPluginName} is exiting as it was not connected to within 5 seconds. ` +
    'Plugin workers expect to receive a socket connection from the parent process shortly after being started. ' +
    'If you are seeing this issue, please report it to the Nx team at https://github.com/nrwl/nx/issues.'
);

const server = createServer((socket) => {
  connectErrorTimeout?.clear();
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
      const message = JSON.parse(raw.toString());
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
          try {
            const { loadResolvedNxPluginAsync } = await import(
              '../load-resolved-plugin'
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
            return {
              type: 'load-result',
              payload: {
                name: plugin.name,
                include: plugin.include,
                exclude: plugin.exclude,
                createNodesPattern: plugin.createNodes?.[0],
                hasCreateDependencies:
                  'createDependencies' in plugin && !!plugin.createDependencies,
                hasProcessProjectGraph:
                  'processProjectGraph' in plugin &&
                  !!plugin.processProjectGraph,
                hasCreateMetadata:
                  'createMetadata' in plugin && !!plugin.createMetadata,
                hasPreTasksExecution:
                  'preTasksExecution' in plugin && !!plugin.preTasksExecution,
                hasPostTasksExecution:
                  'postTasksExecution' in plugin && !!plugin.postTasksExecution,
                success: true,
              },
            };
          } catch (e) {
            return {
              type: 'load-result',
              payload: {
                success: false,
                error: createSerializableError(e),
              },
            };
          }
        },
        createNodes: async function createNodes({ configFiles, context, tx }) {
          try {
            const result = await plugin.createNodes[1](configFiles, context);
            return {
              type: 'createNodesResult',
              payload: { result, success: true, tx },
            };
          } catch (e) {
            return {
              type: 'createNodesResult',
              payload: {
                success: false,
                error: createSerializableError(e),
                tx,
              },
            };
          }
        },
        createDependencies: async function createDependencies({ context, tx }) {
          try {
            const result = await plugin.createDependencies(context);
            return {
              type: 'createDependenciesResult',
              payload: { dependencies: result, success: true, tx },
            };
          } catch (e) {
            return {
              type: 'createDependenciesResult',
              payload: {
                success: false,
                error: createSerializableError(e),
                tx,
              },
            };
          }
        },
        createMetadata: async function createMetadata({ graph, context, tx }) {
          try {
            const result = await plugin.createMetadata(graph, context);
            return {
              type: 'createMetadataResult',
              payload: { metadata: result, success: true, tx },
            };
          } catch (e) {
            return {
              type: 'createMetadataResult',
              payload: {
                success: false,
                error: createSerializableError(e),
                tx,
              },
            };
          }
        },
        preTasksExecution: async ({ tx, context }) => {
          try {
            const mutations = await plugin.preTasksExecution?.(context);
            return {
              type: 'preTasksExecutionResult',
              payload: { success: true, tx, mutations },
            };
          } catch (e) {
            return {
              type: 'preTasksExecutionResult',
              payload: {
                success: false,
                error: createSerializableError(e),
                tx,
              },
            };
          }
        },
        postTasksExecution: async ({ tx, context }) => {
          try {
            await plugin.postTasksExecution?.(context);
            return {
              type: 'postTasksExecutionResult',
              payload: { success: true, tx },
            };
          } catch (e) {
            return {
              type: 'postTasksExecutionResult',
              payload: {
                success: false,
                error: createSerializableError(e),
                tx,
              },
            };
          }
        },
      });
    })
  );

  // There should only ever be one host -> worker connection
  // since the worker is spawned per host process. As such,
  // we can safely close the worker when the host disconnects.
  socket.on('end', () => {
    // Destroys the socket once it's fully closed.
    socket.destroySoon();
    // Stops accepting new connections, but existing connections are
    // not closed immediately.
    server.close(() => {
      try {
        unlinkSync(socketPath);
      } catch (e) {}
      process.exit(0);
    });
  });
});

server.listen(socketPath);

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
