import { ChildProcess, Serializable, fork } from 'child_process';
import path = require('path');

import { PluginConfiguration } from '../../../config/nx-json';

// TODO (@AgentEnder): After scoped verbose logging is implemented, re-add verbose logs here.
// import { logger } from '../../utils/logger';

import { LoadedNxPlugin, nxPluginCache } from '../internal-api';
import { consumeMessage, isPluginWorkerResult } from './messaging';

const cleanupFunctions = new Set<() => void>();

const pluginNames = new Map<ChildProcess, string>();

interface PendingPromise {
  promise: Promise<unknown>;
  resolver: (result: any) => void;
  rejector: (err: any) => void;
}

export function loadRemoteNxPlugin(
  plugin: PluginConfiguration,
  root: string
): Promise<LoadedNxPlugin> {
  // this should only really be true when running unit tests within
  // the Nx repo. We still need to start the worker in this case,
  // but its typescript.
  const isWorkerTypescript = path.extname(__filename) === '.ts';
  const workerPath = path.join(__dirname, 'plugin-worker');

  const env: Record<string, string> = {
    ...process.env,
    ...(isWorkerTypescript
      ? {
          // Ensures that the worker uses the same tsconfig as the main process
          TS_NODE_PROJECT: path.join(
            __dirname,
            '../../../../tsconfig.lib.json'
          ),
        }
      : {}),
  };

  const worker = fork(workerPath, [], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env,
    execArgv: [
      ...process.execArgv,
      // If the worker is typescript, we need to register ts-node
      ...(isWorkerTypescript ? ['-r', 'ts-node/register'] : []),
    ],
  });
  worker.send({ type: 'load', payload: { plugin, root } });

  // logger.verbose(`[plugin-worker] started worker: ${worker.pid}`);

  const pendingPromises = new Map<string, PendingPromise>();

  const exitHandler = createWorkerExitHandler(worker, pendingPromises);

  const cleanupFunction = () => {
    worker.off('exit', exitHandler);
    shutdownPluginWorker(worker);
  };

  cleanupFunctions.add(cleanupFunction);

  return new Promise<LoadedNxPlugin>((res, rej) => {
    worker.on(
      'message',
      createWorkerHandler(worker, pendingPromises, res, rej)
    );
    worker.on('exit', exitHandler);
  });
}

function shutdownPluginWorker(worker: ChildProcess) {
  // Clears the plugin cache so no refs to the workers are held
  nxPluginCache.clear();

  // logger.verbose(`[plugin-pool] starting worker shutdown`);

  worker.kill('SIGINT');
}

/**
 * Creates a message handler for the given worker.
 * @param worker Instance of plugin-worker
 * @param pending Set of pending promises
 * @param onload Resolver for RemotePlugin promise
 * @param onloadError Rejecter for RemotePlugin promise
 * @returns Function to handle messages from the worker
 */
function createWorkerHandler(
  worker: ChildProcess,
  pending: Map<string, PendingPromise>,
  onload: (plugin: LoadedNxPlugin) => void,
  onloadError: (err?: unknown) => void
) {
  let pluginName: string;

  return function (message: Serializable) {
    if (!isPluginWorkerResult(message)) {
      return;
    }
    return consumeMessage(message, {
      'load-result': (result) => {
        if (result.success) {
          const { name, createNodesPattern, include, exclude } = result;
          pluginName = name;
          pluginNames.set(worker, pluginName);
          onload({
            name,
            include,
            exclude,
            createNodes: createNodesPattern
              ? [
                  createNodesPattern,
                  (configFiles, ctx) => {
                    const tx = pluginName + ':createNodes:' + performance.now();
                    return registerPendingPromise(tx, pending, () => {
                      worker.send({
                        type: 'createNodes',
                        payload: { configFiles, context: ctx, tx },
                      });
                    });
                  },
                ]
              : undefined,
            createDependencies: result.hasCreateDependencies
              ? (ctx) => {
                  const tx =
                    pluginName + ':createDependencies:' + performance.now();
                  return registerPendingPromise(tx, pending, () => {
                    worker.send({
                      type: 'createDependencies',
                      payload: { context: ctx, tx },
                    });
                  });
                }
              : undefined,
            processProjectGraph: result.hasProcessProjectGraph
              ? (graph, ctx) => {
                  const tx =
                    pluginName + ':processProjectGraph:' + performance.now();
                  return registerPendingPromise(tx, pending, () => {
                    worker.send({
                      type: 'processProjectGraph',
                      payload: { graph, ctx, tx },
                    });
                  });
                }
              : undefined,
            createMetadata: result.hasCreateMetadata
              ? (graph, ctx) => {
                  const tx =
                    pluginName + ':createMetadata:' + performance.now();
                  return registerPendingPromise(tx, pending, () => {
                    worker.send({
                      type: 'createMetadata',
                      payload: { graph, context: ctx, tx },
                    });
                  });
                }
              : undefined,
          });
        } else if (result.success === false) {
          onloadError(result.error);
        }
      },
      createDependenciesResult: ({ tx, ...result }) => {
        const { resolver, rejector } = pending.get(tx);
        if (result.success) {
          resolver(result.dependencies);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      createNodesResult: ({ tx, ...result }) => {
        const { resolver, rejector } = pending.get(tx);
        if (result.success) {
          resolver(result.result);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      processProjectGraphResult: ({ tx, ...result }) => {
        const { resolver, rejector } = pending.get(tx);
        if (result.success) {
          resolver(result.graph);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      createMetadataResult: ({ tx, ...result }) => {
        const { resolver, rejector } = pending.get(tx);
        if (result.success) {
          resolver(result.metadata);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
    });
  };
}

function createWorkerExitHandler(
  worker: ChildProcess,
  pendingPromises: Map<string, PendingPromise>
) {
  return () => {
    for (const [_, pendingPromise] of pendingPromises) {
      pendingPromise.rejector(
        new Error(
          `Plugin worker ${
            pluginNames.get(worker) ?? worker.pid
          } exited unexpectedly with code ${worker.exitCode}`
        )
      );
    }
  };
}

process.on('exit', () => {
  for (const fn of cleanupFunctions) {
    fn();
  }
});

function registerPendingPromise(
  tx: string,
  pending: Map<string, PendingPromise>,
  callback: () => void
): Promise<any> {
  let resolver, rejector;

  const promise = new Promise((res, rej) => {
    resolver = res;
    rejector = rej;

    callback();
  }).finally(() => {
    pending.delete(tx);
  });

  pending.set(tx, {
    promise,
    resolver,
    rejector,
  });

  return promise;
}
