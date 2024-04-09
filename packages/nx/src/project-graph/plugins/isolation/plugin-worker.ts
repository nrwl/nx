import { consumeMessage, PluginWorkerMessage } from './messaging';
import { LoadedNxPlugin } from '../internal-api';
import { loadNxPlugin } from '../loader';
import { runCreateNodesInParallel } from '../utils';

global.NX_GRAPH_CREATION = true;

let plugin: LoadedNxPlugin;

process.on('message', async (message: string) => {
  consumeMessage<PluginWorkerMessage>(message, {
    load: async ({ plugin: pluginConfiguration, root }) => {
      process.chdir(root);
      try {
        const [promise] = loadNxPlugin(pluginConfiguration, root);
        plugin = await promise;
        return {
          type: 'load-result',
          payload: {
            name: plugin.name,
            createNodesPattern: plugin.createNodes?.[0],
            hasCreateDependencies:
              'createDependencies' in plugin && !!plugin.createDependencies,
            hasProcessProjectGraph:
              'processProjectGraph' in plugin && !!plugin.processProjectGraph,
            success: true,
          },
        };
      } catch (e) {
        return {
          type: 'load-result',
          payload: {
            success: false,
            error: `Could not load plugin ${plugin} \n ${
              e instanceof Error ? e.stack : ''
            }`,
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
          payload: { success: false, error: e.stack, tx },
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
          payload: { success: false, error: e.stack, tx },
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
          payload: { success: false, error: e.stack, tx },
        };
      }
    },
  });
});
