"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = update;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const nx_json_1 = require("../../generators/utils/nx-json");
async function update(tree) {
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    if (!nxJson) {
        return;
    }
    // If workspaces  had `useLegacyCache` we can just delete the property as the property is not functional in nx v21
    if (nxJson.useLegacyCache) {
        delete nxJson.useLegacyCache;
    }
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
