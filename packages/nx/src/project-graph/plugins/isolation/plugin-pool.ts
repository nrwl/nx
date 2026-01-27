import { ChildProcess, spawn } from 'child_process';
import { Socket, connect } from 'net';
import { Readable, Writable } from 'stream';
import path = require('path');

import { PluginConfiguration } from '../../../config/nx-json';

// TODO (@AgentEnder): After scoped verbose logging is implemented, re-add verbose logs here.
// import { logger } from '../../utils/logger';

import { getPluginOsSocketPath } from '../../../daemon/socket-utils';
import { consumeMessagesFromSocket } from '../../../utils/consume-messages-from-socket';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { getNxRequirePaths } from '../../../utils/installation-directory';
import { resolveNxPlugin } from '../resolve-plugin';
import {
  consumeMessage,
  isPluginWorkerResult,
  sendMessageOverSocket,
} from './messaging';

const cleanupFunctions = new Set<() => void>();

const pluginNames = new Map<ChildProcess, string>();

const PLUGIN_TIMEOUT_HINT_TEXT =
  'As a last resort, you can set NX_PLUGIN_NO_TIMEOUTS=true to bypass this timeout.';

const MINUTES = 10;

const MAX_MESSAGE_WAIT =
  process.env.NX_PLUGIN_NO_TIMEOUTS === 'true'
    ? // Registering a timeout prevents the process from exiting
      // if the call to a plugin happens to be the only thing
      // keeping the process alive. As such, even if timeouts are disabled
      // we need to register one. 2147483647 is the max timeout
      // that Node.js allows, and is equivalent to 24.8 days....
      // This does mean that the NX_PLUGIN_NO_TIMEOUTS env var
      // would still timeout after 24.8 days, but that seems
      // like a reasonable compromise.
      2147483647
    : 1000 * 60 * MINUTES; // 10 minutes

interface PendingPromise {
  promise: Promise<unknown>;
  resolver: (result?: any) => void;
  rejector: (err: any) => void;
}

type NxPluginWorkerCache = Map<string, Promise<LoadedNxPlugin>>;

const nxPluginWorkerCache: NxPluginWorkerCache = (global[
  'nxPluginWorkerCache'
] ??= new Map());

export async function loadRemoteNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number
): Promise<[Promise<LoadedNxPlugin>, () => void]> {
  const cacheKey = JSON.stringify({ plugin, root });
  if (nxPluginWorkerCache.has(cacheKey)) {
    return [nxPluginWorkerCache.get(cacheKey), () => {}];
  }
  const moduleName = typeof plugin === 'string' ? plugin : plugin.plugin;

  const { name, pluginPath, shouldRegisterTSTranspiler } =
    await resolveNxPlugin(moduleName, root, getNxRequirePaths(root));

  const { worker, socket } = await startPluginWorker(name);

  // Register plugin worker as a subprocess of the main CLI
  // This allows metrics collection when the daemon is not used
  // Fire-and-forget to avoid blocking the loading of the plugin
  if (worker.pid) {
    (async () => {
      try {
        const { isOnDaemon } = await import('../../../daemon/is-on-daemon');
        /**
         * We can only register the plugin worker as a subprocess of the main CLI
         * when the daemon is not used. Additionally, we can't explcitly register
         * the plugin worker as a subprocess of the daemon, because when on the
         * daemon, we'd get a different instance of the process metrics service.
         */
        if (!isOnDaemon()) {
          const { getProcessMetricsService } = await import(
            '../../../tasks-runner/process-metrics-service'
          );

          getProcessMetricsService().registerMainCliSubprocess(
            worker.pid,
            `${name}${index !== undefined ? ` (${index})` : ''}`
          );
        }
      } catch {
        // Silently ignore - metrics collection is optional
      }
    })();
  }

  const pendingPromises = new Map<string, PendingPromise>();

  const exitHandler = createWorkerExitHandler(worker, pendingPromises);

  const cleanupFunction = () => {
    worker.off('exit', exitHandler);
    // Unpipe streams to prevent hanging processes and release references
    if (worker.stdout) {
      worker.stdout.unpipe(process.stdout);
      worker.stdout.destroy();
    }
    if (worker.stderr) {
      worker.stderr.unpipe(process.stderr);
      worker.stderr.destroy();
    }
    socket.destroy();
    nxPluginWorkerCache.delete(cacheKey);
  };

  cleanupFunctions.add(cleanupFunction);

  const pluginPromise = new Promise<LoadedNxPlugin>((res, rej) => {
    sendMessageOverSocket(socket, {
      type: 'load',
      payload: { plugin, root, name, pluginPath, shouldRegisterTSTranspiler },
    });
    // logger.verbose(`[plugin-worker] started worker: ${worker.pid}`);

    const loadTimeout = setTimeout(() => {
      rej(
        new Error(
          `Loading "${
            typeof plugin === 'string' ? plugin : plugin.plugin
          }" timed out after ${MINUTES} minutes. ${PLUGIN_TIMEOUT_HINT_TEXT}`
        )
      );
    }, MAX_MESSAGE_WAIT);
    socket.on(
      'data',
      consumeMessagesFromSocket(
        createWorkerHandler(
          worker,
          pendingPromises,
          (val) => {
            if (loadTimeout) clearTimeout(loadTimeout);
            res(val);
          },
          rej,
          socket
        )
      )
    );
    worker.on('exit', exitHandler);
  });

  nxPluginWorkerCache.set(cacheKey, pluginPromise);

  return [pluginPromise, cleanupFunction];
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
  onloadError: (err?: unknown) => void,
  socket: Socket
) {
  let pluginName: string;

  let txId = 0;

  return function (raw: string) {
    const message = JSON.parse(raw);

    if (!isPluginWorkerResult(message)) {
      return;
    }
    return consumeMessage(socket, message, {
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
                    const tx =
                      pluginName + worker.pid + ':createNodes:' + txId++;
                    return registerPendingPromise(
                      tx,
                      pending,
                      () => {
                        sendMessageOverSocket(socket, {
                          type: 'createNodes',
                          payload: { configFiles, context: ctx, tx },
                        });
                      },
                      {
                        plugin: pluginName,
                        operation: 'createNodes',
                      }
                    );
                  },
                ]
              : undefined,
            createDependencies: result.hasCreateDependencies
              ? (ctx) => {
                  const tx =
                    pluginName + worker.pid + ':createDependencies:' + txId++;
                  return registerPendingPromise(
                    tx,
                    pending,
                    () => {
                      sendMessageOverSocket(socket, {
                        type: 'createDependencies',
                        payload: { context: ctx, tx },
                      });
                    },
                    {
                      plugin: pluginName,
                      operation: 'createDependencies',
                    }
                  );
                }
              : undefined,
            createMetadata: result.hasCreateMetadata
              ? (graph, ctx) => {
                  const tx =
                    pluginName + worker.pid + ':createMetadata:' + txId++;
                  return registerPendingPromise(
                    tx,
                    pending,
                    () => {
                      sendMessageOverSocket(socket, {
                        type: 'createMetadata',
                        payload: { graph, context: ctx, tx },
                      });
                    },
                    {
                      plugin: pluginName,
                      operation: 'createMetadata',
                    }
                  );
                }
              : undefined,
            preTasksExecution: result.hasPreTasksExecution
              ? (context) => {
                  const tx =
                    pluginName + worker.pid + ':preTasksExecution:' + txId++;
                  return registerPendingPromise(
                    tx,
                    pending,
                    () => {
                      sendMessageOverSocket(socket, {
                        type: 'preTasksExecution',
                        payload: { tx, context },
                      });
                    },
                    {
                      plugin: pluginName,
                      operation: 'preTasksExecution',
                    }
                  );
                }
              : undefined,
            postTasksExecution: result.hasPostTasksExecution
              ? (context) => {
                  const tx =
                    pluginName + worker.pid + ':postTasksExecution:' + txId++;
                  return registerPendingPromise(
                    tx,
                    pending,
                    () => {
                      sendMessageOverSocket(socket, {
                        type: 'postTasksExecution',
                        payload: { tx, context },
                      });
                    },
                    {
                      plugin: pluginName,
                      operation: 'postTasksExecution',
                    }
                  );
                }
              : undefined,
          });
        } else if (result.success === false) {
          onloadError(result.error);
        }
      },
      createDependenciesResult: ({ tx, ...result }) => {
        const { resolver, rejector } = getPendingPromise(tx, pending);
        if (result.success) {
          resolver(result.dependencies);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      createNodesResult: ({ tx, ...result }) => {
        const { resolver, rejector } = getPendingPromise(tx, pending);
        if (result.success) {
          resolver(result.result);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      createMetadataResult: ({ tx, ...result }) => {
        const { resolver, rejector } = getPendingPromise(tx, pending);
        if (result.success) {
          resolver(result.metadata);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      preTasksExecutionResult: ({ tx, ...result }) => {
        const { resolver, rejector } = getPendingPromise(tx, pending);
        if (result.success) {
          resolver(result.mutations);
        } else if (result.success === false) {
          rejector(result.error);
        }
      },
      postTasksExecutionResult: ({ tx, ...result }) => {
        const { resolver, rejector } = getPendingPromise(tx, pending);
        if (result.success) {
          resolver();
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
    // Clean up piped streams when worker exits to prevent hanging
    if (worker.stdout) {
      worker.stdout.unpipe(process.stdout);
    }
    if (worker.stderr) {
      worker.stderr.unpipe(process.stderr);
    }
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

function getPendingPromise(tx: string, pending: Map<string, PendingPromise>) {
  const pendingPromise = pending.get(tx);

  if (!pendingPromise) {
    throw new Error(
      `No pending promise found for transaction "${tx}". This may indicate a bug in the plugin pool. Currently pending promises:\n` +
        Array.from(pending.keys())
          .map((t) => `  -  ${t}`)
          .join('\n')
    );
  }

  const { rejector, resolver } = pendingPromise;
  return {
    rejector,
    resolver,
  };
}

function registerPendingPromise(
  tx: string,
  pending: Map<string, PendingPromise>,
  callback: () => void,
  context: {
    plugin: string;
    operation: string;
  }
): Promise<any> {
  let resolver: (x: unknown) => void,
    rejector: (e: Error | unknown) => void,
    timeout: NodeJS.Timeout;

  const promise = new Promise((res, rej) => {
    rejector = rej;
    resolver = res;

    timeout = setTimeout(() => {
      rej(
        new Error(
          `${context.plugin} timed out after ${MINUTES} minutes during ${context.operation}. ${PLUGIN_TIMEOUT_HINT_TEXT}`
        )
      );
    }, MAX_MESSAGE_WAIT);

    callback();
  }).finally(() => {
    pending.delete(tx);
    if (timeout) clearTimeout(timeout);
  });

  pending.set(tx, {
    promise,
    resolver,
    rejector,
  });

  return promise;
}

global.nxPluginWorkerCount ??= 0;

async function startPluginWorker(name: string) {
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

  const ipcPath = getPluginOsSocketPath(
    [process.pid, global.nxPluginWorkerCount++, performance.now()].join('-')
  );

  const worker = spawn(
    process.execPath,
    [
      ...(isWorkerTypescript ? ['--require', 'ts-node/register'] : []),
      workerPath,
      ipcPath,
      name,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      detached: true,
      shell: false,
      windowsHide: true,
    }
  );

  // To make debugging easier and allow plugins to communicate things
  // like performance metrics, we pipe the stdout/stderr of the worker
  // to the main process.
  // This adds one listener per plugin to a few events on process.stdout/stderr,
  // so we need to increase the max listener count to avoid warnings.
  //
  // We originally used `inherit` for stdio, but that caused issues with
  // some environments where the terminal was left in an inconsistent state
  // that prevented `↑`/`↓` arrow keys from working correctly after Nx finished execution.
  // Instead, they would print things like `^[[A`/`^[[B` to the terminal.
  const stdoutMaxListeners = process.stdout.getMaxListeners();
  const stderrMaxListeners = process.stderr.getMaxListeners();
  if (stdoutMaxListeners !== 0) {
    process.stdout.setMaxListeners(stdoutMaxListeners + 1);
  }
  if (stderrMaxListeners !== 0) {
    process.stderr.setMaxListeners(stderrMaxListeners + 1);
  }

  // Pipe and unref the worker streams. The utility handles cross-runtime compatibility.
  pipeAndUnrefChildStream(worker.stdout, process.stdout, 'stdout');
  pipeAndUnrefChildStream(worker.stderr, process.stderr, 'stderr');

  // Unref the worker process so it doesn't prevent the parent from exiting.
  worker.unref();

  let attempts = 0;
  return new Promise<{
    worker: ChildProcess;
    socket: Socket;
  }>((resolve, reject) => {
    const id = setInterval(async () => {
      const socket = await isServerAvailable(ipcPath);
      if (socket) {
        socket.unref();
        clearInterval(id);
        resolve({
          worker,
          socket,
        });
      } else if (attempts > 10000) {
        // daemon fails to start, the process probably exited
        // we print the logs and exit the client
        reject('Failed to start plugin worker.');
      } else {
        attempts++;
      }
    }, 10);
  });
}

function isServerAvailable(ipcPath: string): Promise<Socket | false> {
  return new Promise((resolve) => {
    try {
      const socket = connect(ipcPath, () => {
        resolve(socket);
      });
      socket.once('error', () => {
        resolve(false);
      });
    } catch (err) {
      resolve(false);
    }
  });
}

function getTypeName(u: unknown): string {
  if (u === null) return 'null';
  if (u === undefined) return 'undefined';
  if (typeof u !== 'object') return typeof u;
  if (Array.isArray(u)) {
    const innerTypes = u.map((el) => getTypeName(el));
    return `Array<${Array.from(new Set(innerTypes)).join('|')}>`;
  }
  return u.constructor?.name ?? 'unknown object';
}

/**
 * Detects if we're running under an alternative JavaScript runtime (Bun or Deno).
 * Returns the runtime name for helpful error messages, or null if running on Node.js.
 */
function detectAlternativeRuntime(): 'bun' | 'deno' | null {
  // Check for Bun runtime - the Bun global is only available in Bun
  if ('Bun' in globalThis && typeof (globalThis as any).Bun !== 'undefined') {
    return 'bun';
  }
  // Check for Deno runtime - the Deno global is only available in Deno
  if ('Deno' in globalThis && typeof (globalThis as any).Deno !== 'undefined') {
    return 'deno';
  }
  return null;
}

/**
 * Pipes a child process stream to a destination and attempts to unref it to prevent
 * the stream from keeping the parent process alive.
 *
 * In Node.js, child process stdio streams are actually net.Socket instances when
 * using 'pipe' stdio option. However, alternative runtimes like Bun and Deno may
 * use standard Readable/Writable streams instead.
 *
 * This function:
 * 1. Pipes the source to the destination
 * 2. Attempts to unref the source stream to allow the parent process to exit
 * 3. Uses duck-typing to check for unref support when not a Socket instance
 * 4. Emits helpful warnings for alternative runtimes if unref is not available
 *
 * @param source - The child process stream (stdout or stderr)
 * @param destination - The process stream to pipe to (process.stdout or process.stderr)
 * @param streamName - Name of the stream for warning messages ('stdout' or 'stderr')
 */
function pipeAndUnrefChildStream(
  source: Readable | null,
  destination: Writable,
  streamName: 'stdout' | 'stderr'
): void {
  if (!source) {
    return;
  }

  source.pipe(destination);

  // Node.js creates net.Socket instances for stdio pipes. Use instanceof check first.
  if (source instanceof Socket) {
    source.unref();
    return;
  }

  // For non-Socket streams (e.g., in Bun/Deno), use duck-typing to check for unref
  // NOTE: These should also be a Socket, but alternative runtimes may implement differently...
  // See:
  // - https://github.com/denoland/deno/issues/31961
  // - https://github.com/oven-sh/bun/issues/26505
  if (typeof (source as any).unref === 'function') {
    (source as any).unref();
    return;
  }

  // Stream doesn't support unref - emit a warning with runtime-specific guidance
  const runtime = detectAlternativeRuntime();
  if (runtime) {
    console.warn(
      `[NX] worker.${streamName} does not support unref() in ${runtime}. ` +
        `This may cause the process to hang when waiting for plugin workers to exit. ` +
        `This is a known limitation of ${runtime}'s Node.js compatibility layer.`
    );
  } else {
    console.warn(
      `[NX] worker.${streamName} is not a net.Socket and does not have an unref() method. ` +
        `Expected Socket, got ${getTypeName(source)}. ` +
        `This may cause the process to hang when waiting for plugin workers to exit.`
    );
  }
}
