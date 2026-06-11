"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workspace_root_1 = require("../src/utils/workspace-root");
const fileutils_1 = require("../src/utils/fileutils");
const path_1 = require("path");
const assert_supported_platform_1 = require("../src/native/assert-supported-platform");
const update_manager_1 = require("../src/nx-cloud/update-manager");
const get_cloud_options_1 = require("../src/nx-cloud/utilities/get-cloud-options");
const nx_cloud_utils_1 = require("../src/utils/nx-cloud-utils");
const nx_json_1 = require("../src/config/nx-json");
const logger_1 = require("../src/utils/logger");
// The post install is not critical, to avoid any chance that it may hang
// we will kill this process after 30 seconds.
const postinstallTimeout = setTimeout(() => {
    logger_1.logger.verbose('Nx post-install timed out.');
    process.exit(0);
}, 30_000);
(async () => {
    const start = new Date();
    try {
        if (isMainNxPackage() && (0, fileutils_1.fileExists)((0, path_1.join)(workspace_root_1.workspaceRoot, 'nx.json'))) {
            (0, assert_supported_platform_1.assertSupportedPlatform)();
            if ((0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)())) {
                await (0, update_manager_1.verifyOrUpdateNxCloudClient)((0, get_cloud_options_1.getCloudOptions)());
            }
        }
    }
    catch (e) {
        logger_1.logger.verbose(e);
    }
    finally {
        const end = new Date();
        logger_1.logger.verbose(`Nx postinstall steps took ${end.getTime() - start.getTime()}ms`);
        clearTimeout(postinstallTimeout);
        process.exit(0);
    }
})();
function isMainNxPackage() {
    const mainNxPath = require.resolve('nx', {
        paths: [workspace_root_1.workspaceRoot],
    });
    const thisNxPath = require.resolve('nx');
    return mainNxPath === thisNxPath;
}
process.on('uncaughtException', (e) => {
    logger_1.logger.verbose(e);
    process.exit(0);
});
process.on('unhandledRejection', (e) => {
    logger_1.logger.verbose(e);
    process.exit(0);
});
