"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIgnoreObject = getIgnoreObject;
exports.getIgnoreObjectForTree = getIgnoreObjectForTree;
exports.addEntryToGitIgnore = addEntryToGitIgnore;
const ignore = require("ignore");
const fileutils_1 = require("./fileutils");
const workspace_root_1 = require("./workspace-root");
function getIgnoreObject(root = workspace_root_1.workspaceRoot) {
    const ig = ignore();
    ig.add((0, fileutils_1.readFileIfExisting)(`${root}/.gitignore`));
    ig.add((0, fileutils_1.readFileIfExisting)(`${root}/.nxignore`));
    return ig;
}
function getIgnoreObjectForTree(tree) {
    let ig;
    if (tree.exists('.gitignore')) {
        ig = ignore();
        ig.add('.git');
        ig.add(tree.read('.gitignore', 'utf-8'));
    }
    if (tree.exists('.nxignore')) {
        ig ??= ignore();
        ig.add(tree.read('.nxignore', 'utf-8'));
    }
    return ig;
}
/**
 * Adds an entry to a .gitignore file if it's not already covered by existing patterns.
 * Creates the file if it doesn't exist.
 */
function addEntryToGitIgnore(tree, gitignorePath, entry) {
    const gitignore = tree.exists(gitignorePath)
        ? tree.read(gitignorePath, 'utf-8')
        : '';
    const ig = ignore();
    ig.add(gitignore);
    if (!ig.ignores(entry)) {
        const updatedLines = gitignore.length ? [gitignore, entry] : [entry];
        tree.write(gitignorePath, updatedLines.join('\n'));
    }
}
