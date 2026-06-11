"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = moveCacheDirectory;
const ignore = require("ignore");
function moveCacheDirectory(tree) {
    // If nx.json doesn't exist the repo can't utilize
    // caching, so .nx/cache is less relevant. Lerna users
    // that don't want to fully opt in to Nx at this time
    // may also be caught off guard by the appearance of
    // a .nx directory, so we are going to special case
    // this for the time being.
    if (tree.exists('lerna.json') && !tree.exists('nx.json')) {
        return;
    }
    updateGitIgnore(tree);
    if (tree.exists('.prettierignore')) {
        const ignored = tree.read('.prettierignore', 'utf-8');
        if (!ignored.includes('.nx/cache')) {
            tree.write('.prettierignore', [ignored, '/.nx/cache'].join('\n'));
        }
    }
}
function updateGitIgnore(tree) {
    const gitignore = tree.exists('.gitignore')
        ? tree.read('.gitignore', 'utf-8')
        : '';
    const ig = ignore();
    ig.add(gitignore);
    if (!ig.ignores('.nx/cache')) {
        const updatedLines = gitignore.length
            ? [gitignore, '.nx/cache']
            : ['.nx/cache'];
        tree.write('.gitignore', updatedLines.join('\n'));
    }
}
