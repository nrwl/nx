import { consumeMessage, PluginWorkerMessage } from './messaging';
import { CreateNodesResultWithContext, NormalizedPlugin } from './internal-api';
import { CreateNodesContext } from './public-api';
import { CreateNodesError } from './utils';
import { loadPlugin } from './worker-api';

global.NX_GRAPH_CREATION = true;

let plugin: NormalizedPlugin;
let pluginOptions: unknown;

process.on('message', async (message: string) => {
  consumeMessage<PluginWorkerMessage>(message, {
    load: async ({ plugin: pluginConfiguration, root }) => {
      process.chdir(root);
      try {
        ({ plugin, options: pluginOptions } = await loadPlugin(
          pluginConfiguration,
          root
        ));
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
        const result = await runCreateNodesInParallel(configFiles, context);
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
        const result = await plugin.createDependencies(pluginOptions, context);
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

function runCreateNodesInParallel(
  configFiles: string[],
  context: CreateNodesContext
): Promise<CreateNodesResultWithContext[]> {
  const promises: Array<
    CreateNodesResultWithContext | Promise<CreateNodesResultWithContext>
  > = configFiles.map((file) => {
    performance.mark(`${plugin.name}:createNodes:${file} - start`);
    // Result is either static or a promise, using Promise.resolve lets us
    // handle both cases with same logic
    const value = Promise.resolve(
      plugin.createNodes[1](file, pluginOptions, context)
    );
    return value
      .catch((e) => {
        performance.mark(`${plugin.name}:createNodes:${file} - end`);
        throw new CreateNodesError(
          `Unable to create nodes for ${file} using plugin ${plugin.name}.`,
          e
        );
      })
      .then((r) => {
        performance.mark(`${plugin.name}:createNodes:${file} - end`);
        performance.measure(
          `${plugin.name}:createNodes:${file}`,
          `${plugin.name}:createNodes:${file} - start`,
          `${plugin.name}:createNodes:${file} - end`
        );
        return { ...r, pluginName: plugin.name, file };
      });
  });
  return Promise.all(promises);
}
