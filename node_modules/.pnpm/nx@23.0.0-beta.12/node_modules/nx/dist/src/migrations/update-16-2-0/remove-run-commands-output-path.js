"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = removeRunCommandsOutputPath;
const path_1 = require("../../utils/path");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const json_1 = require("../../generators/utils/json");
const project_configuration_1 = require("../../generators/utils/project-configuration");
async function removeRunCommandsOutputPath(tree) {
    for (const [project, configuration] of (0, project_configuration_1.getProjects)(tree).entries()) {
        const targets = configuration.targets ?? {};
        let changed = false;
        for (const [, target] of Object.entries(targets)) {
            changed ||= updateTargetBlock(target);
        }
        if (changed) {
            (0, project_configuration_1.updateProjectConfiguration)(tree, project, configuration);
        }
    }
    if (tree.exists('nx.json')) {
        (0, json_1.updateJson)(tree, 'nx.json', (json) => {
            for (const [, target] of Object.entries(json.targetDefaults ?? {})) {
                updateTargetBlock(target);
            }
            return json;
        });
    }
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
function updateTargetBlock(target) {
    let changed = false;
    if (target.executor === 'nx:run-commands' && target.options?.outputPath) {
        changed = true;
        const outputs = new Set(target.outputs ?? []);
        outputs.delete('{options.outputPath}');
        const newOutputs = Array.isArray(target.options.outputPath)
            ? target.options.outputPath.map((p) => (0, path_1.joinPathFragments)('{workspaceRoot}', p))
            : [(0, path_1.joinPathFragments)('{workspaceRoot}', target.options.outputPath)];
        for (const outputPath of newOutputs) {
            outputs.add(outputPath);
        }
        delete target.options.outputPath;
        target.outputs = Array.from(outputs);
    }
    return changed;
}
