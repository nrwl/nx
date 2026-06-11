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
    function migrateReleaseTagConfig(config) {
        if (!config) {
            return;
        }
        // Check if any of the old properties exist
        const hasOldProperties = 'releaseTagPattern' in config ||
            'releaseTagPatternCheckAllBranchesWhen' in config ||
            'releaseTagPatternRequireSemver' in config ||
            'releaseTagPatternPreferDockerVersion' in config ||
            'releaseTagPatternStrictPreid' in config;
        if (!hasOldProperties) {
            return;
        }
        // Create the new nested releaseTag object if it doesn't exist
        if (!config.releaseTag) {
            config.releaseTag = {};
        }
        // Migrate each property to the nested structure
        // Only migrate if the new property doesn't already exist (new format takes precedence)
        if ('releaseTagPattern' in config) {
            if (!('pattern' in config.releaseTag)) {
                config.releaseTag.pattern = config.releaseTagPattern;
            }
            delete config.releaseTagPattern;
        }
        if ('releaseTagPatternCheckAllBranchesWhen' in config) {
            if (!('checkAllBranchesWhen' in config.releaseTag)) {
                config.releaseTag.checkAllBranchesWhen =
                    config.releaseTagPatternCheckAllBranchesWhen;
            }
            delete config.releaseTagPatternCheckAllBranchesWhen;
        }
        if ('releaseTagPatternRequireSemver' in config) {
            if (!('requireSemver' in config.releaseTag)) {
                config.releaseTag.requireSemver = config.releaseTagPatternRequireSemver;
            }
            delete config.releaseTagPatternRequireSemver;
        }
        if ('releaseTagPatternPreferDockerVersion' in config) {
            if (!('preferDockerVersion' in config.releaseTag)) {
                config.releaseTag.preferDockerVersion =
                    config.releaseTagPatternPreferDockerVersion;
            }
            delete config.releaseTagPatternPreferDockerVersion;
        }
        if ('releaseTagPatternStrictPreid' in config) {
            if (!('strictPreid' in config.releaseTag)) {
                config.releaseTag.strictPreid = config.releaseTagPatternStrictPreid;
            }
            delete config.releaseTagPatternStrictPreid;
        }
    }
    // Migrate top-level release configuration in nx.json
    if (nxJson.release) {
        migrateReleaseTagConfig(nxJson.release);
        // Migrate release groups configuration
        if (nxJson.release.groups) {
            for (const group of Object.values(nxJson.release.groups)) {
                migrateReleaseTagConfig(group);
            }
        }
    }
    // Migrate project-level configuration in project.json and package.json
    const projects = (0, project_configuration_1.getProjects)(tree);
    for (const project of projects.values()) {
        // Check project.json
        const projectJsonPath = (0, node_path_1.join)(project.root, 'project.json');
        if (tree.exists(projectJsonPath)) {
            const projectJson = (0, json_1.readJson)(tree, projectJsonPath);
            if (projectJson.release) {
                migrateReleaseTagConfig(projectJson.release);
                (0, json_1.writeJson)(tree, projectJsonPath, projectJson);
            }
        }
        // Check package.json
        const packageJsonPath = (0, node_path_1.join)(project.root, 'package.json');
        if (tree.exists(packageJsonPath)) {
            const packageJson = (0, json_1.readJson)(tree, packageJsonPath);
            if (packageJson.nx?.release) {
                migrateReleaseTagConfig(packageJson.nx.release);
                (0, json_1.writeJson)(tree, packageJsonPath, packageJson);
            }
        }
    }
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
