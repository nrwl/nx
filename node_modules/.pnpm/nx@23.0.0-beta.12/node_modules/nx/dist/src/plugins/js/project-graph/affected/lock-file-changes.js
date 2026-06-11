"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTouchedProjectsFromLockFile = exports.PNPM_LOCK_FILES = void 0;
const configuration_1 = require("../../../../config/configuration");
const json_diff_1 = require("../../../../utils/json-diff");
const config_1 = require("../../utils/config");
const find_matching_projects_1 = require("../../../../utils/find-matching-projects");
exports.PNPM_LOCK_FILES = ['pnpm-lock.yaml', 'pnpm-lock.yml'];
const ALL_LOCK_FILES = [
    ...exports.PNPM_LOCK_FILES,
    'package-lock.json',
    'yarn.lock',
    'bun.lockb',
    'bun.lock',
];
const getTouchedProjectsFromLockFile = (fileChanges, projectGraphNodes) => {
    const nxJson = (0, configuration_1.readNxJson)();
    const { projectsAffectedByDependencyUpdates } = (0, config_1.jsPluginConfig)(nxJson);
    const changedLockFile = fileChanges.find((f) => ALL_LOCK_FILES.includes(f.file));
    if (projectsAffectedByDependencyUpdates === 'auto') {
        const changedProjectPaths = getProjectPathsAffectedByDependencyUpdates(changedLockFile);
        const changedProjectNames = getProjectsNamesFromPaths(projectGraphNodes, changedProjectPaths);
        return changedProjectNames;
    }
    else if (Array.isArray(projectsAffectedByDependencyUpdates)) {
        return (0, find_matching_projects_1.findMatchingProjects)(projectsAffectedByDependencyUpdates, projectGraphNodes);
    }
    if (changedLockFile) {
        return Object.values(projectGraphNodes).map((p) => p.name);
    }
    return [];
};
exports.getTouchedProjectsFromLockFile = getTouchedProjectsFromLockFile;
/**
 * For pnpm projects, check lock file for changes to importers and return the project paths that have changes.
 */
const getProjectPathsAffectedByDependencyUpdates = (changedLockFile) => {
    if (!changedLockFile) {
        return [];
    }
    const changedProjectPaths = new Set();
    if (exports.PNPM_LOCK_FILES.includes(changedLockFile.file)) {
        for (const change of changedLockFile.getChanges()) {
            if ((0, json_diff_1.isJsonChange)(change) &&
                change.path[0] === 'importers' &&
                change.path[1] !== undefined) {
                changedProjectPaths.add(change.path[1]);
            }
        }
    }
    return Array.from(changedProjectPaths);
};
const getProjectsNamesFromPaths = (projectGraphNodes, projectPaths) => {
    if (!projectPaths.length) {
        return [];
    }
    const lookup = new RootPathLookup(projectGraphNodes);
    return projectPaths
        .map((path) => lookup.findNodeNameByRoot(path))
        .filter(Boolean);
};
class RootPathLookup {
    constructor(nodes) {
        this.rootToNameMap = new Map();
        Object.entries(nodes).forEach(([name, node]) => {
            this.rootToNameMap.set(node.data.root, name);
        });
    }
    findNodeNameByRoot(root) {
        return this.rootToNameMap.get(root);
    }
}
