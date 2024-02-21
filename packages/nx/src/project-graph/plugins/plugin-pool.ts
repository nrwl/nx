import { ChildProcess, fork } from 'child_process';
import path = require('path');
import { PluginWorkerResult, consumeMessage, createMessage } from './messaging';
import { PluginConfiguration } from '../../config/nx-json';
import { RemotePlugin, nxPluginCache } from './internal-api';
import { ProjectGraph } from '../../config/project-graph';
import { logger } from '../../utils/logger';

const pool: ChildProcess[] = [];

const pidMap = new Map<number, string>();

export function loadRemoteNxPlugin(plugin: PluginConfiguration, root: string) {
  // this should only really be true when running unit tests within
  // the Nx repo. We still need to start the worker in this case,
  // but its typescript.
  const isWorkerTypescript = path.extname(__filename) === '.ts';
  const workerPath = path.join(__dirname, 'plugin-worker');
  const worker = fork(workerPath, [], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      ...(isWorkerTypescript
        ? {
            // Ensures that the worker uses the same tsconfig as the main process
            TS_NODE_PROJECT: path.join(__dirname, '../../../tsconfig.lib.json'),
          }
        : {}),
    },
    execArgv: [
      ...process.execArgv,
      // If the worker is typescript, we need to register ts-node
      ...(isWorkerTypescript ? ['-r', 'ts-node/register'] : []),
    ],
  });
  worker.send(createMessage({ type: 'load', payload: { plugin, root } }));
  pool.push(worker);
  
  logger.verbose(`[plugin-worker] started worker: ${worker.pid}`);
  
  return new Promise<RemotePlugin>((res, rej) => {
    worker.on('message', createWorkerHandler(worker, res, rej));
    worker.on('exit', () => workerOnExitHandler(worker));
  });
}

let pluginWorkersShutdown = false;

export async function shutdownPluginWorkers() {
  // Clears the plugin cache so no refs to the workers are held
  nxPluginCache.clear();

  // Marks the workers as shutdown so that we don't report unexpected exits
  pluginWorkersShutdown = true;
  
  const promises = [];

  for (const p of pool) {
    p.send(createMessage({ type: 'shutdown', payload: undefined }), (error) => {
      if (error) {
        // This occurs when the worker is already dead, and we can ignore it
      } else {
        promises.push(
          // Create a promise that resolves when the worker exits
          new Promise<void>((res, rej) => {
            p.once('exit', () => res());
          })
        );
      }
    });
  }
  return Promise.all(promises);
}


/**
 * Creates a message handler for the given worker.
 * @param worker Instance of plugin-worker
 * @param onload Resolver for RemotePlugin promise
 * @param onloadError Rejecter for RemotePlugin promise
 * @returns Function to handle messages from the worker
 */
function createWorkerHandler(
  worker: ChildProcess,
  onload: (plugin: RemotePlugin) => void,
  onloadError: (err?: unknown) => void
) {

  // We store resolver and rejecter functions in the outer scope so that we can
  // resolve/reject the promise from the message handler. The flow is something like:
  // 1. plugin api called
  // 2. remote plugin sends message to worker, creates promise and stores resolver/rejecter
  // 3. worker performs API request
  // 4. worker sends result back to main process
  // 5. main process resolves/rejects promise based on result

  let createNodesResolver: (
    result: Awaited<ReturnType<RemotePlugin['createNodes'][1]>>
  ) => void | undefined;
  let createNodesRejecter: (err: unknown) => void | undefined;
  let createDependenciesResolver: (
    result: ReturnType<RemotePlugin['createDependencies']>
  ) => void | undefined;
  let createDependenciesRejecter: (err: unknown) => void | undefined;
  let processProjectGraphResolver: (updatedGraph: ProjectGraph) => void;
  let processProjectGraphRejecter: (err: unknown) => void | undefined;

  let pluginName: string;

  return function (message: string) {
    const parsed = JSON.parse(message);
    logger.verbose(
      `[plugin-pool] received message: ${parsed.type} from ${
        pluginName ?? worker.pid
      }`
    );
    consumeMessage<PluginWorkerResult>(parsed, {
      'load-result': (result) => {
        if (result.success) {
          const { name, createNodesPattern } = result;
          pluginName = name;
          pidMap.set(worker.pid, name);
          onload({
            name,
            createNodes: createNodesPattern
              ? [
                  createNodesPattern,
                  (configFiles, ctx) => {
                    return new Promise((res, rej) => {
                      worker.send(
                        createMessage({
                          type: 'createNodes',
                          payload: { configFiles, context: ctx },
                        })
                      );
                      createNodesResolver = res;
                      createNodesRejecter = rej;
                    });
                  },
                ]
              : undefined,
            createDependencies: result.hasCreateDependencies
              ? (opts, ctx) => {
                  return new Promise((res, rej) => {
                    worker.send(
                      createMessage({
                        type: 'createDependencies',
                        payload: { context: ctx },
                      })
                    );
                    createDependenciesResolver = res;
                    createDependenciesRejecter = rej;
                  });
                }
              : undefined,
            processProjectGraph: result.hasProcessProjectGraph
              ? (graph, ctx) => {
                  return new Promise((res, rej) => {
                    worker.send(
                      createMessage({
                        type: 'processProjectGraph',
                        payload: { graph, ctx },
                      })
                    );
                    processProjectGraphResolver = res;
                    processProjectGraphRejecter = rej;
                  });
                }
              : undefined,
          });
        } else if (result.success === false) {
          onloadError(result.error);
        }
      },
      createDependenciesResult: (result) => {
        if (result.success) {
          createDependenciesResolver(result.dependencies);
          createDependenciesResolver = undefined;
        } else if (result.success === false) {
          createDependenciesRejecter(result.error);
          createDependenciesRejecter = undefined;
        }
      },
      createNodesResult: (payload) => {
        if (payload.success) {
          createNodesResolver(payload.result);
          createNodesResolver = undefined;
        } else if (payload.success === false) {
          createNodesRejecter(payload.error);
          createNodesRejecter = undefined;
        }
      },
      processProjectGraphResult: (result) => {
        if (result.success) {
          processProjectGraphResolver(result.graph);
          processProjectGraphResolver = undefined;
        } else if (result.success === false) {
          processProjectGraphRejecter(result.error);
          processProjectGraphRejecter = undefined;
        }
      },
    });
  };
}

function workerOnExitHandler(worker: ChildProcess) {
  return () => {
    if (!pluginWorkersShutdown) {
      shutdownPluginWorkers();
      throw new Error(
        `[Nx] plugin worker ${
          pidMap.get(worker.pid) ?? worker.pid
        } exited unexpectedly`
      );
    }
  };
}

process.on('exit', () => {
  shutdownPluginWorkers();
});
