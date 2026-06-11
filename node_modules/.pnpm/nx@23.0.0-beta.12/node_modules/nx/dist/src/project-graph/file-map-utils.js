"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectFileMapUsingProjectGraph = createProjectFileMapUsingProjectGraph;
exports.createFileMapUsingProjectGraph = createFileMapUsingProjectGraph;
exports.createFileMap = createFileMap;
exports.updateFileMap = updateFileMap;
const workspace_context_1 = require("../utils/workspace-context");
const workspace_root_1 = require("../utils/workspace-root");
const project_graph_1 = require("./project-graph");
const build_all_workspace_files_1 = require("./utils/build-all-workspace-files");
const find_project_for_path_1 = require("./utils/find-project-for-path");
async function createProjectFileMapUsingProjectGraph(graph) {
    return (await createFileMapUsingProjectGraph(graph)).fileMap.projectFileMap;
}
// TODO: refactor this to pull straight from the rust context instead of creating the file map in JS
async function createFileMapUsingProjectGraph(graph) {
    const configs = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(graph);
    let files = await (0, workspace_context_1.getAllFileDataInContext)(workspace_root_1.workspaceRoot);
    return createFileMap(configs, files);
}
function createFileMap(projectsConfigurations, allWorkspaceFiles) {
    const projectFileMap = {};
    const projectRootMappings = (0, find_project_for_path_1.createProjectRootMappingsFromProjectConfigurations)(projectsConfigurations.projects);
    const nonProjectFiles = [];
    for (const projectName of Object.keys(projectsConfigurations.projects)) {
        projectFileMap[projectName] ??= [];
    }
    for (const f of allWorkspaceFiles) {
        const projectFileMapKey = (0, find_project_for_path_1.findProjectForPath)(f.file, projectRootMappings);
        if (projectFileMapKey) {
            const matchingProjectFiles = projectFileMap[projectFileMapKey];
            if (matchingProjectFiles) {
                matchingProjectFiles.push(f);
            }
        }
        else {
            nonProjectFiles.push(f);
        }
    }
    const result = {
        fileMap: {
            projectFileMap,
            nonProjectFiles,
        },
    };
    Object.defineProperty(result, 'allWorkspaceFiles', {
        enumerable: false,
        configurable: true,
        get() {
            return (0, build_all_workspace_files_1.buildAllWorkspaceFiles)(result.fileMap.projectFileMap, result.fileMap.nonProjectFiles);
        },
    });
    return result;
}
function updateFileMap(projectsConfigurations, rustReferences, updatedFiles, deletedFiles) {
    const updates = (0, workspace_context_1.updateProjectFiles)(Object.fromEntries((0, find_project_for_path_1.createProjectRootMappingsFromProjectConfigurations)(projectsConfigurations)), rustReferences, updatedFiles, deletedFiles);
    return {
        fileMap: updates.fileMap,
        rustReferences: updates.externalReferences,
    };
}
