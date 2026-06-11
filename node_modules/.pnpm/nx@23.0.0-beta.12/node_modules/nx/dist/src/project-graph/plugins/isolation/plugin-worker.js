"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Must be the first import — see enable-compile-cache.ts.
require("../../../utils/enable-compile-cache");
const node_perf_hooks_1 = require("node:perf_hooks");
node_perf_hooks_1.performance.mark(`plugin worker ${process.pid} code loading -- start`);
const consume_messages_from_socket_1 = require("../../../utils/consume-messages-from-socket");
const logger_1 = require("../../../utils/logger");
const serializable_error_1 = require("../../../utils/serializable-error");
const messaging_1 = require("./messaging");
const worker_streaming_1 = require("./worker-streaming");
const fs_1 = require("fs");
const net_1 = require("net");
const analytics_1 = require("../../../analytics");
const daemon_environment_1 = require("../../../daemon/client/daemon-environment");
require("../../../utils/perf-logging");
const environment = process.env;
(0, analytics_1.startAnalytics)();
node_perf_hooks_1.performance.mark(`plugin worker ${process.pid} code loading -- end`);
node_perf_hooks_1.performance.measure(`plugin worker ${process.pid} code loading`, `plugin worker ${process.pid} code loading -- start`, `plugin worker ${process.pid} code loading -- end`);
global.NX_GRAPH_CREATION = true;
global.NX_PLUGIN_WORKER = true;
let plugin;
const socketPath = process.argv[2];
const expectedPluginName = process.argv[3];
const CONNECT_TIMEOUT_MS = 30_000;
let connectErrorTimeout = setErrorTimeout(CONNECT_TIMEOUT_MS, `The plugin worker for ${expectedPluginName} is exiting as it was not connected to within ${CONNECT_TIMEOUT_MS / 1000} seconds. ` +
    'Plugin workers expect to receive a socket connection from the parent process shortly after being started. ' +
    'If you are seeing this issue, please report it to the Nx team at https://github.com/nrwl/nx/issues.');
const server = (0, net_1.createServer)((socket) => {
    connectErrorTimeout?.clear();
    // Make the host-facing socket available to plugin code running in this
    // worker so it can emit log / progress notifications without having
    // the socket threaded through every call site.
    (0, worker_streaming_1.setPluginWorkerHostSocket)(socket);
    logger_1.logger.verbose(`[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) connected`);
    // This handles cases where the host process was killed
    // after the worker connected but before the worker was
    // instructed to load the plugin.
    let loadErrorTimeout = setErrorTimeout(10_000, `Plugin Worker for ${expectedPluginName} is exiting as it did not receive a load message within 10 seconds of connecting. ` +
        'This likely indicates that the host process was terminated before the worker could be instructed to load the plugin. ' +
        'If you are seeing this issue, please report it to the Nx team at https://github.com/nrwl/nx/issues.');
    socket.on('data', (0, consume_messages_from_socket_1.consumeMessagesFromSocket)((raw) => {
        const message = (0, consume_messages_from_socket_1.parseMessage)(raw);
        if (!(0, messaging_1.isPluginWorkerMessage)(message)) {
            return;
        }
        return (0, messaging_1.consumeMessage)(socket, message, {
            load: async ({ plugin: pluginConfiguration, root, name, pluginPath, shouldRegisterTSTranspiler, }) => {
                loadErrorTimeout?.clear();
                process.chdir(root);
                return withErrorHandling(async () => {
                    const { loadResolvedNxPluginAsync } = await Promise.resolve(require(require.resolve('../load-resolved-plugin')));
                    // Register the ts-transpiler if we are pointing to a
                    // plain ts file that's not part of a plugin project
                    if (shouldRegisterTSTranspiler) {
                        require('../transpiler').registerPluginTSTranspiler();
                    }
                    plugin = await loadResolvedNxPluginAsync(pluginConfiguration, pluginPath, name);
                    logger_1.logger.verbose(`[plugin-worker] "${name}" (pid: ${process.pid}) loaded successfully`);
                    return {
                        name: plugin.name,
                        include: plugin.include,
                        exclude: plugin.exclude,
                        createNodesPattern: plugin.createNodes?.[0],
                        hasCreateDependencies: 'createDependencies' in plugin && !!plugin.createDependencies,
                        hasProcessProjectGraph: 'processProjectGraph' in plugin && !!plugin.processProjectGraph,
                        hasCreateMetadata: 'createMetadata' in plugin && !!plugin.createMetadata,
                        hasPreTasksExecution: 'preTasksExecution' in plugin && !!plugin.preTasksExecution,
                        hasPostTasksExecution: 'postTasksExecution' in plugin && !!plugin.postTasksExecution,
                        success: true,
                    };
                });
            },
            createNodes: async ({ configFiles, context }) => withErrorHandling(async () => {
                const result = await plugin.createNodes[1](configFiles, context);
                return { result, success: true };
            }),
            createDependencies: async ({ context }) => withErrorHandling(async () => {
                const result = await plugin.createDependencies(context);
                return { dependencies: result, success: true };
            }),
            createMetadata: async ({ graph, context }) => withErrorHandling(async () => {
                const result = await plugin.createMetadata(graph, context);
                return { metadata: result, success: true };
            }),
            preTasksExecution: async ({ context }) => withErrorHandling(async () => {
                const mutations = await plugin.preTasksExecution?.(context);
                return { success: true, mutations };
            }),
            postTasksExecution: async ({ context }) => withErrorHandling(() => plugin.postTasksExecution?.(context)),
            setWorkerEnv: (env) => withErrorHandling(() => {
                (0, daemon_environment_1.applyDaemonEnvFromClient)(env);
            }),
        });
    }));
    // When the host disconnects, clean up and exit.
    socket.on('end', () => {
        socket.destroySoon();
        try {
            (0, fs_1.unlinkSync)(socketPath);
        }
        catch (e) { }
        process.exit(0);
    });
});
server.listen(socketPath);
logger_1.logger.verbose(`[plugin-worker] "${expectedPluginName}" (pid: ${process.pid}) listening on ${socketPath}`);
async function withErrorHandling(cb) {
    try {
        const result = await cb();
        return result ?? { success: true };
    }
    catch (e) {
        return {
            success: false,
            error: (0, serializable_error_1.createSerializableError)(e),
        };
    }
}
function setErrorTimeout(timeoutMs, errorMessage) {
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
const exitHandler = (exitCode) => () => {
    server.close();
    try {
        (0, fs_1.unlinkSync)(socketPath);
    }
    catch (e) { }
    process.exit(exitCode);
};
const events = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'exit'];
events.forEach((event) => process.once(event, exitHandler(0)));
process.once('uncaughtException', exitHandler(1));
process.once('unhandledRejection', exitHandler(1));
