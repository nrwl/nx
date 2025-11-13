"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPackageJsonConfigurationCache = readPackageJsonConfigurationCache;
const index_js_1 = require("../src/project-graph/plugins/index.js");
const workspace_root_js_1 = require("../src/utils/workspace-root.js");
const index_js_2 = require("../src/plugins/package-json/index.js");
const cache_directory_js_1 = require("../src/utils/cache-directory.js");
const path_1 = require("path");
const fileutils_js_1 = require("../src/utils/fileutils.js");
const cachePath = (0, path_1.join)(cache_directory_js_1.workspaceDataDirectory, 'package-json.hash');
function readPackageJsonConfigurationCache() {
    try {
        return (0, fileutils_js_1.readJsonFile)(cachePath);
    }
    catch (e) {
        return {};
    }
}
function writeCache(cache) {
    (0, fileutils_js_1.writeJsonFile)(cachePath, cache);
}
const plugin = {
    name: 'nx-all-package-jsons-plugin',
    createNodesV2: [
        '*/**/package.json',
        (configFiles, options, context) => {
            const cache = readPackageJsonConfigurationCache();
            const isInPackageJsonWorkspaces = (0, index_js_2.buildPackageJsonWorkspacesMatcher)(context.workspaceRoot, (f) => (0, fileutils_js_1.readJsonFile)((0, path_1.join)(context.workspaceRoot, f)));
            const result = (0, index_js_1.createNodesFromFiles)((packageJsonPath) => (0, index_js_2.createNodeFromPackageJson)(packageJsonPath, workspace_root_js_1.workspaceRoot, cache, isInPackageJsonWorkspaces(packageJsonPath)), configFiles, options, context);
            writeCache(cache);
            return result;
        },
    ],
};
module.exports = plugin;
module.exports.readPackageJsonConfigurationCache =
    readPackageJsonConfigurationCache;
