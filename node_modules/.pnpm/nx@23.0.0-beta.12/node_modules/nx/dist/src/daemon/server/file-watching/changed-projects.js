"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectsAndGlobalChanges = getProjectsAndGlobalChanges;
const perf_hooks_1 = require("perf_hooks");
const find_project_for_path_1 = require("../../../project-graph/utils/find-project-for-path");
const project_graph_incremental_recomputation_1 = require("../project-graph-incremental-recomputation");
// Cache the root mapping across notifications. `currentProjectGraph` is
// replaced (new reference) on every recomputation, so reference-identity
// tells us when the cache is stale.
let cachedGraphRef;
let cachedProjectRootMappings = new Map();
function getProjectsAndGlobalChanges(createdFiles, updatedFiles, deletedFiles) {
    const projectAndGlobalChanges = {
        projects: {},
        globalFiles: [],
    };
    perf_hooks_1.performance.mark('changed-projects:start');
    const allChangedFiles = [
        ...(createdFiles ?? []).map((c) => ({
            path: c,
            type: 'create',
        })),
        ...(updatedFiles ?? []).map((c) => ({
            path: c,
            type: 'update',
        })),
        ...(deletedFiles ?? []).map((c) => ({
            path: c,
            type: 'delete',
        })),
    ];
    // Map by project-root prefix rather than by known file membership. A newly
    // created file won't appear in the fileMap until the next recomputation, but
    // its path already tells us which project it belongs to.
    if (project_graph_incremental_recomputation_1.currentProjectGraph !== cachedGraphRef) {
        cachedGraphRef = project_graph_incremental_recomputation_1.currentProjectGraph;
        cachedProjectRootMappings = project_graph_incremental_recomputation_1.currentProjectGraph
            ? (0, find_project_for_path_1.createProjectRootMappings)(project_graph_incremental_recomputation_1.currentProjectGraph.nodes)
            : new Map();
    }
    for (const changedFile of allChangedFiles) {
        const project = (0, find_project_for_path_1.findProjectForPath)(changedFile.path, cachedProjectRootMappings);
        if (project) {
            (projectAndGlobalChanges.projects[project] ??= []).push(changedFile);
        }
        else {
            projectAndGlobalChanges.globalFiles.push(changedFile);
        }
    }
    perf_hooks_1.performance.mark('changed-projects:end');
    perf_hooks_1.performance.measure('changed-projects', 'changed-projects:start', 'changed-projects:end');
    return projectAndGlobalChanges;
}
