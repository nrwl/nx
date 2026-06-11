"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = update;
const nx_json_1 = require("../../generators/utils/nx-json");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
/**
 * Updates existing workspaces to move nx.json's affected.defaultBase to nx.json's base.
 */
async function update(host) {
    const nxJson = (0, nx_json_1.readNxJson)(host);
    if (nxJson?.affected?.defaultBase) {
        nxJson.defaultBase = nxJson.affected.defaultBase;
        delete nxJson.affected.defaultBase;
        if (Object.keys(nxJson.affected).length === 0) {
            delete nxJson.affected;
        }
        (0, nx_json_1.updateNxJson)(host, nxJson);
    }
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(host);
}
