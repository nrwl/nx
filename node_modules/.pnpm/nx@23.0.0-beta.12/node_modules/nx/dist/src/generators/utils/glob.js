"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.glob = glob;
exports.globAsync = globAsync;
const minimatch_1 = require("minimatch");
const globs_1 = require("../../utils/globs");
const workspace_context_1 = require("../../utils/workspace-context");
/**
 * Performs a tree-aware glob search on the files in a workspace. Able to find newly
 * created files and hides deleted files before the updates are committed to disk.
 * Paths should be unix-style with forward slashes.
 *
 * @param tree The file system tree
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 * @deprecated Use {@link globAsync} instead.
 */
function glob(tree, patterns) {
    return combineGlobResultsWithTree(tree, patterns, (0, workspace_context_1.globWithWorkspaceContextSync)(tree.root, patterns));
}
/**
 * Performs a tree-aware glob search on the files in a workspace. Able to find newly
 * created files and hides deleted files before the updates are committed to disk.
 * Paths should be unix-style with forward slashes.
 *
 * @param tree The file system tree
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 */
async function globAsync(tree, patterns) {
    return combineGlobResultsWithTree(tree, patterns, await (0, workspace_context_1.globWithWorkspaceContext)(tree.root, patterns));
}
function combineGlobResultsWithTree(tree, patterns, results) {
    const matches = new Set(results);
    const combinedGlob = (0, globs_1.combineGlobPatterns)(patterns);
    const matcher = minimatch_1.minimatch.makeRe(combinedGlob);
    if (!matcher) {
        throw new Error('Invalid glob pattern: ' + combinedGlob);
    }
    for (const change of tree.listChanges()) {
        if (change.type !== 'UPDATE' && matcher.test(change.path)) {
            if (change.type === 'CREATE') {
                matches.add(change.path);
            }
            else if (change.type === 'DELETE') {
                matches.delete(change.path);
            }
        }
    }
    return Array.from(matches);
}
