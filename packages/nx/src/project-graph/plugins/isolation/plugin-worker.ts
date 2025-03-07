import { performance } from 'node:perf_hooks';

performance.mark(`plugin worker ${process.pid} code loading -- start`);

import { consumeMessage, isPluginWorkerMessage } from './messaging';
import { createSerializableError } from '../../../utils/serializable-error';
import { consumeMessagesFromSocket } from '../../../utils/consume-messages-from-socket';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { createServer } from 'net';
import { unlinkSync } from 'fs';

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
let connected = false;
let plugin: LoadedNxPlugin;

const socketPath = process.argv[2];

const server = createServer((socket) => {
  connected = true;
  // This handles cases where the host process was killed
  // after the worker connected but before the worker was
  // instructed to load the plugin.
  const loadTimeout = setTimeout(() => {
    console.error(
      `Plugin Worker exited because no plugin was loaded within 10 seconds of starting up.`
    );
    process.exit(1);
  }, 10000).unref();
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
          if (loadTimeout) clearTimeout(loadTimeout);
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
        createNodes: async ({ configFiles, context, tx }) => {
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
        createDependencies: async ({ context, tx }) => {
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
        createMetadata: async ({ graph, context, tx }) => {
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

if (process.env.NX_PLUGIN_NO_TIMEOUTS !== 'true') {
  setTimeout(() => {
    if (!connected) {
      console.error(
        'The plugin worker is exiting as it was not connected to within 5 seconds.'
      );
      process.exit(1);
    }
  }, 5000).unref();
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
