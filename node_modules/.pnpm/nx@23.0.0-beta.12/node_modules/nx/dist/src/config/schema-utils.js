"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImplementationFactory = getImplementationFactory;
exports.resolveImplementation = resolveImplementation;
exports.resolveSchema = resolveSchema;
const fs_1 = require("fs");
const path_1 = require("path");
const resolve_exports_1 = require("resolve.exports");
const packages_1 = require("../plugins/js/utils/packages");
const plugins_1 = require("../project-graph/plugins");
const path_2 = require("../utils/path");
/**
 * This function is used to get the implementation factory of an executor or generator.
 * @param implementation path to the implementation
 * @param directory path to the directory
 * @returns a function that returns the implementation
 */
function getImplementationFactory(implementation, directory, packageName, projects) {
    const [implementationModulePath, implementationExportName] = implementation.split('#');
    return () => {
        const modulePath = resolveImplementation(implementationModulePath, directory, packageName, projects);
        if ((0, path_1.extname)(modulePath) === '.ts') {
            (0, plugins_1.registerPluginTSTranspiler)();
        }
        const module = require(modulePath);
        return implementationExportName
            ? module[implementationExportName]
            : (module.default ?? module);
    };
}
/**
 * This function is used to resolve the implementation of an executor or generator.
 * @param implementationModulePath
 * @param directory
 * @returns path to the implementation
 */
function resolveImplementation(implementationModulePath, directory, packageName, projects) {
    const validImplementations = ['', '.js', '.ts'].map((x) => implementationModulePath + x);
    if (!directory.includes('node_modules')) {
        // It might be a local plugin where the implementation path points to the
        // outputs which might not exist or can be stale. We prioritize finding
        // the implementation from the source over the outputs.
        for (const maybeImplementation of validImplementations) {
            const maybeImplementationFromSource = tryResolveFromSource(maybeImplementation, directory, packageName, projects);
            if (maybeImplementationFromSource) {
                return maybeImplementationFromSource;
            }
        }
    }
    for (const maybeImplementation of validImplementations) {
        const maybeImplementationPath = (0, path_1.join)(directory, maybeImplementation);
        if ((0, fs_1.existsSync)(maybeImplementationPath)) {
            return maybeImplementationPath;
        }
        try {
            return require.resolve(maybeImplementation, {
                paths: [directory],
            });
        }
        catch { }
    }
    throw new Error(`Could not resolve "${implementationModulePath}" from "${directory}".`);
}
function resolveSchema(schemaPath, directory, packageName, projects) {
    if (!directory.includes('node_modules')) {
        // It might be a local plugin where the schema path points to the outputs
        // which might not exist or can be stale. We prioritize finding the schema
        // from the source over the outputs.
        const schemaPathFromSource = tryResolveFromSource(schemaPath, directory, packageName, projects);
        if (schemaPathFromSource) {
            return schemaPathFromSource;
        }
    }
    const maybeSchemaPath = (0, path_1.join)(directory, schemaPath);
    if ((0, fs_1.existsSync)(maybeSchemaPath)) {
        return maybeSchemaPath;
    }
    return require.resolve(schemaPath, {
        paths: [directory],
    });
}
let packageToProjectMap;
function tryResolveFromSource(path, directory, packageName, projects) {
    packageToProjectMap ??=
        (0, packages_1.getWorkspacePackagesMetadata)(projects).packageToProjectMap;
    const localProject = packageToProjectMap[packageName];
    if (!localProject) {
        // it doesn't match any of the package names from the local projects
        return null;
    }
    try {
        const fromExports = (0, resolve_exports_1.resolve)({
            name: localProject.metadata.js.packageName,
            exports: localProject.metadata.js.packageExports,
        }, path, { conditions: ['development'] });
        if (fromExports && fromExports.length) {
            for (const exportPath of fromExports) {
                if ((0, fs_1.existsSync)((0, path_1.join)(directory, exportPath))) {
                    return (0, path_1.join)(directory, exportPath);
                }
            }
        }
    }
    catch { }
    /**
     * Fall back to try to "guess" the source by checking the path in some common directories:
     * - the root of the project
     * - the src directory
     * - the src/lib directory
     */
    const segments = (0, path_2.normalizePath)(path).replace(/^\.\//, '').split('/');
    for (let i = 1; i < segments.length; i++) {
        const possiblePaths = [
            (0, path_1.join)(directory, ...segments.slice(i)),
            (0, path_1.join)(directory, 'src', ...segments.slice(i)),
            (0, path_1.join)(directory, 'src', 'lib', ...segments.slice(i)),
        ];
        for (const possiblePath of possiblePaths) {
            if ((0, fs_1.existsSync)(possiblePath)) {
                return possiblePath;
            }
        }
    }
    return null;
}
