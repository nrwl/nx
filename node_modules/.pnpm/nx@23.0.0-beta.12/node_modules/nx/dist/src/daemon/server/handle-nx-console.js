"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetNxConsoleStatus = handleGetNxConsoleStatus;
exports.handleSetNxConsolePreferenceAndInstall = handleSetNxConsolePreferenceAndInstall;
const nx_console_operations_1 = require("./nx-console-operations");
// Module-level state for caching
let cachedShouldPrompt = null;
let isComputing = false;
async function handleGetNxConsoleStatus() {
    // Return cached result if available
    if (cachedShouldPrompt !== null) {
        const response = {
            shouldPrompt: cachedShouldPrompt,
        };
        return {
            response,
            description: 'handleGetNxConsoleStatus',
        };
    }
    // Kick off background computation if not already running
    if (!isComputing) {
        isComputing = true;
        (0, nx_console_operations_1.getNxConsoleStatus)()
            .then((result) => {
            cachedShouldPrompt = result;
            isComputing = false;
        })
            .catch(() => {
            cachedShouldPrompt = null;
            isComputing = false;
        });
    }
    // Return false for shouldPrompt if cache not ready (main process will noop)
    const response = {
        shouldPrompt: false,
    };
    return {
        response,
        description: 'handleGetNxConsoleStatus',
    };
}
async function handleSetNxConsolePreferenceAndInstall(preference) {
    // Immediately update cache - we know the answer now!
    // User answered the prompt, so we won't prompt again
    cachedShouldPrompt = false;
    const result = await (0, nx_console_operations_1.handleNxConsolePreferenceAndInstall)({ preference });
    const response = {
        installed: result.installed,
    };
    return {
        response,
        description: 'handleSetNxConsolePreferenceAndInstall',
    };
}
