"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = addClaudeWorktreesToGitIgnore;
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const ignore_1 = require("../../utils/ignore");
async function addClaudeWorktreesToGitIgnore(tree) {
    if (!tree.exists('.gitignore')) {
        return;
    }
    // Lerna users that don't use nx.json may not expect .claude directory changes
    if (tree.exists('lerna.json') && !tree.exists('nx.json')) {
        return;
    }
    (0, ignore_1.addEntryToGitIgnore)(tree, '.gitignore', '.claude/worktrees');
    await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree);
}
