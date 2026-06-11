"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginHandler = loginHandler;
const utils_1 = require("../utils");
function loginHandler(args) {
    if (args.nxCloudUrl) {
        process.env.NX_CLOUD_API = args.nxCloudUrl;
    }
    return (0, utils_1.executeNxCloudCommand)('login', args.verbose);
}
