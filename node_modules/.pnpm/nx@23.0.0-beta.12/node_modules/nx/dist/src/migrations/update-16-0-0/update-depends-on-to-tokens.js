"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const project_configuration_1 = require("../../generators/utils/project-configuration");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
async function default_1(tree) {
    updateDependsOnAndInputsInsideNxJson(tree);
    const projectsConfigurations = (0, project_configuration_1.getProjects)(tree);
    for (const [projectName, projectConfiguration] of projectsConfigurations) {
        let projectChanged = false;
        for (const [targetName, targetConfiguration] of Object.entries(projectConfiguration.targets ?? {})) {
            for (const dependency of targetConfiguration.dependsOn ?? []) {
                if (typeof dependency !== 'string') {
                    if (dependency.projects === 'self' ||
                        dependency.projects === '{self}') {
                        delete dependency.projects;
                        projectChanged = true;
                    }
                    else if (dependency.projects === 'dependencies' ||
                        dependency.projects === '{dependencies}') {
                        delete dependency.projects;
                        dependency.dependencies = true;
                        projectChanged = true;
                    }
                }
            }
            for (let i = 0; i < (targetConfiguration.inputs?.length ?? 0); i++) {
                const input = targetConfiguration.inputs[i];
                if (typeof input !== 'string') {
                    if ('projects' in input &&
                        (input.projects === 'self' || input.projects === '{self}')) {
                        delete input.projects;
                        projectChanged = true;
                    }
                    else if ('projects' in input &&
                        (input.projects === 'dependencies' ||
                            input.projects === '{dependencies}')) {
                        delete input.projects;
                        targetConfiguration.inputs[i] = {
                            ...input,
                            dependencies: true,
                        };
                        projectChanged = true;
                    }
                }
            }
        }
        if (projectChanged) {
            (0, project_configuration_1.updateProjectConfiguration)(tree, projectName, projectConfiguration);
        }
    }
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
function updateDependsOnAndInputsInsideNxJson(tree) {
    const nxJson = (0, project_configuration_1.readNxJson)(tree);
    let nxJsonChanged = false;
    for (const [target, defaults] of Object.entries(nxJson?.targetDefaults ?? {})) {
        for (const dependency of defaults.dependsOn ?? []) {
            if (typeof dependency !== 'string') {
                if (dependency.projects === 'self' ||
                    dependency.projects === '{self}') {
                    delete dependency.projects;
                    nxJsonChanged = true;
                }
                else if (dependency.projects === 'dependencies' ||
                    dependency.projects === '{dependencies}') {
                    delete dependency.projects;
                    dependency.dependencies = true;
                    nxJsonChanged = true;
                }
            }
        }
        for (let i = 0; i < (defaults.inputs?.length ?? 0); i++) {
            const input = defaults.inputs[i];
            if (typeof input !== 'string') {
                if ('projects' in input &&
                    (input.projects === 'self' || input.projects === '{self}')) {
                    delete input.projects;
                    nxJsonChanged = true;
                }
                else if ('projects' in input &&
                    (input.projects === 'dependencies' ||
                        input.projects === '{dependencies}')) {
                    delete input.projects;
                    defaults.inputs[i] = {
                        ...input,
                        dependencies: true,
                    };
                    nxJsonChanged = true;
                }
            }
        }
    }
    if (nxJsonChanged) {
        (0, project_configuration_1.updateNxJson)(tree, nxJson);
    }
}
