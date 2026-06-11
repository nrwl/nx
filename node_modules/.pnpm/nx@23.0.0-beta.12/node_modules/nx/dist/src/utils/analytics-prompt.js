"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAnalyticsPreferenceSet = ensureAnalyticsPreferenceSet;
exports.promptForAnalyticsPreference = promptForAnalyticsPreference;
exports.generateWorkspaceId = generateWorkspaceId;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const enquirer_1 = require("enquirer");
const path_1 = require("path");
const output_1 = require("./output");
const is_ci_1 = require("./is-ci");
const nx_json_1 = require("../config/nx-json");
const fileutils_1 = require("./fileutils");
const write_formatted_json_file_1 = require("./write-formatted-json-file");
const workspace_root_1 = require("./workspace-root");
/**
 * Prompts user for analytics preference if not already set in nx.json.
 * Only prompts in interactive terminals, not in CI.
 */
async function ensureAnalyticsPreferenceSet() {
    if ((0, is_ci_1.isCI)()) {
        return;
    }
    // Only prompt in interactive terminals
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
    if (!isInteractive) {
        return;
    }
    // Only prompt inside a workspace that has nx.json — avoid creating
    // nx.json in arbitrary directories (e.g. when running cloud commands
    // outside a workspace).
    const nxJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, 'nx.json');
    if (!(0, fs_1.existsSync)(nxJsonPath)) {
        return;
    }
    const nxJson = (0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot);
    // Check if already set (true = enabled, false = disabled)
    if (typeof nxJson?.analytics === 'boolean') {
        return;
    }
    const analyticsEnabled = await promptForAnalyticsPreference();
    await saveAnalyticsPreference(analyticsEnabled);
}
async function promptForAnalyticsPreference() {
    try {
        output_1.output.log({
            title: 'Help improve Nx by sharing usage data',
            bodyLines: [
                'Nx collects usage analytics to help improve the developer experience.',
                'No project-specific information is collected.',
                'Learn more: https://cloud.nx.app/privacy',
            ],
        });
        const { enableAnalytics } = await (0, enquirer_1.prompt)({
            type: 'confirm',
            name: 'enableAnalytics',
            message: 'Share usage data with the Nx team?',
            initial: true,
        });
        return enableAnalytics;
    }
    catch {
        // User cancelled - default to false
        return false;
    }
}
async function saveAnalyticsPreference(enabled) {
    try {
        const nxJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, 'nx.json');
        const nxJson = (0, fileutils_1.readJsonFile)(nxJsonPath);
        nxJson.analytics = enabled;
        await (0, write_formatted_json_file_1.writeFormattedJsonFile)(nxJsonPath, nxJson);
        if (enabled) {
            output_1.output.success({ title: 'Thank you for helping improve Nx!' });
        }
        else {
            output_1.output.log({
                title: 'Analytics disabled.',
                bodyLines: [
                    'You can change this anytime by setting "analytics" in nx.json.',
                ],
            });
        }
    }
    catch {
        // Silently fail - don't block user's command
    }
}
/**
 * Generates a deterministic workspace ID.
 * Priority: nxCloudId > git remote URL (hashed).
 * Returns null if neither is available (no telemetry).
 */
function generateWorkspaceId(cwd) {
    const root = cwd ?? workspace_root_1.workspaceRoot;
    // Use nxCloudId if available — most stable identifier
    const nxJson = (0, nx_json_1.readNxJson)(root);
    const nxCloudId = nxJson?.nxCloudId ?? nxJson?.nxCloudAccessToken;
    if (nxCloudId) {
        return nxCloudId;
    }
    // Fall back to git remote URL hash
    try {
        const remoteUrl = (0, child_process_1.execSync)('git remote get-url origin', {
            stdio: 'pipe',
            cwd: root,
            windowsHide: true,
        })
            .toString()
            .trim();
        if (remoteUrl) {
            return (0, crypto_1.createHash)('sha256').update(remoteUrl).digest('hex').slice(0, 32);
        }
    }
    catch {
        // No git remote available
    }
    // Fall back to first commit SHA — already a hash
    try {
        const firstCommit = (0, child_process_1.execSync)('git rev-list --max-parents=0 HEAD', {
            stdio: 'pipe',
            cwd: root,
            windowsHide: true,
        })
            .toString()
            .trim()
            .split('\n')[0];
        if (firstCommit) {
            return firstCommit;
        }
    }
    catch {
        // Not a git repo
    }
    return null;
}
