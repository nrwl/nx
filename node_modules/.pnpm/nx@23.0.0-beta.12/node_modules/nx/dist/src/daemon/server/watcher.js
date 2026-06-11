"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchWorkspace = watchWorkspace;
exports.flushPendingWorkspaceChanges = flushPendingWorkspaceChanges;
exports.watchOutputFiles = watchOutputFiles;
exports.convertChangeEventsToLogMessage = convertChangeEventsToLogMessage;
const workspace_root_1 = require("../../utils/workspace-root");
const path_1 = require("path");
const shutdown_utils_1 = require("./shutdown-utils");
const path_2 = require("../../utils/path");
const cache_1 = require("../cache");
const server_1 = require("./server");
const handle_import_1 = require("../../utils/handle-import");
// Captured by watchWorkspace so flushPendingWorkspaceChanges can route
// force-flushed events through the same handling as the async callback.
// Definite-assignment: dispatchWorkspaceChanges only runs after
// watchWorkspace has set both, so reading them as non-nullable is safe.
let activeServer;
let workspaceChangesCallback;
function dispatchWorkspaceChanges(events) {
    for (const event of events) {
        if (event.path.endsWith('.gitignore') || event.path === '.nxignore') {
            // If the ignore files themselves have changed we need to dynamically
            // update our cached ignoreGlobs
            (0, shutdown_utils_1.handleServerProcessTermination)({
                server: activeServer,
                reason: 'Stopping the daemon the set of ignored files changed (native)',
                sockets: server_1.openSockets,
            });
        }
    }
    return workspaceChangesCallback(null, events);
}
async function watchWorkspace(server, cb) {
    const { Watcher } = await (0, handle_import_1.handleImport)('../../native/index.js', __dirname);
    activeServer = server;
    workspaceChangesCallback = cb;
    const watcher = new Watcher(workspace_root_1.workspaceRoot);
    watcher.watch((err, events) => {
        if (err) {
            return cb(err, null);
        }
        dispatchWorkspaceChanges(events);
    });
    return watcher;
}
/**
 * Synchronously drain anything the workspace watcher has buffered and feed
 * it through the normal change-handling pipeline. Call this before serving
 * a cached project graph so we never return data that the watcher has
 * already seen invalidated but hasn't flushed yet.
 */
async function flushPendingWorkspaceChanges() {
    const watcher = (0, shutdown_utils_1.getWatcherInstance)();
    if (!watcher)
        return;
    const events = watcher.forceFlushPending();
    if (events.length === 0)
        return;
    await dispatchWorkspaceChanges(events);
}
async function watchOutputFiles(server, cb) {
    const { Watcher } = await (0, handle_import_1.handleImport)('../../native/index.js', __dirname);
    const relativeServerProcess = (0, path_2.normalizePath)((0, path_1.relative)(workspace_root_1.workspaceRoot, cache_1.serverProcessJsonPath));
    const watcher = new Watcher(workspace_root_1.workspaceRoot, [`!${relativeServerProcess}`], false);
    watcher.watch((err, events) => {
        if (err) {
            return cb(err, null);
        }
        for (const event of events) {
            if (event.path == relativeServerProcess &&
                (0, cache_1.getDaemonProcessIdSync)() !== process.pid) {
                return (0, shutdown_utils_1.handleServerProcessTermination)({
                    server,
                    reason: 'this process is no longer the current daemon (native)',
                    sockets: server_1.openSockets,
                });
            }
        }
        if (events.length !== 0) {
            cb(null, events);
        }
    });
    return watcher;
}
/**
 * NOTE: An event type of "create" will also apply to the case where the user has restored
 * an original version of a file after modifying/deleting it by using git, so we adjust
 * our log language accordingly.
 */
function convertChangeEventsToLogMessage(changeEvents) {
    // If only a single file was changed, show the information inline
    if (changeEvents.length === 1) {
        const { path, type } = changeEvents[0];
        let typeLog = 'updated';
        switch (type) {
            case 'create':
                typeLog = 'created or restored';
                break;
            case 'update':
                typeLog = 'modified';
                break;
            case 'delete':
                typeLog = 'deleted';
                break;
        }
        return `${path} was ${typeLog}`;
    }
    let numCreatedOrRestoredFiles = 0;
    let numModifiedFiles = 0;
    let numDeletedFiles = 0;
    for (const event of changeEvents) {
        switch (event.type) {
            case 'create':
                numCreatedOrRestoredFiles++;
                break;
            case 'update':
                numModifiedFiles++;
                break;
            case 'delete':
                numDeletedFiles++;
                break;
        }
    }
    return `${numCreatedOrRestoredFiles} file(s) created or restored, ${numModifiedFiles} file(s) modified, ${numDeletedFiles} file(s) deleted`;
}
