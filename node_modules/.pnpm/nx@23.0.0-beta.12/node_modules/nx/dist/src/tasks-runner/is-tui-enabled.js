"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORIGINAL_TUI_ENV_VALUE = void 0;
exports.isTuiEnabled = isTuiEnabled;
exports.shouldUseTui = shouldUseTui;
const native_1 = require("../native");
const is_ci_1 = require("../utils/is-ci");
const logger_1 = require("../utils/logger");
exports.ORIGINAL_TUI_ENV_VALUE = process.env.NX_TUI;
/**
 * @returns If tui is enabled
 */
function isTuiEnabled() {
    return process.env.NX_TUI === 'true';
}
/**
 * Determines if the TUI should be enabled for the current environment.
 *
 * **Note:** This function should almost never be called directly. Instead, use the `isTuiEnabled` function.
 *
 * @param nxJson `nx.json`
 * @param nxArgs CLI Flags passed into Nx
 * @param skipCapabilityCheck Mainly used for unit tests.
 * @returns `true` if the TUI should be enabled, `false` otherwise.
 */
function shouldUseTui(nxJson, nxArgs, skipCapabilityCheck = process.env.NX_TUI_SKIP_CAPABILITY_CHECK === 'true') {
    // If the current terminal/environment is not capable of displaying the TUI, we don't run it
    const hasValidSize = process.stdout.columns > 0 && process.stdout.rows > 0;
    const isCapable = skipCapabilityCheck ||
        (process.stderr.isTTY && isUnicodeSupported() && hasValidSize);
    if (typeof nxArgs.tui === 'boolean') {
        if (nxArgs.tui && !isCapable) {
            logger_1.logger.warn('Nx Terminal UI was not enabled as it is not supported in this environment.');
            return false;
        }
        return nxArgs.tui;
    }
    if (!isCapable) {
        return false;
    }
    if (['static', 'stream', 'stream-without-prefixes', 'dynamic-legacy'].includes(nxArgs.outputStyle)) {
        // If the user has specified a non-TUI output style, we disable the TUI
        return false;
    }
    if (nxArgs.outputStyle === 'dynamic' || nxArgs.outputStyle === 'tui') {
        return true;
    }
    // The environment variable takes precedence over the nx.json config, but
    // are lower priority than the CLI args as they are less likely to change
    // between runs, whereas the CLI args are specified by the user for each run.
    if (typeof process.env.NX_TUI === 'string') {
        return process.env.NX_TUI === 'true';
    }
    // BELOW THIS LINE ARE "repo specific" checks, instead of "user specific" checks.
    // "user specific" checks are specified by the current user rather than the repo
    // settings which are applied for all users of the repo... so they are more specific
    // and take priority.
    if (
    // Interactive TUI doesn't make sense on CI
    (0, is_ci_1.isCI)() ||
        // Interactive TUI doesn't make sense in an AI agent context
        (0, native_1.isAiAgent)() ||
        // WASM needs further testing
        native_1.IS_WASM) {
        return false;
    }
    // Respect user config
    if (typeof nxJson.tui?.enabled === 'boolean') {
        return Boolean(nxJson.tui?.enabled);
    }
    // Default to enabling the TUI if the system is capable of displaying it
    return true;
}
// Credit to https://github.com/sindresorhus/is-unicode-supported/blob/e0373335038856c63034c8eef6ac43ee3827a601/index.js
function isUnicodeSupported() {
    const { env } = process;
    const { TERM, TERM_PROGRAM } = env;
    if (process.platform !== 'win32') {
        return TERM !== 'linux'; // Linux console (kernel)
    }
    return (Boolean(env.WT_SESSION) || // Windows Terminal
        Boolean(env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
        env.ConEmuTask === '{cmd::Cmder}' || // ConEmu and cmder
        TERM_PROGRAM === 'Terminus-Sublime' ||
        TERM_PROGRAM === 'vscode' ||
        TERM === 'xterm-256color' ||
        TERM === 'alacritty' ||
        TERM === 'rxvt-unicode' ||
        TERM === 'rxvt-unicode-256color' ||
        env.TERMINAL_EMULATOR === 'JetBrains-JediTerm');
}
