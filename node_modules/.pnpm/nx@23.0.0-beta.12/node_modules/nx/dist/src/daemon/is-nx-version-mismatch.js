"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNxVersionMismatch = isNxVersionMismatch;
const versions_1 = require("../utils/versions");
const installed_nx_version_1 = require("../utils/installed-nx-version");
function isNxVersionMismatch() {
    return (0, installed_nx_version_1.getInstalledNxVersion)() !== versions_1.nxVersion;
}
