"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureNxConsoleInstalled = ensureNxConsoleInstalled;
const enquirer_1 = require("enquirer");
const os_1 = require("os");
const output_1 = require("./output");
const native_1 = require("../native");
const is_ci_1 = require("./is-ci");
async function ensureNxConsoleInstalled() {
    const preferences = new native_1.NxConsolePreferences((0, os_1.homedir)());
    let setting = preferences.getAutoInstallPreference();
    const canInstallConsole = await (0, native_1.canInstallNxConsole)();
    // If user previously opted in but extension is not installed,
    // they must have manually uninstalled it - respect that choice
    if (setting === true && canInstallConsole) {
        // User had auto-install enabled but extension is missing
        // This means they manually uninstalled it
        preferences.setAutoInstallPreference(false);
        return;
    }
    // Noop
    if (!canInstallConsole) {
        return;
    }
    // Only prompt if both stdin and stdout are TTY (interactive terminal)
    // and we're not in a CI environment
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY && !(0, is_ci_1.isCI)();
    if (isInteractive && typeof setting !== 'boolean') {
        setting = await promptForNxConsoleInstallation();
        preferences.setAutoInstallPreference(setting);
    }
    if (setting) {
        const installed = await (0, native_1.installNxConsole)();
        if (installed) {
            output_1.output.log({ title: 'Successfully installed Nx Console!' });
        }
    }
}
/**
 * Prompts the user whether they want to automatically install the Nx Console extension
 * and persists their preference using the NxConsolePreferences struct
 */
async function promptForNxConsoleInstallation() {
    try {
        output_1.output.log({
            title: "Install Nx's official editor extension to:",
            bodyLines: [
                '- Enable your AI assistant to do more by understanding your workspace',
                '- Add IntelliSense for Nx configuration files',
                '- Explore your workspace visually',
            ],
        });
        const { shouldInstallNxConsole } = await (0, enquirer_1.prompt)({
            type: 'confirm',
            name: 'shouldInstallNxConsole',
            message: 'Install Nx Console? (you can uninstall anytime)',
            initial: true,
        });
        return shouldInstallNxConsole;
    }
    catch (error) {
        return false;
    }
}
