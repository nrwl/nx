"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWorkspaceContext = setupWorkspaceContext;
exports.getNxWorkspaceFilesFromContext = getNxWorkspaceFilesFromContext;
exports.globWithWorkspaceContextSync = globWithWorkspaceContextSync;
exports.globWithWorkspaceContext = globWithWorkspaceContext;
exports.multiGlobWithWorkspaceContext = multiGlobWithWorkspaceContext;
exports.hashWithWorkspaceContext = hashWithWorkspaceContext;
exports.hashMultiGlobWithWorkspaceContext = hashMultiGlobWithWorkspaceContext;
exports.updateContextWithChangedFiles = updateContextWithChangedFiles;
exports.updateFilesInContext = updateFilesInContext;
exports.getAllFileDataInContext = getAllFileDataInContext;
exports.getFilesInDirectoryUsingContext = getFilesInDirectoryUsingContext;
exports.updateProjectFiles = updateProjectFiles;
exports.resetWorkspaceContext = resetWorkspaceContext;
const perf_hooks_1 = require("perf_hooks");
const cache_directory_1 = require("./cache-directory");
const is_on_daemon_1 = require("../daemon/is-on-daemon");
const client_1 = require("../daemon/client/client");
const handle_import_1 = require("./handle-import");
let workspaceContext;
function setupWorkspaceContext(workspaceRoot) {
    const { WorkspaceContext } = require('../native');
    perf_hooks_1.performance.mark('workspace-context');
    workspaceContext = new WorkspaceContext(workspaceRoot, (0, cache_directory_1.workspaceDataDirectoryForWorkspace)(workspaceRoot));
    perf_hooks_1.performance.mark('workspace-context:end');
    perf_hooks_1.performance.measure('workspace context init', 'workspace-context', 'workspace-context:end');
}
async function getNxWorkspaceFilesFromContext(workspaceRoot, projectRootMap, useDaemonProcess = true) {
    if (!useDaemonProcess || (0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.getWorkspaceFiles(projectRootMap);
    }
    return client_1.daemonClient.getWorkspaceFiles(projectRootMap);
}
/**
 * Sync method to get files matching globs from workspace context.
 * NOTE: This method will create the workspace context if it doesn't exist.
 * It should only be used within Nx internal in code paths that **must** be sync.
 * If used in an isolated plugin thread this will cause the workspace context
 * to be recreated which is slow.
 */
function globWithWorkspaceContextSync(workspaceRoot, globs, exclude) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext.glob(globs, exclude);
}
async function globWithWorkspaceContext(workspaceRoot, globs, exclude) {
    if (workspaceRoot === '/virtual' || (0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.glob(globs, exclude);
    }
    else {
        return client_1.daemonClient.glob(globs, exclude);
    }
}
async function multiGlobWithWorkspaceContext(workspaceRoot, globs, exclude) {
    if (workspaceRoot === '/virtual' || (0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.multiGlob(globs, exclude);
    }
    return client_1.daemonClient.multiGlob(globs, exclude);
}
async function hashWithWorkspaceContext(workspaceRoot, globs, exclude) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.hashFilesMatchingGlob(globs, exclude);
    }
    return client_1.daemonClient.hashGlob(globs, exclude);
}
async function hashMultiGlobWithWorkspaceContext(workspaceRoot, globGroups) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.hashFilesMatchingGlobs(globGroups);
    }
    return client_1.daemonClient.hashMultiGlob(globGroups);
}
async function updateContextWithChangedFiles(workspaceRoot, createdFiles, updatedFiles, deletedFiles) {
    if (!client_1.daemonClient.enabled()) {
        updateFilesInContext(workspaceRoot, [...createdFiles, ...updatedFiles], deletedFiles);
    }
    else if ((0, is_on_daemon_1.isOnDaemon)()) {
        // make sure to only import this when running on the daemon
        const { scheduleProjectGraphRecomputation } = await (0, handle_import_1.handleImport)('../daemon/server/project-graph-incremental-recomputation.js', __dirname);
        // update files for the incremental graph recomputation on the daemon
        scheduleProjectGraphRecomputation(createdFiles, updatedFiles, deletedFiles);
    }
    else {
        // daemon is enabled but we are not running on it, ask the daemon to update the context
        await client_1.daemonClient.updateWorkspaceContext(createdFiles, updatedFiles, deletedFiles);
    }
}
function updateFilesInContext(workspaceRoot, updatedFiles, deletedFiles) {
    ensureContextAvailable(workspaceRoot);
    return workspaceContext?.incrementalUpdate(updatedFiles, deletedFiles);
}
async function getAllFileDataInContext(workspaceRoot) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.allFileData();
    }
    return client_1.daemonClient.getWorkspaceContextFileData();
}
async function getFilesInDirectoryUsingContext(workspaceRoot, dir) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        ensureContextAvailable(workspaceRoot);
        return workspaceContext.getFilesInDirectory(dir);
    }
    return client_1.daemonClient.getFilesInDirectory(dir);
}
function updateProjectFiles(projectRootMappings, rustReferences, updatedFiles, deletedFiles) {
    return workspaceContext?.updateProjectFiles(projectRootMappings, rustReferences.projectFiles, rustReferences.globalFiles, updatedFiles, deletedFiles);
}
function ensureContextAvailable(workspaceRoot) {
    if (!workspaceContext || workspaceContext?.workspaceRoot !== workspaceRoot) {
        setupWorkspaceContext(workspaceRoot);
    }
}
function resetWorkspaceContext() {
    workspaceContext = undefined;
}
