"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_INACTIVITY_TIMEOUT_MS = void 0;
exports.storeWatcherInstance = storeWatcherInstance;
exports.getWatcherInstance = getWatcherInstance;
exports.storeOutputWatcherInstance = storeOutputWatcherInstance;
exports.getOutputWatcherInstance = getOutputWatcherInstance;
exports.handleServerProcessTermination = handleServerProcessTermination;
exports.handleServerProcessTerminationWithRestart = handleServerProcessTerminationWithRestart;
exports.resetInactivityTimeout = resetInactivityTimeout;
exports.respondToClient = respondToClient;
exports.respondWithErrorAndExit = respondWithErrorAndExit;
const workspace_root_1 = require("../../utils/workspace-root");
const logger_1 = require("../logger");
const socket_utils_1 = require("../socket-utils");
const cache_1 = require("../cache");
const error_types_1 = require("../../project-graph/error-types");
const get_plugins_1 = require("../../project-graph/plugins/get-plugins");
const consume_messages_from_socket_1 = require("../../utils/consume-messages-from-socket");
const latest_nx_1 = require("./latest-nx");
const analytics_1 = require("../../analytics");
const child_process_1 = require("child_process");
const path_1 = require("path");
const node_fs_1 = require("node:fs");
const promises_1 = require("fs/promises");
const tmp_dir_1 = require("../tmp-dir");
exports.SERVER_INACTIVITY_TIMEOUT_MS = 10800000; // 10800000 ms = 3 hours
async function startNewDaemonInBackground() {
    (0, node_fs_1.mkdirSync)(tmp_dir_1.DAEMON_DIR_FOR_CURRENT_WORKSPACE, { recursive: true });
    if (!(0, node_fs_1.existsSync)(tmp_dir_1.DAEMON_OUTPUT_LOG_FILE)) {
        (0, node_fs_1.writeFileSync)(tmp_dir_1.DAEMON_OUTPUT_LOG_FILE, '');
    }
    const out = await (0, promises_1.open)(tmp_dir_1.DAEMON_OUTPUT_LOG_FILE, 'a');
    const err = await (0, promises_1.open)(tmp_dir_1.DAEMON_OUTPUT_LOG_FILE, 'a');
    // Use require.resolve to find the currently installed version's start.js
    // instead of using __dirname which points to the old running daemon's path
    // Resolve from workspace root to pick up the correct symlink target
    let startScriptPath;
    try {
        startScriptPath = require.resolve('nx/src/daemon/server/start.js', {
            paths: [workspace_root_1.workspaceRoot],
        });
    }
    catch (e) {
        // Fall back to using __dirname if resolution fails
        logger_1.serverLogger.log(`Failed to resolve nx package, falling back to __dirname: ${e.message}`);
        startScriptPath = (0, path_1.join)(__dirname, '../server/start.js');
    }
    logger_1.serverLogger.log(`Restarting daemon with script: ${startScriptPath}`);
    logger_1.serverLogger.log(`Old daemon __dirname: ${__dirname}`);
    logger_1.serverLogger.log(`Current process.execPath: ${process.execPath}`);
    const backgroundProcess = (0, child_process_1.spawn)(process.execPath, [startScriptPath], {
        cwd: workspace_root_1.workspaceRoot,
        stdio: ['ignore', out.fd, err.fd],
        detached: true,
        windowsHide: true,
        shell: false,
        env: process.env,
    });
    backgroundProcess.unref();
    logger_1.serverLogger.log('Started new daemon process in background');
}
let watcherInstance;
function storeWatcherInstance(instance) {
    watcherInstance = instance;
}
function getWatcherInstance() {
    return watcherInstance;
}
let outputWatcherInstance;
function storeOutputWatcherInstance(instance) {
    outputWatcherInstance = instance;
}
function getOutputWatcherInstance() {
    return outputWatcherInstance;
}
async function handleServerProcessTermination({ server, reason, sockets, }) {
    await performShutdown(server, reason, sockets);
}
async function handleServerProcessTerminationWithRestart({ server, reason, sockets, }) {
    // Clean up old daemon cache before starting new instance
    (0, cache_1.deleteDaemonJsonProcessCache)();
    // Start new daemon before shutting down
    await startNewDaemonInBackground();
    await performShutdown(server, reason, sockets);
}
async function performShutdown(server, reason, sockets) {
    try {
        await new Promise((res) => {
            server.close(() => {
                res(null);
            });
            for (const socket of sockets) {
                socket.destroy();
            }
        });
        if (watcherInstance) {
            await watcherInstance.stop();
            logger_1.serverLogger.watcherLog(`Stopping the watcher for ${workspace_root_1.workspaceRoot} (sources)`);
        }
        if (outputWatcherInstance) {
            await outputWatcherInstance.stop();
            logger_1.serverLogger.watcherLog(`Stopping the watcher for ${workspace_root_1.workspaceRoot} (outputs)`);
        }
        (0, cache_1.deleteDaemonJsonProcessCache)();
        (0, get_plugins_1.cleanupPlugins)();
        // Clean up shared latest Nx installation
        (0, latest_nx_1.cleanupLatestNx)();
        // Flush analytics before exiting
        (0, analytics_1.flushAnalytics)();
        logger_1.serverLogger.log(`Server stopped because: "${reason}"`);
    }
    finally {
        process.exit(0);
    }
}
let serverInactivityTimerId;
function resetInactivityTimeout(cb) {
    if (serverInactivityTimerId) {
        clearTimeout(serverInactivityTimerId);
    }
    serverInactivityTimerId = setTimeout(cb, exports.SERVER_INACTIVITY_TIMEOUT_MS);
}
function respondToClient(socket, response, description) {
    return new Promise(async (res) => {
        if (description) {
            logger_1.serverLogger.requestLog(`Responding to the client.`, description);
        }
        socket.write(response + consume_messages_from_socket_1.MESSAGE_END_SEQ, (err) => {
            if (err) {
                logger_1.serverLogger.log(`Socket write error (client likely disconnected): ${err.message}`);
            }
            logger_1.serverLogger.log(`Done responding to the client`, description);
            res(null);
        });
    });
}
async function respondWithErrorAndExit(socket, description, error) {
    const isProjectGraphError = error instanceof error_types_1.DaemonProjectGraphError;
    const normalizedError = isProjectGraphError
        ? error_types_1.ProjectGraphError.fromDaemonProjectGraphError(error)
        : error;
    // print some extra stuff in the error message
    logger_1.serverLogger.requestLog(`Responding to the client with an error.`, description, normalizedError.message);
    console.error(normalizedError.stack);
    // Respond with the original error
    await respondToClient(socket, (0, socket_utils_1.serializeResult)(error, null, null), null);
    // Project Graph errors are okay. Restarting the daemon won't help with this.
    if (!isProjectGraphError) {
        process.exit(1);
    }
}
