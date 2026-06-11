"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackageNameFromImportPath = getPackageNameFromImportPath;
//# Converts import paths to package names.
//# e.g. - `@nx/workspace`        -> `@nx/workspace`
//#      - `@nx/workspace/plugin` -> `@nx/workspace`
//#      - `@nx/workspace/other`  -> `@nx/workspace`
//#      - `nx/plugin`            -> `nx`
function getPackageNameFromImportPath(importExpression) {
    // Check if the package is scoped
    if (importExpression.startsWith('@')) {
        // For scoped packages, the package name is up to the second '/'
        return importExpression.split('/').slice(0, 2).join('/');
    }
    // For unscoped packages, the package name is up to the first '/'
    return importExpression.split('/')[0];
}
