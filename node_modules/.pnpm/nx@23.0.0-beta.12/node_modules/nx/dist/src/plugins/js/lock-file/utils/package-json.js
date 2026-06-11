"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHoistedPackageVersion = getHoistedPackageVersion;
exports.normalizePackageJson = normalizePackageJson;
const workspace_root_1 = require("../../../../utils/workspace-root");
const fileutils_1 = require("../../../../utils/fileutils");
/**
 * Get version of hoisted package if available
 */
function getHoistedPackageVersion(packageName) {
    const fullPath = `${workspace_root_1.workspaceRoot}/node_modules/${packageName}/package.json`;
    try {
        return (0, fileutils_1.readJsonFile)(fullPath)?.version;
    }
    catch (e) {
        return;
    }
}
/**
 * Strip off non-pruning related fields from package.json
 */
function normalizePackageJson(packageJson) {
    const { name, version, license, dependencies, devDependencies, peerDependencies, peerDependenciesMeta, optionalDependencies, packageManager, resolutions, overrides, pnpm, } = packageJson;
    return {
        name,
        version,
        license,
        dependencies,
        devDependencies,
        peerDependencies,
        peerDependenciesMeta,
        optionalDependencies,
        packageManager,
        resolutions,
        overrides,
        pnpm,
    };
}
