"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleImport = handleImport;
const path_1 = require("path");
/**
 * Dynamically imports a module using CJS require().
 * Provides a single point of change for future ESM migration.
 *
 * Falls back to real import() for ESM-only packages that
 * throw ERR_REQUIRE_ESM.
 *
 * @param modulePath - The module specifier (relative, absolute, or package name)
 * @param relativeTo - The directory to resolve relative paths against.
 *   Pass `__dirname` from the call site when using relative paths like './foo.js'.
 */
async function handleImport(modulePath, relativeTo) {
    let resolvedPath = modulePath;
    if (relativeTo &&
        (modulePath.startsWith('./') || modulePath.startsWith('../'))) {
        resolvedPath = (0, path_1.resolve)(relativeTo, modulePath);
    }
    const normalizedPath = (0, path_1.extname)(resolvedPath) === '.js' ? resolvedPath.slice(0, -3) : resolvedPath;
    try {
        return require(normalizedPath);
    }
    catch (e) {
        if (e.code === 'ERR_REQUIRE_ESM') {
            return import(resolvedPath);
        }
        throw e;
    }
}
