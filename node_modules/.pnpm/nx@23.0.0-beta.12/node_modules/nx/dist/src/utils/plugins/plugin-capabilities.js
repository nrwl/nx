"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPluginCapabilities = getPluginCapabilities;
const path_1 = require("path");
const fileutils_1 = require("../fileutils");
const installation_directory_1 = require("../installation-directory");
const plugins_1 = require("../../project-graph/plugins");
const in_process_loader_1 = require("../../project-graph/plugins/in-process-loader");
function tryGetCollection(packageJsonPath, collectionFile, propName) {
    if (!collectionFile) {
        return null;
    }
    try {
        const collectionFilePath = (0, path_1.join)((0, path_1.dirname)(packageJsonPath), collectionFile);
        return (0, fileutils_1.readJsonFile)(collectionFilePath)[propName];
    }
    catch {
        return null;
    }
}
async function getPluginCapabilities(workspaceRoot, pluginName, projects, includeRuntimeCapabilities = false) {
    try {
        const { json: packageJson, path: packageJsonPath } = (0, plugins_1.readPluginPackageJson)(pluginName, projects, (0, installation_directory_1.getNxRequirePaths)(workspaceRoot));
        const pluginModule = includeRuntimeCapabilities
            ? await tryGetModule(packageJson, workspaceRoot)
            : {};
        const pluginPath = (0, path_1.relative)(workspaceRoot, (0, path_1.dirname)(packageJsonPath)) || '.';
        return {
            name: pluginName,
            path: pluginPath,
            generators: {
                ...tryGetCollection(packageJsonPath, packageJson.schematics, 'schematics'),
                ...tryGetCollection(packageJsonPath, packageJson.generators, 'schematics'),
                ...tryGetCollection(packageJsonPath, packageJson.schematics, 'generators'),
                ...tryGetCollection(packageJsonPath, packageJson.generators, 'generators'),
            },
            executors: {
                ...tryGetCollection(packageJsonPath, packageJson.builders, 'builders'),
                ...tryGetCollection(packageJsonPath, packageJson.executors, 'builders'),
                ...tryGetCollection(packageJsonPath, packageJson.builders, 'executors'),
                ...tryGetCollection(packageJsonPath, packageJson.executors, 'executors'),
            },
            projectGraphExtension: pluginModule &&
                ('processProjectGraph' in pluginModule ||
                    'createNodes' in pluginModule ||
                    'createNodesV2' in pluginModule ||
                    'createMetadata' in pluginModule ||
                    'createDependencies' in pluginModule),
            projectInference: pluginModule &&
                ('projectFilePatterns' in pluginModule ||
                    'createNodes' in pluginModule ||
                    'createNodesV2' in pluginModule),
        };
    }
    catch {
        return null;
    }
}
async function tryGetModule(packageJson, workspaceRoot) {
    try {
        if (packageJson.generators ??
            packageJson.executors ??
            packageJson['nx-migrations'] ??
            packageJson['schematics'] ??
            packageJson['builders']) {
            const [pluginPromise] = (0, in_process_loader_1.loadNxPlugin)(packageJson.name, workspaceRoot);
            return await pluginPromise;
        }
        else {
            return {
                name: packageJson.name,
            };
        }
    }
    catch {
        return null;
    }
}
