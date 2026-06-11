"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectRootMappingsFromProjectConfigurations = createProjectRootMappingsFromProjectConfigurations;
exports.createProjectRootMappings = createProjectRootMappings;
exports.findProjectForPath = findProjectForPath;
exports.normalizeProjectRoot = normalizeProjectRoot;
const path_1 = require("path");
const path_2 = require("../../utils/path");
/**
 * This creates a map of project roots to project names to easily look up the project of a file
 * @param projects This is the map of project configurations commonly found in "workspace.json"
 */
function createProjectRootMappingsFromProjectConfigurations(projects) {
    const projectRootMappings = new Map();
    for (const { name, root } of Object.values(projects)) {
        projectRootMappings.set(normalizeProjectRoot(root), name);
    }
    return projectRootMappings;
}
/**
 * This creates a map of project roots to project names to easily look up the project of a file
 * @param nodes This is the nodes from the project graph
 */
function createProjectRootMappings(nodes) {
    const projectRootMappings = new Map();
    for (const projectName of Object.keys(nodes)) {
        let root = nodes[projectName].data.root;
        projectRootMappings.set(normalizeProjectRoot(root), projectName);
    }
    return projectRootMappings;
}
/**
 * Locates a project in projectRootMap based on a file within it
 * @param filePath path that is inside of projectName. This should be relative from the workspace root
 * @param projectRootMap Map<projectRoot, projectName> Use {@link createProjectRootMappings} to create this
 */
function findProjectForPath(filePath, projectRootMap) {
    /**
     * Project Mappings are in UNIX-style file paths
     * Windows may pass Win-style file paths
     * Ensure filePath is in UNIX-style
     */
    let currentPath = (0, path_2.normalizePath)(filePath);
    for (; currentPath != (0, path_1.dirname)(currentPath); currentPath = (0, path_1.dirname)(currentPath)) {
        const p = projectRootMap.get(currentPath);
        if (p) {
            return p;
        }
    }
    return projectRootMap.get(currentPath);
}
function normalizeProjectRoot(root) {
    root = root === '' ? '.' : root;
    return root && root.endsWith('/') ? root.substring(0, root.length - 1) : root;
}
