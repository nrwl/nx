"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = moveGraphCacheDirectory;
exports.updatePrettierIgnore = updatePrettierIgnore;
exports.updateGitIgnore = updateGitIgnore;
async function moveGraphCacheDirectory(tree) {
    updateGitIgnore(tree);
    updatePrettierIgnore(tree);
}
function updatePrettierIgnore(tree) {
    if (tree.exists('.prettierignore')) {
        const ignored = tree.read('.prettierignore', 'utf-8');
        if (!ignored?.includes('.nx/workspace-data')) {
            tree.write('.prettierignore', [ignored, '/.nx/workspace-data'].join('\n'));
        }
    }
}
function updateGitIgnore(tree) {
    const gitignore = tree.read('.gitignore', 'utf-8');
    if (!gitignore) {
        return;
    }
    const includesNxWorkspaceData = gitignore.includes('.nx/workspace-data');
    if (includesNxWorkspaceData) {
        return;
    }
    const includesNxCache = gitignore.includes('.nx/cache');
    if (!includesNxCache) {
        return;
    }
    const updatedGitignore = gitignore.replace('.nx/cache', ['.nx/cache', '.nx/workspace-data'].join('\n'));
    tree.write('.gitignore', updatedGitignore);
}
