"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewLogsFooterRows = viewLogsFooterRows;
const nx_json_1 = require("../../config/nx-json");
const nx_cloud_utils_1 = require("../../utils/nx-cloud-utils");
const output_1 = require("../../utils/output");
const VIEW_LOGS_MESSAGE = `Hint: Try "nx view-logs" to get structured, searchable errors logs in your browser.`;
function viewLogsFooterRows(failedTasks) {
    if (failedTasks >= 2 && !(0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)())) {
        return [``, output_1.output.dim(` ${VIEW_LOGS_MESSAGE}`)];
    }
    else {
        return [];
    }
}
