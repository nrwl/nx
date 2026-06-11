"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFormattedJsonFile = writeFormattedJsonFile;
const node_fs_1 = require("node:fs");
const format_changed_files_with_prettier_if_available_1 = require("../generators/internal-utils/format-changed-files-with-prettier-if-available");
const json_1 = require("./json");
const fileutils_1 = require("./fileutils");
const workspace_root_1 = require("./workspace-root");
/**
 * Writes a JSON file, formatting with Prettier if available, otherwise
 * falling back to standard JSON serialization.
 */
async function writeFormattedJsonFile(filePath, content, options) {
    const formattedContent = await (0, format_changed_files_with_prettier_if_available_1.formatFilesWithPrettierIfAvailable)([{ path: filePath, content: (0, json_1.serializeJson)(content) }], workspace_root_1.workspaceRoot, { silent: true });
    if (formattedContent.has(filePath)) {
        (0, node_fs_1.writeFileSync)(filePath, formattedContent.get(filePath), {
            encoding: 'utf-8',
        });
    }
    else {
        (0, fileutils_1.writeJsonFile)(filePath, content, options);
    }
}
