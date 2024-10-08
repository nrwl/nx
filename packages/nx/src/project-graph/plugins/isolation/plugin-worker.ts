import { consumeMessage, isPluginWorkerMessage } from './messaging';
import { LoadedNxPlugin } from '../internal-api';
import { loadNxPlugin } from '../loader';
import { createSerializableError } from '../../../utils/serializable-error';
import { consumeMessagesFromSocket } from '../../../utils/consume-messages-from-socket';

import { createServer } from 'net';
import { unlinkSync } from 'fs';

if (process.env.NX_PERF_LOGGING === 'true') {
  require('../../../utils/perf-logging');
}

global.NX_GRAPH_CREATION = true;

let plugin: LoadedNxPlugin;

const socketPath = process.argv[2];

const server = createServer((socket) => {
  socket.on(
    'data',
    consumeMessagesFromSocket((raw) => {
      const message = JSON.parse(raw.toString());
      if (!isPluginWorkerMessage(message)) {
        return;
      }
      return consumeMessage(socket, message, {
        load: async ({ plugin: pluginConfiguration, root }) => {
          process.chdir(root);
          try {
            const [promise] = loadNxPlugin(pluginConfiguration, root);
            plugin = await promise;
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
        shutdown: async () => {
          // Stops accepting new connections, but existing connections are
          // not closed immediately.
          server.close(() => {
            try {
              unlinkSync(socketPath);
            } catch (e) {}
            process.exit(0);
          });
          // Closes existing connection.
          socket.end();
          // Destroys the socket once it's fully closed.
          socket.destroySoon();
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
      });
    })
  );
});

server.listen(socketPath);

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
