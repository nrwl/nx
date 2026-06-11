"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collapseExpandedOutputs = collapseExpandedOutputs;
const path_1 = require("path");
/**
 * Heuristic to prevent writing too many hash files
 */
const MAX_OUTPUTS_TO_CHECK_HASHES = 3;
/**
 * Collapses a list of file paths into a smaller set of parent directories
 * when there are too many outputs to efficiently track individually.
 *
 * This prevents creating too many hash files by:
 * 1. Building a tree structure of all path components
 * 2. Finding the "collapse level" - the deepest level before exceeding MAX_OUTPUTS_TO_CHECK_HASHES
 * 3. Returning parent paths at/above collapse level, while preserving leaf paths that terminate early
 */
function collapseExpandedOutputs(expandedOutputs) {
    // Small output sets don't need collapsing
    if (expandedOutputs.length <= MAX_OUTPUTS_TO_CHECK_HASHES) {
        return [...expandedOutputs];
    }
    const tree = [];
    // Create a Tree of directories/files
    for (const output of expandedOutputs) {
        const pathParts = [];
        pathParts.unshift(output);
        let dir = (0, path_1.dirname)(output);
        while (dir !== (0, path_1.dirname)(dir)) {
            pathParts.unshift(dir);
            dir = (0, path_1.dirname)(dir);
        }
        for (let i = 0; i < pathParts.length; i++) {
            tree[i] ??= new Set();
            tree[i].add(pathParts[i]);
        }
    }
    // Find collapse level: the level before the first level with too many outputs
    let collapseLevel = tree.length - 1;
    for (let j = 0; j < tree.length; j++) {
        if (tree[j].size > MAX_OUTPUTS_TO_CHECK_HASHES) {
            collapseLevel = Math.max(0, j - 1);
            break;
        }
    }
    // Collect paths, preserving leaf paths that terminate before collapse level
    const result = new Set();
    // Convert sets to arrays once for faster iteration
    const levelArrays = [];
    for (let i = 0; i <= collapseLevel + 1 && i < tree.length; i++) {
        levelArrays[i] = Array.from(tree[i]);
    }
    for (let level = 0; level <= collapseLevel; level++) {
        const nextLevelArray = levelArrays[level + 1];
        for (const path of levelArrays[level]) {
            let hasChildren = false;
            if (nextLevelArray) {
                for (const child of nextLevelArray) {
                    if (child.startsWith(path + '/')) {
                        hasChildren = true;
                        break;
                    }
                }
            }
            // Include path if it's at collapse level or doesn't have children (leaf)
            if (level === collapseLevel || !hasChildren) {
                result.add(path);
            }
        }
    }
    return Array.from(result);
}
