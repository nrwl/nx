"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNxConsoleStatus = getNxConsoleStatus;
exports.handleNxConsolePreferenceAndInstall = handleNxConsolePreferenceAndInstall;
exports.getNxConsoleStatusImpl = getNxConsoleStatusImpl;
exports.handleNxConsolePreferenceAndInstallImpl = handleNxConsolePreferenceAndInstallImpl;
const os_1 = require("os");
const native_1 = require("../../native");
const logger_1 = require("../logger");
const latest_nx_1 = require("./latest-nx");
const handle_import_1 = require("../../utils/handle-import");
const log = (...messageParts) => {
    logger_1.serverLogger.log('[NX-CONSOLE]:', ...messageParts);
};
/**
 * Gets the Nx Console status (whether we should prompt the user to install).
 * Uses latest Nx version if available, falls back to local implementation.
 *
 * @returns boolean indicating whether we should prompt the user
 */
async function getNxConsoleStatus({ inner, } = {}) {
    // Use local implementation if explicitly requested
    if (process.env.NX_USE_LOCAL === 'true' || inner === true) {
        log('Using local implementation (NX_USE_LOCAL=true or inner call)');
        return await getNxConsoleStatusImpl();
    }
    try {
        const tmpPath = await (0, latest_nx_1.getLatestNxTmpPath)();
        const modulePath = require.resolve('nx/src/daemon/server/nx-console-operations.js', { paths: [tmpPath] });
        const module = await (0, handle_import_1.handleImport)(modulePath);
        const result = await module.getNxConsoleStatus({ inner: true });
        log('Console status check completed, shouldPrompt:', result);
        return result;
    }
    catch (error) {
        log('Failed to use latest Nx for console status. Error:', error.message);
        return await getNxConsoleStatusImpl();
    }
}
/**
 * Handles user preference submission and installs Nx Console if requested.
 * Uses latest Nx version if available, falls back to local implementation.
 *
 * @param preference - whether the user wants to install Nx Console
 * @returns object indicating whether installation succeeded
 */
async function handleNxConsolePreferenceAndInstall({ preference, inner, }) {
    log('Handling user preference:', preference);
    // Use local implementation if explicitly requested
    if (process.env.NX_USE_LOCAL === 'true' || inner === true) {
        log('Using local implementation (NX_USE_LOCAL=true or inner call)');
        return await handleNxConsolePreferenceAndInstallImpl(preference);
    }
    try {
        const tmpPath = await (0, latest_nx_1.getLatestNxTmpPath)();
        const modulePath = require.resolve('nx/src/daemon/server/nx-console-operations.js', { paths: [tmpPath] });
        const module = await (0, handle_import_1.handleImport)(modulePath);
        const result = await module.handleNxConsolePreferenceAndInstall({
            preference,
            inner: true,
        });
        log('Preference saved and installation', result.installed ? 'succeeded' : 'skipped/failed');
        return result;
    }
    catch (error) {
        log('Failed to use latest Nx for preference install. Error:', error.message);
        return await handleNxConsolePreferenceAndInstallImpl(preference);
    }
}
async function getNxConsoleStatusImpl() {
    // If no cached preference, read from disk
    const preferences = new native_1.NxConsolePreferences((0, os_1.homedir)());
    const preference = preferences.getAutoInstallPreference();
    const canInstallConsole = await (0, native_1.canInstallNxConsole)();
    // If user previously opted in but extension is not installed,
    // they must have manually uninstalled it - respect that choice
    if (preference === true && canInstallConsole) {
        const preferences = new native_1.NxConsolePreferences((0, os_1.homedir)());
        preferences.setAutoInstallPreference(false);
        return false; // Don't prompt
    }
    // Noop if can't install
    if (!canInstallConsole) {
        return false;
    }
    // Prompt if we can install and user hasn't answered yet
    return typeof preference !== 'boolean';
}
async function handleNxConsolePreferenceAndInstallImpl(preference) {
    const preferences = new native_1.NxConsolePreferences((0, os_1.homedir)());
    preferences.setAutoInstallPreference(preference);
    let installed = false;
    if (preference) {
        installed = await (0, native_1.installNxConsole)();
    }
    return { installed };
}
