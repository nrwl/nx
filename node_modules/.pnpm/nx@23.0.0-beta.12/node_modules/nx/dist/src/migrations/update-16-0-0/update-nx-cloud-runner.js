"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const project_configuration_1 = require("../../generators/utils/project-configuration");
const json_1 = require("../../generators/utils/json");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
async function default_1(tree) {
    (0, json_1.updateJson)(tree, 'package.json', (json) => {
        if (json.dependencies && json.dependencies['@nrwl/nx-cloud']) {
            json.dependencies['nx-cloud'] = json.dependencies['@nrwl/nx-cloud'];
            delete json.dependencies['@nrwl/nx-cloud'];
        }
        if (json.devDependencies && json.devDependencies['@nrwl/nx-cloud']) {
            json.devDependencies['nx-cloud'] = json.devDependencies['@nrwl/nx-cloud'];
            delete json.devDependencies['@nrwl/nx-cloud'];
        }
        return json;
    });
    const nxJson = (0, project_configuration_1.readNxJson)(tree);
    if (!nxJson)
        return;
    for (let opts of Object.values(nxJson.tasksRunnerOptions ?? {})) {
        if (opts.runner === '@nrwl/nx-cloud') {
            opts.runner = 'nx-cloud';
        }
    }
    (0, project_configuration_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
