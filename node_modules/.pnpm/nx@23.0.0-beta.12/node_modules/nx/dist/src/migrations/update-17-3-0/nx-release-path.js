"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = nxReleasePath;
exports.visitNotIgnoredFiles = visitNotIgnoredFiles;
const node_path_1 = require("node:path");
const ignore_1 = require("../../utils/ignore");
function nxReleasePath(tree) {
    visitNotIgnoredFiles(tree, '', (file) => {
        const contents = tree.read(file).toString('utf-8');
        if (
        // the deep import usage should be replaced by the new location
        contents.includes('nx/src/command-line/release') ||
            // changelog-renderer has moved into nx/release
            contents.includes('nx/changelog-renderer')) {
            const finalContents = contents
                // replace instances of old changelog renderer location
                .replace(/nx\/changelog-renderer/g, 'nx/release/changelog-renderer')
                // replace instances of deep import for programmatic API (only perform the replacement if an actual import by checking for trailing ' or ")
                .replace(/nx\/src\/command-line\/release(['"])/g, 'nx/release$1');
            tree.write(file, finalContents);
        }
    });
}
// Adapted from devkit
function visitNotIgnoredFiles(tree, dirPath = tree.root, visitor) {
    const ig = (0, ignore_1.getIgnoreObject)();
    dirPath = normalizePathRelativeToRoot(dirPath, tree.root);
    if (dirPath !== '' && ig?.ignores(dirPath)) {
        return;
    }
    for (const child of tree.children(dirPath)) {
        const fullPath = (0, node_path_1.join)(dirPath, child);
        if (ig?.ignores(fullPath)) {
            continue;
        }
        if (tree.isFile(fullPath)) {
            visitor(fullPath);
        }
        else {
            visitNotIgnoredFiles(tree, fullPath, visitor);
        }
    }
}
// Copied from devkit
function normalizePathRelativeToRoot(path, root) {
    return (0, node_path_1.relative)(root, (0, node_path_1.join)(root, path)).split(node_path_1.sep).join('/');
}
