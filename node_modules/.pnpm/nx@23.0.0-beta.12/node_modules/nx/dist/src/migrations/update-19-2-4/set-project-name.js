"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setProjectName;
const to_project_name_1 = require("../../config/to-project-name");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const json_1 = require("../../generators/utils/json");
const project_configuration_1 = require("../../generators/utils/project-configuration");
async function setProjectName(tree) {
    // We are explicitly looking for project.json files here, so getProjects is fine.
    const projects = (0, project_configuration_1.getProjects)(tree);
    for (const { root } of projects.values()) {
        const projectJsonPath = `${root}/project.json`;
        const packageJsonPath = `${root}/package.json`;
        // If either of these files doesn't exist, theres no behavioral difference
        if (!tree.exists(projectJsonPath) || !tree.exists(packageJsonPath)) {
            continue;
        }
        const projectJson = (0, json_1.readJson)(tree, projectJsonPath);
        // In Nx 19.1+, the way the project name is inferred is different.
        // For existing projects, if the name is not set, we can inline it
        // based on the existing logic. This makes sure folks aren't caught
        // off guard by the new behavior.
        if (!projectJson.name) {
            const siblingPackageJson = (0, json_1.readJson)(tree, packageJsonPath);
            const newName = siblingPackageJson.nx?.name ?? siblingPackageJson.name;
            const oldName = (0, to_project_name_1.toProjectName)(projectJsonPath);
            if (newName && oldName !== newName) {
                projectJson.name = oldName;
                (0, json_1.writeJson)(tree, projectJsonPath, projectJson);
            }
        }
    }
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
