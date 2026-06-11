"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutHandler = logoutHandler;
const utils_1 = require("../utils");
function logoutHandler(args) {
    return (0, utils_1.executeNxCloudCommand)('logout', args.verbose);
}
