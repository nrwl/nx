"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toProjectName = toProjectName;
const path_1 = require("path");
/**
 * Pulled from toFileName in names from @nx/devkit.
 * Todo: Should refactor, not duplicate.
 */
function toProjectName(fileName) {
    const parts = (0, path_1.dirname)(fileName).split(/[\/\\]/g);
    return parts[parts.length - 1].toLowerCase();
}
