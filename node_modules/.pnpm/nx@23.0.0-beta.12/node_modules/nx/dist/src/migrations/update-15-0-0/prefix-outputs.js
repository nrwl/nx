"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const project_configuration_1 = require("../../generators/utils/project-configuration");
const nx_json_1 = require("../../generators/utils/nx-json");
const path_1 = require("path");
const utils_1 = require("../../tasks-runner/utils");
const json_1 = require("../../generators/utils/json");
async function default_1(tree) {
    // If the workspace doesn't have a nx.json, don't make any changes
    if (!tree.exists('nx.json')) {
        return;
    }
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    for (const [projectName, project] of (0, project_configuration_1.getProjects)(tree)) {
        for (const [_, target] of Object.entries(project.targets ?? {})) {
            if (!target.outputs) {
                continue;
            }
            target.outputs = (0, utils_1.transformLegacyOutputs)(project.root, target.outputs);
        }
        try {
            (0, project_configuration_1.updateProjectConfiguration)(tree, projectName, project);
        }
        catch {
            if (tree.exists((0, path_1.join)(project.root, 'package.json'))) {
                (0, json_1.updateJson)(tree, (0, path_1.join)(project.root, 'package.json'), (json) => {
                    for (const target of Object.values(json.nx?.targets ?? {})) {
                        if (target.outputs) {
                            target.outputs = (0, utils_1.transformLegacyOutputs)(project.root, target.outputs);
                        }
                    }
                    return json;
                });
            }
        }
    }
    if (nxJson.targetDefaults) {
        for (const [_, target] of Object.entries(nxJson.targetDefaults)) {
            if (!target.outputs) {
                continue;
            }
            target.outputs = (0, utils_1.transformLegacyOutputs)('{projectRoot}', target.outputs);
        }
        (0, nx_json_1.updateNxJson)(tree, nxJson);
    }
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
