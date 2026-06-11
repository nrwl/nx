"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = update;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const nx_json_1 = require("../../generators/utils/nx-json");
async function update(tree) {
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    if (!nxJson || !nxJson.release) {
        return;
    }
    function updateProperty(changelogConfig) {
        if (changelogConfig.renderOptions &&
            'mapAuthorsToGitHubUsernames' in changelogConfig.renderOptions) {
            changelogConfig.renderOptions.applyUsernameToAuthors =
                changelogConfig.renderOptions.mapAuthorsToGitHubUsernames;
            delete changelogConfig.renderOptions.mapAuthorsToGitHubUsernames;
        }
    }
    if (nxJson.release.changelog) {
        if (nxJson.release.changelog.workspaceChangelog &&
            typeof nxJson.release.changelog.workspaceChangelog !== 'boolean') {
            updateProperty(nxJson.release.changelog.workspaceChangelog);
        }
        if (nxJson.release.changelog.projectChangelogs &&
            typeof nxJson.release.changelog.projectChangelogs !== 'boolean') {
            updateProperty(nxJson.release.changelog.projectChangelogs);
        }
    }
    if (nxJson.release.groups) {
        for (const group of Object.values(nxJson.release.groups)) {
            if (group.changelog && typeof group.changelog !== 'boolean') {
                updateProperty(group.changelog);
            }
        }
    }
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
