"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = update;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const nx_json_1 = require("../../generators/utils/nx-json");
function isCustomRunnerPath(modulePath) {
    return !['nx-cloud', '@nrwl/nx-cloud', 'nx/tasks-runners/default'].includes(modulePath);
}
async function update(tree) {
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    if (!nxJson?.tasksRunnerOptions) {
        return;
    }
    const nextSteps = [];
    for (const key in nxJson.tasksRunnerOptions) {
        const runner = nxJson.tasksRunnerOptions[key].runner;
        if (runner && isCustomRunnerPath(runner)) {
            let nextStepText = 'Nx 21 removed support for custom task runners. For more information, please check: ';
            if (runner === '@nx-aws-cache/nx-aws-cache') {
                nextStepText +=
                    'https://nx.dev/deprecated/custom-tasks-runner#migrating-from-nxawsplugin';
            }
            else {
                nextStepText += 'https://nx.dev/deprecated/custom-tasks-runner';
            }
            if (nextSteps.length === 0) {
                nextSteps.push(nextStepText);
            }
            delete nxJson.tasksRunnerOptions[key];
        }
    }
    if (Object.keys(nxJson.tasksRunnerOptions).length === 0) {
        delete nxJson.tasksRunnerOptions;
    }
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
    return nextSteps;
}
