"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = update;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const nx_json_1 = require("../../generators/utils/nx-json");
const json_1 = require("../../generators/utils/json");
const output_1 = require("../../utils/output");
const path_1 = require("../../utils/path");
async function update(tree) {
    if (!tree.exists('nx.json')) {
        return;
    }
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    delete nxJson.cli?.['defaultCollection'];
    if (nxJson?.cli && Object.keys(nxJson.cli).length < 1) {
        delete nxJson.cli;
    }
    warnNpmScopeHasChanged(tree, nxJson);
    delete nxJson['npmScope'];
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
function warnNpmScopeHasChanged(tree, nxJson) {
    const originalScope = nxJson['npmScope'];
    // There was no original scope
    if (!originalScope) {
        return false;
    }
    // package.json does not exist
    if (!tree.exists('package.json')) {
        return false;
    }
    const newScope = getNpmScopeFromPackageJson(tree);
    // New and Original scope are the same.
    if (originalScope === newScope) {
        return false;
    }
    const packageJsonName = (0, json_1.readJson)(tree, 'package.json').name;
    if (newScope) {
        output_1.output.warn({
            title: 'npmScope has been removed from nx.json',
            bodyLines: [
                'This will now be read from package.json',
                `Old value which was in nx.json: ${originalScope}`,
                `New value from package.json: ${newScope}`,
                `Typescript path mappings for new libraries will now be generated as such: @${newScope}/new-lib instead of @${originalScope}/new-lib`,
                `If you would like to change this back, change the name in package.json to ${packageJsonName.replace(newScope, originalScope)}`,
            ],
        });
    }
    else {
        // There is no scope in package.json
        output_1.output.warn({
            title: 'npmScope has been removed from nx.json',
            bodyLines: [
                'This will now be read from package.json',
                `Old value which was in nx.json: ${originalScope}`,
                `New value from package.json: null`,
                `Typescript path mappings for new libraries will now be generated as such: new-lib instead of @${originalScope}/new-lib`,
                `If you would like to change this back, change the name in package.json to ${(0, path_1.joinPathFragments)(`@${originalScope}`, packageJsonName)}`,
            ],
        });
    }
}
function getNpmScopeFromPackageJson(tree) {
    const { name } = tree.exists('package.json')
        ? (0, json_1.readJson)(tree, 'package.json')
        : { name: null };
    if (name?.startsWith('@')) {
        return name.split('/')[0].substring(1);
    }
}
