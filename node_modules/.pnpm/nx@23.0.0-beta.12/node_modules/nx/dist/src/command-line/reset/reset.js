"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetHandler = resetHandler;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("../../daemon/client/client");
const tmp_dir_1 = require("../../daemon/tmp-dir");
const cache_directory_1 = require("../../utils/cache-directory");
const output_1 = require("../../utils/output");
const native_file_cache_location_1 = require("../../native/native-file-cache-location");
const native_1 = require("../../native");
const workspace_root_1 = require("../../utils/workspace-root");
const client_2 = require("../../nx-cloud/utilities/client");
const get_cloud_options_1 = require("../../nx-cloud/utilities/get-cloud-options");
const nx_cloud_utils_1 = require("../../utils/nx-cloud-utils");
const configuration_1 = require("../../config/configuration");
const update_manager_1 = require("../../nx-cloud/update-manager");
// Wait at max 5 seconds before giving up on a failing operation.
const INCREMENTAL_BACKOFF_MAX_DURATION = 5000;
// If an operation fails, wait 100ms before first retry.
const INCREMENTAL_BACKOFF_FIRST_DELAY = 100;
async function resetHandler(args) {
    let errors = [];
    const all = args.onlyDaemon === undefined &&
        args.onlyCache === undefined &&
        args.onlyWorkspaceData === undefined;
    const nxJson = (0, configuration_1.readNxJson)();
    const cloudEnabled = (0, nx_cloud_utils_1.isNxCloudUsed)(nxJson);
    const startupMessage = all
        ? 'Resetting the Nx cache and stopping the daemon.'
        : 'Resetting:';
    const bodyLines = [];
    if (!all) {
        if (args.onlyDaemon) {
            bodyLines.push('- Nx Daemon and its workspace data');
        }
        if (args.onlyCache) {
            bodyLines.push('- Cache directory');
        }
        if (args.onlyWorkspaceData) {
            bodyLines.push('- Workspace data directory');
        }
        if (args.onlyCloud && cloudEnabled) {
            bodyLines.push('- Nx Cloud Client');
        }
    }
    output_1.output.note({ title: startupMessage, bodyLines });
    if (all || args.onlyDaemon) {
        try {
            await killDaemon();
        }
        catch (e) {
            errors.push('Failed to stop the Nx Daemon.', e.toString());
        }
        try {
            await cleanupDaemonWorkspaceData();
        }
        catch (e) {
            errors.push('Failed to clean up the daemon workspace data directory.', e.toString());
        }
    }
    if (all || args.onlyCache) {
        try {
            await cleanupCacheEntries();
        }
        catch (e) {
            errors.push('Failed to clean up the cache directory.', e.toString());
        }
    }
    if (all || args.onlyWorkspaceData) {
        try {
            await cleanupNativeFileCache();
        }
        catch {
            // ignore, deleting the native file cache is not critical and can fail if another process is locking the file
        }
        try {
            await cleanupWorkspaceData();
        }
        catch (e) {
            errors.push('Failed to clean up the workspace data directory.', e.toString());
        }
    }
    if ((cloudEnabled && all) || args.onlyCloud) {
        try {
            await resetCloudClient();
            await removeInstalledNxCloudClient();
        }
        catch (e) {
            errors.push('Failed to reset the Nx Cloud client.', e.toString());
        }
    }
    if (errors.length > 0) {
        output_1.output.error({
            title: 'Failed to reset the Nx workspace.',
            bodyLines: errors,
        });
        process.exit(1);
    }
    else {
        output_1.output.success({
            title: 'Successfully reset the Nx workspace.',
        });
    }
}
async function killDaemon() {
    if (client_1.daemonClient.enabled()) {
        return client_1.daemonClient.stop();
    }
}
function cleanupDaemonWorkspaceData() {
    return incrementalBackoff(INCREMENTAL_BACKOFF_FIRST_DELAY, INCREMENTAL_BACKOFF_MAX_DURATION, () => {
        (0, node_fs_1.rmSync)(tmp_dir_1.DAEMON_DIR_FOR_CURRENT_WORKSPACE, {
            recursive: true,
            force: true,
        });
    });
}
async function resetCloudClient() {
    // Remove nx cloud marker files. This helps if the use happens to run `nx-cloud start-ci-run` or
    // similar commands on their local machine.
    try {
        (await (0, client_2.getCloudClient)((0, get_cloud_options_1.getCloudOptions)())).invoke('cleanup');
    }
    catch { }
}
function removeInstalledNxCloudClient() {
    return incrementalBackoff(INCREMENTAL_BACKOFF_FIRST_DELAY, INCREMENTAL_BACKOFF_MAX_DURATION, () => {
        const cloudClientDir = (0, update_manager_1.getBundleInstallDefaultLocation)();
        (0, node_fs_1.rmSync)((0, node_path_1.join)(cloudClientDir, 'cloud'), { recursive: true, force: true });
    });
}
function cleanupCacheEntries() {
    return incrementalBackoff(INCREMENTAL_BACKOFF_FIRST_DELAY, INCREMENTAL_BACKOFF_MAX_DURATION, () => {
        (0, node_fs_1.rmSync)(cache_directory_1.cacheDir, { recursive: true, force: true });
    });
}
function cleanupNativeFileCache() {
    return incrementalBackoff(INCREMENTAL_BACKOFF_FIRST_DELAY, INCREMENTAL_BACKOFF_MAX_DURATION, () => {
        (0, node_fs_1.rmSync)((0, native_file_cache_location_1.getNativeFileCacheLocation)(), { recursive: true, force: true });
    });
}
function cleanupWorkspaceData() {
    return incrementalBackoff(INCREMENTAL_BACKOFF_FIRST_DELAY, INCREMENTAL_BACKOFF_MAX_DURATION, () => {
        (0, node_fs_1.rmSync)(cache_directory_1.workspaceDataDirectory, { recursive: true, force: true });
        // If in a worktree, also clean the shared workspace data directory
        // in the main repo where the DB actually lives
        try {
            const mainRoot = (0, native_1.getMainWorktreeRoot)(workspace_root_1.workspaceRoot);
            if (mainRoot) {
                const sharedDir = (0, cache_directory_1.workspaceDataDirectoryForWorkspace)(mainRoot);
                if (sharedDir !== cache_directory_1.workspaceDataDirectory) {
                    (0, node_fs_1.rmSync)(sharedDir, { recursive: true, force: true });
                }
            }
        }
        catch {
            // Worktree detection is best-effort during reset
        }
    });
}
async function incrementalBackoff(ms, maxDuration, callback) {
    try {
        callback();
    }
    catch (e) {
        if (ms < maxDuration) {
            await sleep(ms);
            await incrementalBackoff(ms * 2, maxDuration, callback);
        }
        else {
            throw e;
        }
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
