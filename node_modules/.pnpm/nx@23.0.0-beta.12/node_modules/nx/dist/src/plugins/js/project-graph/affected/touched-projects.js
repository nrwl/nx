"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTouchedProjects = void 0;
const lock_file_changes_1 = require("./lock-file-changes");
const npm_packages_1 = require("./npm-packages");
const tsconfig_json_changes_1 = require("./tsconfig-json-changes");
const getTouchedProjects = (touchedFiles, nodes, nxJson, packageJson, graph) => {
    const touchedProjects = new Set();
    [
        lock_file_changes_1.getTouchedProjectsFromLockFile,
        npm_packages_1.getTouchedNpmPackages,
        tsconfig_json_changes_1.getTouchedProjectsFromTsConfig,
    ].forEach((fn) => {
        fn(touchedFiles, nodes, nxJson, packageJson, graph).forEach((p) => touchedProjects.add(p));
    });
    return Array.from(touchedProjects);
};
exports.getTouchedProjects = getTouchedProjects;
