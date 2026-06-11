"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnNotConnectedToCloud = warnNotConnectedToCloud;
exports.executeNxCloudCommand = executeNxCloudCommand;
const update_manager_1 = require("../../nx-cloud/update-manager");
const get_cloud_options_1 = require("../../nx-cloud/utilities/get-cloud-options");
const handle_errors_1 = require("../../utils/handle-errors");
const resolution_helpers_1 = require("../../nx-cloud/resolution-helpers");
const output_1 = require("../../utils/output");
function warnNotConnectedToCloud() {
    output_1.output.warn({
        title: 'Nx Cloud is not enabled',
        bodyLines: [
            'This command requires a connection to the full Nx platform.',
            'Run `nx connect` to connect your workspace.',
        ],
    });
}
function tryGetCloudOptions() {
    try {
        return (0, get_cloud_options_1.getCloudOptions)();
    }
    catch {
        return {};
    }
}
async function executeNxCloudCommand(commandName, verbose) {
    return (0, handle_errors_1.handleErrors)(verbose, async () => {
        const nxCloudClient = (await (0, update_manager_1.verifyOrUpdateNxCloudClient)(tryGetCloudOptions())).nxCloudClient;
        const paths = (0, resolution_helpers_1.findAncestorNodeModules)(__dirname, []);
        nxCloudClient.configureLightClientRequire()(paths);
        await nxCloudClient.commands[commandName]();
    });
}
