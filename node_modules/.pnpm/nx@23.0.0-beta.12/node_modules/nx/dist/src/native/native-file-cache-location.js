"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNativeFileCacheLocation = getNativeFileCacheLocation;
const os_1 = require("os");
const path_1 = require("path");
const crypto_1 = require("crypto");
const workspace_root_1 = require("../utils/workspace-root");
const versions_1 = require("../utils/versions");
function getNativeFileCacheLocation() {
    if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
        return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
    }
    else {
        const hash = (0, crypto_1.createHash)('sha256').update(workspace_root_1.workspaceRoot).update(versions_1.nxVersion);
        try {
            hash.update((0, os_1.userInfo)().username);
        }
        catch (e) {
            // if there's no user, we only use the workspace root for the hash and move on
        }
        return (0, path_1.join)((0, os_1.tmpdir)(), `nx-native-file-cache-${hash.digest('hex').substring(0, 7)}`);
    }
}
