"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDefaultProjectName = calculateDefaultProjectName;
exports.findMatchingProjectInCwd = findMatchingProjectInCwd;
const find_project_for_path_1 = require("../project-graph/utils/find-project-for-path");
const path_1 = require("path");
function calculateDefaultProjectName(cwd, root, { projects }, nxJson) {
    const relativeCwd = (0, path_1.relative)(root, cwd).replace(/\\/g, '/') ?? null;
    if (relativeCwd !== null) {
        const matchingProject = findMatchingProjectInCwd(projects, relativeCwd);
        // We have found a project
        if (matchingProject) {
            // That is not at the root
            if (projects[matchingProject].root !== '.' &&
                projects[matchingProject].root !== '') {
                return matchingProject;
                // But its at the root, and NX_DEFAULT_PROJECT is set
            }
            else if (process.env.NX_DEFAULT_PROJECT) {
                return process.env.NX_DEFAULT_PROJECT;
                // Its root, and NX_DEFAULT_PROJECT is not set
            }
            else {
                return matchingProject;
            }
        }
    }
    // There was no matching project in cwd.
    return (process.env.NX_DEFAULT_PROJECT ??
        nxJson.cli?.defaultProjectName ??
        nxJson?.defaultProject);
}
function findMatchingProjectInCwd(projects, relativeCwd) {
    const projectRootMappings = new Map();
    for (const projectName of Object.keys(projects)) {
        const { root } = projects[projectName];
        projectRootMappings.set((0, find_project_for_path_1.normalizeProjectRoot)(root), projectName);
    }
    const matchingProject = (0, find_project_for_path_1.findProjectForPath)(relativeCwd, projectRootMappings);
    return matchingProject;
}
