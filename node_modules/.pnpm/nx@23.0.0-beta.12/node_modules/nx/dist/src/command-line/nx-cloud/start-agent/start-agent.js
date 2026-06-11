"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAgentHandler = startAgentHandler;
const nx_json_1 = require("../../../config/nx-json");
const nx_cloud_utils_1 = require("../../../utils/nx-cloud-utils");
const utils_1 = require("../utils");
function startAgentHandler(args) {
    if (!(0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)())) {
        (0, utils_1.warnNotConnectedToCloud)();
        return Promise.resolve(0);
    }
    return (0, utils_1.executeNxCloudCommand)('start-agent', args.verbose);
}
