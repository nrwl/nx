"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findInstalledPlugins = findInstalledPlugins;
exports.getInstalledPluginsAndCapabilities = getInstalledPluginsAndCapabilities;
const path_1 = require("path");
const nx_json_1 = require("../../config/nx-json");
const fileutils_1 = require("../fileutils");
const installation_directory_1 = require("../installation-directory");
const package_json_1 = require("../package-json");
const workspace_root_1 = require("../workspace-root");
const plugin_capabilities_1 = require("./plugin-capabilities");
function findInstalledPlugins() {
    const packageJsonDeps = getDependenciesFromPackageJson();
    const nxJsonDeps = getDependenciesFromNxJson();
    const deps = packageJsonDeps.concat(nxJsonDeps);
    const result = [];
    for (const dep of deps) {
        const pluginPackageJson = getNxPluginPackageJsonOrNull(dep);
        if (pluginPackageJson) {
            result.push(pluginPackageJson);
        }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
}
function getNxPluginPackageJsonOrNull(pkg) {
    try {
        const { packageJson } = (0, package_json_1.readModulePackageJson)(pkg, (0, installation_directory_1.getNxRequirePaths)());
        return packageJson &&
            [
                'ng-update',
                'nx-migrations',
                'schematics',
                'generators',
                'builders',
                'executors',
            ].some((field) => field in packageJson)
            ? packageJson
            : null;
    }
    catch {
        return null;
    }
}
function getDependenciesFromPackageJson(packageJsonPath = 'package.json') {
    try {
        const { dependencies, devDependencies } = (0, fileutils_1.readJsonFile)((0, path_1.join)(workspace_root_1.workspaceRoot, packageJsonPath));
        return Object.keys({ ...dependencies, ...devDependencies });
    }
    catch { }
    return [];
}
function getDependenciesFromNxJson() {
    const { installation } = (0, nx_json_1.readNxJson)();
    if (!installation) {
        return [];
    }
    return ['nx', ...Object.keys(installation.plugins || {})];
}
async function getInstalledPluginsAndCapabilities(workspaceRoot, projects) {
    const plugins = findInstalledPlugins().map((p) => p.name);
    const result = new Map();
    for (const plugin of Array.from(plugins).sort()) {
        try {
            const capabilities = await (0, plugin_capabilities_1.getPluginCapabilities)(workspaceRoot, plugin, projects);
            if (capabilities &&
                (capabilities.executors ||
                    capabilities.generators ||
                    capabilities.projectGraphExtension ||
                    capabilities.projectInference)) {
                result.set(plugin, capabilities);
            }
        }
        catch { }
    }
    return result;
}
