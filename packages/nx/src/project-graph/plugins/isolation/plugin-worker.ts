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
import { sandboxSocketHint } from '../../../daemon/sandbox-socket-hint';
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
// The workspace root of the host that spawned this worker, passed explicitly so
// the foreign-workspace check compares against the owner's root rather than one
// the worker re-resolves. The worker's own resolution can legitimately differ
// from the host's (e.g. a host that overrode its root at runtime without
// updating the child's env), which would drop every real message as "foreign".
const hostWorkspaceRoot = process.argv[4];

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
      // Reject messages from a different workspace using the exact same check
      // the daemon applies to its own socket. A message whose workspaceRoot
      // differs from this worker's host root came from a process in another
      // workspace (e.g. one that reached this worker's socket via a shared
      // NX_SOCKET_DIR) and must not be processed. We catch and drop rather than
      // let the assertion propagate: a stray foreign message must not crash a
      // worker that is validly serving its host. The daemon, which has a
      // response channel, instead surfaces the same assertion back to the
      // client.
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
          process.chdir(root);
          return withErrorHandling(async () => {
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

server.on('error', (err) => {
  // Without this handler the worker dies silently and the host only ever
  // sees "exited before the connection was established" — surface the real
  // failure (commonly a sandbox denying the unix socket bind).
  console.error(
    `[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) failed to listen on ${socketPath}: ${err.message}`
  );
  console.error(sandboxSocketHint().join('\n'));
  process.exit(1);
});
server.listen(socketPath, () => {
  logger.verbose(
    `[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) listening on ${socketPath}`
  );
});

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
// The 'exit' handler must only clean up — calling process.exit() inside it
// would override the real exit code (e.g. a crash would be reported as 0,
// hiding the failure from the plugin host).
process.once('exit', cleanup);
const fatalHandler = (error: unknown) => {
  // Registering an 'uncaughtException' handler suppresses Node's default
  // error reporting, so log the error explicitly before exiting.
  console.error(error);
  cleanup();
  process.exit(1);
};
process.once('uncaughtException', fatalHandler);
process.once('unhandledRejection', fatalHandler);
