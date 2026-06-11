"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTouchedProjectsInWorkspaceJson = void 0;
const file_utils_1 = require("../../file-utils");
const json_diff_1 = require("../../../utils/json-diff");
const getTouchedProjectsInWorkspaceJson = (touchedFiles, projectGraphNodes) => {
    const workspaceChange = touchedFiles.find((change) => change.file === `angular.json`);
    if (!workspaceChange) {
        return [];
    }
    const changes = workspaceChange.getChanges();
    if (changes.some((change) => {
        if ((0, json_diff_1.isJsonChange)(change)) {
            return change.path[0] !== 'projects';
        }
        if ((0, file_utils_1.isWholeFileChange)(change)) {
            return true;
        }
        return false;
    })) {
        return Object.keys(projectGraphNodes);
    }
    const touched = [];
    for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        if (!(0, json_diff_1.isJsonChange)(change) || change.path[0] !== 'projects') {
            continue;
        }
        // Only look for changes that are changes to the whole project definition
        if (change.path.length !== 2) {
            continue;
        }
        switch (change.type) {
            case json_diff_1.JsonDiffType.Deleted: {
                // We are not sure which projects used to depend on a deleted project
                // so return all projects to be safe
                return Object.keys(projectGraphNodes);
            }
            default: {
                // Add the project name
                touched.push(change.path[1]);
            }
        }
    }
    return touched;
};
exports.getTouchedProjectsInWorkspaceJson = getTouchedProjectsInWorkspaceJson;
