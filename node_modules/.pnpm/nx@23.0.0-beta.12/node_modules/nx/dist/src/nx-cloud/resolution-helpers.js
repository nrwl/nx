"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAncestorNodeModules = findAncestorNodeModules;
const fs_1 = require("fs");
const path_1 = require("path");
function findAncestorNodeModules(startPath, collector) {
    let currentPath = (0, path_1.isAbsolute)(startPath) ? startPath : (0, path_1.resolve)(startPath);
    while (currentPath !== (0, path_1.dirname)(currentPath)) {
        const potentialNodeModules = (0, path_1.join)(currentPath, 'node_modules');
        if ((0, fs_1.existsSync)(potentialNodeModules)) {
            collector.push(potentialNodeModules);
        }
        if ((0, fs_1.existsSync)((0, path_1.join)(currentPath, 'nx.json'))) {
            break;
        }
        currentPath = (0, path_1.dirname)(currentPath);
    }
    return collector;
}
