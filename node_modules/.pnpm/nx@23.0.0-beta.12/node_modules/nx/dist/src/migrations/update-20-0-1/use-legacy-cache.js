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
    // If workspaces  had `enableDbCache` we can just delete the property as the db cache is enabled by default in nx v20
    if (nxJson.enableDbCache) {
        delete nxJson.enableDbCache;
    }
    else {
        nxJson.useLegacyCache = true;
    }
    (0, nx_json_1.updateNxJson)(tree, nxJson);
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
