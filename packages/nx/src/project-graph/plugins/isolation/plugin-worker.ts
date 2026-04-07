// Must be the first import — see enable-compile-cache.ts.
import '../../../utils/enable-compile-cache';
import { performance } from 'node:perf_hooks';

performance.mark(`plugin worker ${process.pid} code loading -- start`);

import {
  consumeMessagesFromSocket,
  parseMessage,
} from '../../../utils/consume-messages-from-socket';
import { logger } from '../../../utils/logger';
import { createSerializableError } from '../../../utils/serializable-error';
import { assertNotForeignWorkspaceMessage } from '../../../daemon/message-types/daemon-message';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import { consumeMessage, isPluginWorkerMessage } from './messaging';
import { setPluginWorkerHostSocket } from './worker-streaming';

import { unlinkSync } from 'fs';
import { createServer } from 'net';
import { startAnalytics } from '../../../analytics';
import { applyDaemonEnvFromClient } from '../../../daemon/client/daemon-environment';
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
// The host's root, passed explicitly rather than re-resolved: a host that set
// its root at runtime would resolve a different one here and drop every
// legitimate message as foreign.
const hostWorkspaceRoot = process.argv[4];

// Positional, so inserting an argument host-side shifts all of them — and the
// symptom is silent and total: an undefined hostWorkspaceRoot makes every
// message look foreign while the host waits out its plugin timeout.
if (!socketPath || !expectedPluginName || !hostWorkspaceRoot) {
  console.error(
    `[plugin-worker] started with an incomplete argument list ` +
      `(socketPath=${socketPath}, pluginName=${expectedPluginName}, hostWorkspaceRoot=${hostWorkspaceRoot}). ` +
      `This is an Nx bug — please report it at https://github.com/nrwl/nx/issues.`
  );
  process.exit(1);
}

// Optional eager-load args passed by the host to overlap plugin loading with
// the socket-connection phase (argv[5..7] set when host knows the plugin path
// at spawn time). The host also spawns this worker with cwd set to the plugin
// root, so eager loading runs in the correct directory without a process.chdir.
const eagerPluginPath: string | undefined = process.argv[5];
const eagerPluginConfig = process.argv[6] ? JSON.parse(process.argv[6]) : null;
const eagerShouldRegisterTSTranspiler = process.argv[7] === '1';

// Populated after server.listen() so the socket is ready before we block
// the event loop with synchronous require() calls.
let eagerLoadPromise: Promise<LoadedNxPlugin> | null = null;

const CONNECT_TIMEOUT_MS = 30_000;

let connectErrorTimeout = setErrorTimeout(
  CONNECT_TIMEOUT_MS,
  `The plugin worker for ${expectedPluginName} is exiting as it was not connected to within ${CONNECT_TIMEOUT_MS / 1000} seconds. ` +
    'Plugin workers expect to receive a socket connection from the parent process shortly after being started. ' +
    'If you are seeing this issue, please report it to the Nx team at https://github.com/nrwl/nx/issues.'
);

const server = createServer((socket) => {
  connectErrorTimeout?.clear();

  // Make the host-facing socket available to plugin code running in this
  // worker so it can emit log / progress notifications without having
  // the socket threaded through every call site.
  setPluginWorkerHostSocket(socket);

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
      // Same check the daemon applies to its own socket. Dropped rather than thrown:
      // a stray foreign message must not kill a worker serving its host. The daemon
      // has a response channel and surfaces it to the client instead.
      try {
        assertNotForeignWorkspaceMessage(
          message,
          hostWorkspaceRoot,
          `The Nx plugin worker "${expectedPluginName}" (pid: ${process.pid})`
        );
      } catch (e) {
        logger.verbose(
          `[plugin-worker] ignored a "${message.type}" message: ${
            e instanceof Error ? e.message : e
          }`
        );
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
          return withErrorHandling(async () => {
            // If we eagerly started loading this exact plugin, await that
            // already-in-progress promise instead of starting from scratch.
            if (eagerLoadPromise && pluginPath === eagerPluginPath) {
              plugin = await eagerLoadPromise;
            } else {
              process.chdir(root);
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
            }
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
            applyDaemonEnvFromClient(env);
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

server.on('error', (err: NodeJS.ErrnoException) => {
  // Without this the host only sees "exited before the connection was
  // established"; the errno distinguishes a denied bind from EADDRINUSE.
  console.error(
    `[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) failed to listen on ${socketPath}: ${err.message}`
  );
  process.exit(1);
});
// A worker killed without its 'end' handler leaves the socket behind. Colliding
// takes a recycled host pid landing on the same counter *and* the same 4 random
// bytes; the random component is what this unlink rests on, and on Windows it is
// the only barrier, since the endpoint is a namespace object and the mode never
// applies. A failed bind surfaces through the error handler above.
try {
  unlinkSync(socketPath);
} catch {}
server.listen(socketPath, () => {
  logger.verbose(
    `[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) listening on ${socketPath}`
  );
});

// Kick off eager loading after server.listen() so the socket is available
// before we start loading the plugin. Deferring the load to setImmediate lets
// server.listen() finish first, and the load itself overlaps the host's
// connect + load-message round-trip. We resolve the module via
// require(require.resolve(...)) — the same mechanism the load-message fallback
// uses — so it works for both the built .js worker and the ts-node .ts worker.
// (A bare import('../x.js') fails to resolve under the ts-node source path,
// where only the .ts file exists.)
if (eagerPluginPath && eagerPluginConfig !== null) {
  eagerLoadPromise = new Promise<LoadedNxPlugin>((resolve, reject) => {
    setImmediate(async () => {
      try {
        const { loadResolvedNxPluginAsync } = require(
          require.resolve('../load-resolved-plugin')
        );
        if (eagerShouldRegisterTSTranspiler) {
          (
            require('../transpiler') as typeof import('../transpiler')
          ).registerPluginTSTranspiler();
        }
        resolve(
          await loadResolvedNxPluginAsync(
            eagerPluginConfig,
            eagerPluginPath,
            expectedPluginName
          )
        );
      } catch (e) {
        reject(e);
      }
    });
  });
  // Suppress unhandledRejection if the eager load fails before the `load`
  // message handler attaches its own handler. The rejection is still
  // propagated when the load handler awaits this promise.
  eagerLoadPromise.catch(() => {});
}

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

const cleanup = () => {
  server.close();
  try {
    unlinkSync(socketPath);
  } catch (e) {}
};

const events = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

events.forEach((event) =>
  process.once(event, () => {
    cleanup();
    process.exit(0);
  })
);
// Cleanup only: process.exit() here would override the real exit code.
process.once('exit', cleanup);
const fatalHandler = (error: unknown) => {
  // Registering this handler suppresses Node's default reporting.
  console.error(error);
  cleanup();
  process.exit(1);
};
process.once('uncaughtException', fatalHandler);
process.once('unhandledRejection', fatalHandler);
