"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalWorkspacePlugins = getLocalWorkspacePlugins;
const fs_1 = require("fs");
const path_1 = require("path");
const fileutils_1 = require("../fileutils");
const workspace_root_1 = require("../workspace-root");
const plugin_capabilities_1 = require("./plugin-capabilities");
async function getLocalWorkspacePlugins(projectsConfiguration, nxJson) {
    const plugins = new Map();
    for (const project of Object.values(projectsConfiguration.projects)) {
        const packageJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, project.root, 'package.json');
        if ((0, fs_1.existsSync)(packageJsonPath)) {
            const packageJson = (0, fileutils_1.readJsonFile)(packageJsonPath);
            const includeRuntimeCapabilities = nxJson?.plugins?.some((p) => (typeof p === 'string' ? p : p.plugin).startsWith(packageJson.name));
            const capabilities = await (0, plugin_capabilities_1.getPluginCapabilities)(workspace_root_1.workspaceRoot, packageJson.name, projectsConfiguration.projects, includeRuntimeCapabilities);
            if (capabilities &&
                (Object.keys(capabilities.executors ?? {}).length ||
                    Object.keys(capabilities.generators ?? {}).length ||
                    capabilities.projectGraphExtension ||
                    capabilities.projectInference)) {
                plugins.set(packageJson.name, {
                    ...capabilities,
                    name: packageJson.name,
                });
            }
        }
    }
    return plugins;
}
