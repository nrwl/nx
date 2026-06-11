"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewLogs = viewLogs;
const package_manager_1 = require("../../../utils/package-manager");
const child_process_1 = require("child_process");
const nx_cloud_utils_1 = require("../../../utils/nx-cloud-utils");
const output_1 = require("../../../utils/output");
const nx_json_1 = require("../../../config/nx-json");
const connect_to_nx_cloud_1 = require("./connect-to-nx-cloud");
async function viewLogs() {
    const cloudUsed = (0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)());
    if (cloudUsed) {
        output_1.output.error({
            title: 'Your workspace is already connected to Nx Cloud',
            bodyLines: [
                `Refer to the output of the last command to find the Nx Cloud link to view the run details.`,
            ],
        });
        return 1;
    }
    const setupNxCloud = await (0, connect_to_nx_cloud_1.connectExistingRepoToNxCloudPrompt)('view-logs', 'setupViewLogs');
    if (setupNxCloud !== 'yes') {
        return;
    }
    try {
        output_1.output.log({
            title: 'Connecting to Nx Cloud',
        });
        await (0, connect_to_nx_cloud_1.connectWorkspaceToCloud)({
            installationSource: 'view-logs',
            generateToken: true,
        });
    }
    catch (e) {
        output_1.output.log({
            title: 'Failed to connect to Nx Cloud',
        });
        console.log(e);
        return 1;
    }
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    (0, child_process_1.execSync)(`${pmc.exec} nx-cloud upload-and-show-run-details`, {
        stdio: [0, 1, 2],
        windowsHide: true,
    });
    if (!cloudUsed) {
        output_1.output.note({
            title: 'Your workspace is now connected to Nx Cloud',
            bodyLines: [`Learn more about Nx Cloud at https://nx.dev/nx-cloud`],
        });
    }
    return 0;
}
