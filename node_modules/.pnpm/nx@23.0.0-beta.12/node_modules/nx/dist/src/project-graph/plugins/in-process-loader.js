"use strict";
// This file contains methods and utilities that should **only** be used by the plugin worker.
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPluginPackageJson = readPluginPackageJson;
exports.loadNxPlugin = loadNxPlugin;
exports.loadNxPluginAsync = loadNxPluginAsync;
const installation_directory_1 = require("../../utils/installation-directory");
const package_json_1 = require("../../utils/package-json");
const fileutils_1 = require("../../utils/fileutils");
const error_types_1 = require("../error-types");
const path = require("node:path/posix");
const resolve_plugin_1 = require("./resolve-plugin");
const transpiler_1 = require("./transpiler");
const handle_import_1 = require("../../utils/handle-import");
function readPluginPackageJson(pluginName, projects, paths = (0, installation_directory_1.getNxRequirePaths)()) {
    try {
        const result = (0, package_json_1.readModulePackageJsonWithoutFallbacks)(pluginName, paths);
        return {
            json: result.packageJson,
            path: result.path,
        };
    }
    catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            const localPluginPath = (0, resolve_plugin_1.resolveLocalNxPlugin)(pluginName, projects);
            if (localPluginPath) {
                const localPluginPackageJson = path.join(localPluginPath.path, 'package.json');
                if (!(0, transpiler_1.pluginTranspilerIsRegistered)()) {
                    (0, transpiler_1.registerPluginTSTranspiler)();
                }
                return {
                    path: localPluginPackageJson,
                    json: (0, fileutils_1.readJsonFile)(localPluginPackageJson),
                };
            }
        }
        throw e;
    }
}
function loadNxPlugin(plugin, root, index) {
    return [
        loadNxPluginAsync(plugin, (0, installation_directory_1.getNxRequirePaths)(root), root, index),
        () => { },
    ];
}
async function loadNxPluginAsync(pluginConfiguration, paths, root, index) {
    const moduleName = typeof pluginConfiguration === 'string'
        ? pluginConfiguration
        : pluginConfiguration.plugin;
    try {
        const { pluginPath, name, shouldRegisterTSTranspiler } = await (0, resolve_plugin_1.resolveNxPlugin)(moduleName, root, paths);
        if (shouldRegisterTSTranspiler) {
            (0, transpiler_1.registerPluginTSTranspiler)();
        }
        const { loadResolvedNxPluginAsync } = await (0, handle_import_1.handleImport)(require.resolve('./load-resolved-plugin'));
        return loadResolvedNxPluginAsync(pluginConfiguration, pluginPath, name, index);
    }
    catch (e) {
        throw new error_types_1.LoadPluginError(moduleName, e);
    }
}
