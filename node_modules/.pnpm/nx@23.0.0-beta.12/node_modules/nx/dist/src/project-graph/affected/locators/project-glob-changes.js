"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTouchedProjectsFromProjectGlobChanges = void 0;
const minimatch_1 = require("minimatch");
const nx_json_1 = require("../../../config/nx-json");
const workspace_root_1 = require("../../../utils/workspace-root");
const path_1 = require("path");
const fs_1 = require("fs");
const retrieve_workspace_files_1 = require("../../utils/retrieve-workspace-files");
const globs_1 = require("../../../utils/globs");
const get_plugins_1 = require("../../plugins/get-plugins");
const getTouchedProjectsFromProjectGlobChanges = async (touchedFiles, projectGraphNodes) => {
    const globPattern = await (async () => {
        // TODO: We need a quicker way to get patterns that should not
        // require starting up plugin workers
        if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
            return (0, globs_1.combineGlobPatterns)([
                '**/package.json',
                '**/project.json',
                'project.json',
                'package.json',
            ]);
        }
        const plugins = (await (0, get_plugins_1.getPlugins)((0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot))).filter((p) => !!p.createNodes);
        return (0, globs_1.combineGlobPatterns)((0, retrieve_workspace_files_1.getGlobPatternsOfPlugins)(plugins));
    })();
    const touchedProjects = new Set();
    for (const touchedFile of touchedFiles) {
        const isProjectFile = (0, minimatch_1.minimatch)(touchedFile.file, globPattern, {
            dot: true,
        });
        if (isProjectFile) {
            // If the file no longer exists on disk, then it was deleted
            if (!(0, fs_1.existsSync)((0, path_1.join)(workspace_root_1.workspaceRoot, touchedFile.file))) {
                // If any project has been deleted, we must assume all projects were affected
                return Object.keys(projectGraphNodes);
            }
            // Modified project config files are under a project's root, and implicitly
            // mark it as affected. Thus, we don't need to handle it here.
        }
    }
    return Array.from(touchedProjects);
};
exports.getTouchedProjectsFromProjectGlobChanges = getTouchedProjectsFromProjectGlobChanges;
