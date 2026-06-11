"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = addPolygraphToGitIgnore;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const ignore_1 = require("../../utils/ignore");
async function addPolygraphToGitIgnore(tree) {
    if (!tree.exists('.gitignore')) {
        return;
    }
    // Lerna users that don't use nx.json may not expect .nx directory changes
    if (tree.exists('lerna.json') && !tree.exists('nx.json')) {
        return;
    }
    (0, ignore_1.addEntryToGitIgnore)(tree, '.gitignore', '.nx/polygraph');
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
