"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = update;
const node_path_1 = require("node:path");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const json_1 = require("../../generators/utils/json");
const nx_json_1 = require("../../generators/utils/nx-json");
const project_configuration_1 = require("../../generators/utils/project-configuration");
async function update(tree) {
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    if (!nxJson) {
        return;
    }
    // Note: Any's have been used as LegacyVersioning Options have been removed
    function updateProperties(versionConfig) {
        // These options used to live inside of generatorOptions, but are now like for like top-level nx core options
        const coreOptionsToPromoteToTopLevel = [
            'specifierSource',
            'currentVersionResolver',
            'currentVersionResolverMetadata',
            'fallbackCurrentVersionResolver',
            'versionPrefix',
            'updateDependents',
            'logUnchangedProjects',
        ];
        if ('generatorOptions' in versionConfig) {
            for (const option of coreOptionsToPromoteToTopLevel) {
                if (versionConfig.generatorOptions[option]) {
                    versionConfig[option] = versionConfig.generatorOptions[option];
                }
            }
            // preserveLocalDependencyProtocols has changed to true by default, so remove it if explicitly true, otherwise set to false explicitly
            if (versionConfig.generatorOptions.preserveLocalDependencyProtocols) {
                delete versionConfig.generatorOptions.preserveLocalDependencyProtocols;
            }
            else {
                versionConfig.preserveLocalDependencyProtocols = false;
            }
            // packageRoot has been replaced by manifestRootsToUpdate
            if (typeof versionConfig.generatorOptions.packageRoot === 'string') {
                versionConfig.manifestRootsToUpdate =
                    [versionConfig.generatorOptions.packageRoot];
                delete versionConfig.generatorOptions.packageRoot;
            }
            // These options have been moved to versionActionsOptions
            const versionActionsOptions = [
                'skipLockFileUpdate',
                'installArgs',
                'installIgnoreScripts',
            ];
            for (const option of versionActionsOptions) {
                if (versionConfig.generatorOptions[option]) {
                    versionConfig.versionActionsOptions =
                        versionConfig
                            .versionActionsOptions || {};
                    versionConfig.versionActionsOptions[option] =
                        versionConfig.generatorOptions[option];
                    delete versionConfig.generatorOptions[option];
                }
            }
            delete versionConfig.generatorOptions;
        }
    }
    // nx.json
    if (nxJson.release) {
        // Top level version config
        if (nxJson.release.version) {
            updateProperties(nxJson.release.version);
        }
        // Version config for each group
        if (nxJson.release.groups) {
            for (const group of Object.values(nxJson.release.groups)) {
                if (group.version) {
                    updateProperties(group.version);
                }
            }
        }
    }
    // project.json or package.json
    const projects = (0, project_configuration_1.getProjects)(tree);
    for (const project of projects.values()) {
        const projectJsonPath = (0, node_path_1.join)(project.root, 'project.json');
        if (tree.exists(projectJsonPath)) {
            const projectJson = (0, json_1.readJson)(tree, projectJsonPath);
            if (projectJson.release?.version) {
                updateProperties(projectJson.release.version);
                (0, json_1.writeJson)(tree, projectJsonPath, projectJson);
            }
        }
        const packageJsonPath = (0, node_path_1.join)(project.root, 'package.json');
        if (tree.exists(packageJsonPath)) {
            const packageJson = (0, json_1.readJson)(tree, packageJsonPath);
            if (packageJson.nx?.release?.version) {
                updateProperties(packageJson.nx.release.version);
                (0, json_1.writeJson)(tree, packageJsonPath, packageJson);
            }
        }
    }
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
