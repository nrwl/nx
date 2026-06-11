"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadCloudClientHandler = downloadCloudClientHandler;
const nx_json_1 = require("../../../config/nx-json");
const update_manager_1 = require("../../../nx-cloud/update-manager");
const get_cloud_options_1 = require("../../../nx-cloud/utilities/get-cloud-options");
const nx_cloud_utils_1 = require("../../../utils/nx-cloud-utils");
const handle_errors_1 = require("../../../utils/handle-errors");
const output_1 = require("../../../utils/output");
function downloadCloudClientHandler(args) {
    return (0, handle_errors_1.handleErrors)(args.verbose, async () => {
        // Try to get cloud options from nx.json if available, otherwise
        // fall back to defaults (env vars / https://cloud.nx.app).
        let options = {};
        try {
            const nxJson = (0, nx_json_1.readNxJson)();
            if ((0, nx_cloud_utils_1.isNxCloudUsed)(nxJson)) {
                options = (0, get_cloud_options_1.getCloudOptions)();
            }
        }
        catch {
            // Not in an Nx workspace — use defaults
        }
        const result = await (0, update_manager_1.verifyOrUpdateNxCloudClient)(options);
        if (result) {
            output_1.output.success({
                title: 'Nx Cloud client downloaded successfully',
                bodyLines: [`Version: ${result.version}`],
            });
        }
    });
}
