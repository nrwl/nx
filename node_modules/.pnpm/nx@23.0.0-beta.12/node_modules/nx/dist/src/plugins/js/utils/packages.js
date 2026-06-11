"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspacePackagesMetadata = getWorkspacePackagesMetadata;
exports.matchImportToWildcardEntryPointsToProjectMap = matchImportToWildcardEntryPointsToProjectMap;
const posix_1 = require("node:path/posix");
function getWorkspacePackagesMetadata(projects) {
    const entryPointsToProjectMap = {};
    const wildcardEntryPointsToProjectMap = {};
    const packageToProjectMap = {};
    for (const project of Object.values(projects)) {
        const metadata = 'data' in project ? project.data.metadata : project.metadata;
        if (!metadata?.js) {
            continue;
        }
        const { packageName, packageExports, packageMain, isInPackageManagerWorkspaces, } = metadata.js;
        packageToProjectMap[packageName] = project;
        if (!isInPackageManagerWorkspaces) {
            // it is not included in the package manager workspaces config, so we
            // skip it since the exports information wouldn't be used by the Node.js
            // resolution
            continue;
        }
        if (packageExports) {
            if (typeof packageExports === 'string') {
                // it points to a file, which would be the equivalent of an '.' export,
                // in which case the package name is the entry point
                entryPointsToProjectMap[packageName] = project;
            }
            else {
                for (const entryPoint of Object.keys(packageExports)) {
                    if (packageExports[entryPoint] === null) {
                        // if the entry point is restricted, we skip it
                        continue;
                    }
                    if (entryPoint.startsWith('.')) {
                        // it is a relative subpath export
                        if (entryPoint.includes('*')) {
                            wildcardEntryPointsToProjectMap[(0, posix_1.join)(packageName, entryPoint)] =
                                project;
                        }
                        else {
                            entryPointsToProjectMap[(0, posix_1.join)(packageName, entryPoint)] = project;
                        }
                    }
                    else {
                        // it's a conditional export, so we use the package name as the entry point
                        // https://nodejs.org/api/packages.html#conditional-exports
                        entryPointsToProjectMap[packageName] = project;
                    }
                }
            }
        }
        else if (packageMain) {
            // if there is no exports, but there is a main, the package name is the
            // entry point
            entryPointsToProjectMap[packageName] = project;
        }
    }
    return {
        entryPointsToProjectMap,
        wildcardEntryPointsToProjectMap,
        packageToProjectMap,
    };
}
// adapted from PACKAGE_IMPORTS_EXPORTS_RESOLVE at
// https://nodejs.org/docs/latest-v22.x/api/esm.html#resolution-algorithm-specification
function matchImportToWildcardEntryPointsToProjectMap(wildcardEntryPointsToProjectMap, importPath) {
    if (!Object.keys(wildcardEntryPointsToProjectMap).length) {
        return null;
    }
    const entryPoint = Object.keys(wildcardEntryPointsToProjectMap).find((key) => {
        const segments = key.split('*');
        if (segments.length > 2) {
            return false;
        }
        const patternBase = segments[0];
        if (patternBase === importPath) {
            return false;
        }
        if (!importPath.startsWith(patternBase)) {
            return false;
        }
        const patternTrailer = segments[1];
        if (patternTrailer?.length > 0 &&
            (!importPath.endsWith(patternTrailer) || importPath.length < key.length)) {
            return false;
        }
        return true;
    });
    return entryPoint ? wildcardEntryPointsToProjectMap[entryPoint] : null;
}
