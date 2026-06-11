"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCloudOptions = getCloudOptions;
exports.getCloudUrl = getCloudUrl;
exports.removeTrailingSlash = removeTrailingSlash;
exports.isNxCloudId = isNxCloudId;
const nx_json_1 = require("../../config/nx-json");
const run_command_1 = require("../../tasks-runner/run-command");
const workspace_root_1 = require("../../utils/workspace-root");
function getCloudOptions(directory = workspace_root_1.workspaceRoot) {
    const nxJson = (0, nx_json_1.readNxJson)(directory);
    // TODO: The default is not always cloud? But it's not handled at the moment
    return (0, run_command_1.getRunnerOptions)('default', nxJson, {}, true);
}
function getCloudUrl() {
    return removeTrailingSlash(process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`);
}
function removeTrailingSlash(apiUrl) {
    return apiUrl[apiUrl.length - 1] === '/' ? apiUrl.slice(0, -1) : apiUrl;
}
function isNxCloudId(token) {
    return token.length === 24;
}
