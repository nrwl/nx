import { consumeMessage, isPluginWorkerMessage } from './messaging';
import { LoadedNxPlugin } from '../internal-api';
import { loadNxPlugin } from '../loader';
import { createSerializableError } from '../../../utils/serializable-error';
import { createServer } from 'net';
import { consumeMessagesFromSocket } from '../../../utils/consume-messages-from-socket';
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
        processProjectGraph: async ({ graph, ctx, tx }) => {
          try {
            const result = await plugin.processProjectGraph(graph, ctx);
            return {
              type: 'processProjectGraphResult',
              payload: { graph: result, success: true, tx },
            };
          } catch (e) {
            return {
              type: 'processProjectGraphResult',
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
              payload: { success: false, error: e.stack, tx },
            };
          }
        },
      });
    })
  );
});

server.listen(socketPath);

process.on('exit', () => {
  server.close();
  try {
    unlinkSync(socketPath);
  } catch (e) {}
});
