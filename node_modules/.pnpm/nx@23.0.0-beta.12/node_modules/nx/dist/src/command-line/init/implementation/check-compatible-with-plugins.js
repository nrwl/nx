"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCompatibleWithPlugins = checkCompatibleWithPlugins;
exports.updatePluginsInNxJson = updatePluginsInNxJson;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const picocolors_1 = require("picocolors");
const error_types_1 = require("../../../project-graph/error-types");
const workspace_root_1 = require("../../../utils/workspace-root");
const fileutils_1 = require("../../../utils/fileutils");
const output_1 = require("../../../utils/output");
const project_graph_1 = require("../../../project-graph/project-graph");
/**
 * This function checks if the imported project is compatible with the plugins.
 * @returns a map of plugin names to files that are incompatible with the plugins
 */
async function checkCompatibleWithPlugins() {
    let pluginToExcludeFiles = {};
    try {
        await (0, project_graph_1.createProjectGraphAsync)();
    }
    catch (projectGraphError) {
        if (projectGraphError instanceof error_types_1.ProjectGraphError) {
            projectGraphError.getErrors()?.forEach((error) => {
                const { pluginIndex, excludeFiles } = findPluginAndFilesWithError(error) ?? {};
                if (pluginIndex !== undefined && excludeFiles?.length) {
                    pluginToExcludeFiles[pluginIndex] ??= [];
                    pluginToExcludeFiles[pluginIndex].push(...excludeFiles);
                }
                else if (!(0, error_types_1.isProjectsWithNoNameError)(error)) {
                    // print error if it is not ProjectsWithNoNameError and unable to exclude files
                    output_1.output.error({
                        title: error.message,
                        bodyLines: error.stack?.split('\n'),
                    });
                }
            });
        }
        else {
            output_1.output.error({
                title: 'Failed to process project graph. Run "nx reset" to fix this. Please report the issue if you keep seeing it.',
                bodyLines: projectGraphError.stack?.split('\n'),
            });
        }
    }
    return pluginToExcludeFiles;
}
/**
 * This function finds the plugin name and files that caused the error.
 * @param error the error to find the plugin name and files for
 * @returns pluginName and excludeFiles if found, otherwise undefined
 */
function findPluginAndFilesWithError(error) {
    let pluginIndex;
    let excludeFiles = [];
    if ((0, error_types_1.isAggregateCreateNodesError)(error)) {
        pluginIndex = error.pluginIndex;
        excludeFiles =
            error.errors?.map((error) => {
                return {
                    file: error?.[0],
                    error: error?.[1],
                };
            }) ?? [];
    }
    else if ((0, error_types_1.isMergeNodesError)(error)) {
        pluginIndex = error.pluginIndex;
        excludeFiles = [
            {
                file: error.file,
                error: error,
            },
        ];
    }
    excludeFiles = excludeFiles.filter(Boolean).map((excludeFile) => {
        const file = excludeFile.file;
        excludeFile.file = file.startsWith(workspace_root_1.workspaceRoot)
            ? (0, node_path_1.relative)(workspace_root_1.workspaceRoot, file)
            : file;
        return excludeFile;
    });
    return {
        pluginIndex,
        excludeFiles,
    };
}
/**
 * This function updates the plugins in the nx.json file with the given plugin names and files to exclude.
 */
function updatePluginsInNxJson(root = workspace_root_1.workspaceRoot, pluginToExcludeFiles) {
    const nxJsonPath = (0, node_path_1.join)(root, 'nx.json');
    if (!(0, node_fs_1.existsSync)(nxJsonPath)) {
        return;
    }
    let nxJson;
    try {
        nxJson = (0, fileutils_1.readJsonFile)(nxJsonPath);
    }
    catch {
        // If there is an error reading the nx.json file, no need to update it
        return;
    }
    if (!Object.keys(pluginToExcludeFiles)?.length || !nxJson?.plugins?.length) {
        return;
    }
    Object.entries(pluginToExcludeFiles).forEach(([pluginIndex, excludeFiles]) => {
        let plugin = nxJson.plugins[pluginIndex];
        if (!plugin || excludeFiles.length === 0) {
            return;
        }
        if (typeof plugin === 'string') {
            plugin = { plugin };
        }
        output_1.output.warn({
            title: `The following files were incompatible with ${plugin.plugin} and has been excluded for now:`,
            bodyLines: excludeFiles
                .map((file) => {
                const output = [`  - ${(0, picocolors_1.bold)(file.file)}`];
                if (file.error?.message) {
                    output.push(`    ${file.error.message}`);
                }
                return output;
            })
                .flat(),
        });
        const excludes = new Set(plugin.exclude ?? []);
        excludeFiles.forEach((file) => {
            excludes.add(file.file);
        });
        plugin.exclude = Array.from(excludes);
        nxJson.plugins[pluginIndex] = plugin;
    });
    (0, fileutils_1.writeJsonFile)(nxJsonPath, nxJson);
}
