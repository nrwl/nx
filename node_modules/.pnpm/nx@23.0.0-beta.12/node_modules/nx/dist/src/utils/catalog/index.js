"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCatalogManager = void 0;
exports.getCatalogDependenciesFromPackageJson = getCatalogDependenciesFromPackageJson;
const json_1 = require("../../generators/utils/json");
const manager_factory_1 = require("./manager-factory");
Object.defineProperty(exports, "getCatalogManager", { enumerable: true, get: function () { return manager_factory_1.getCatalogManager; } });
/**
 * Detects which packages in a package.json use catalog references
 * Returns Map of package name -> catalog name (undefined for default catalog)
 */
function getCatalogDependenciesFromPackageJson(tree, packageJsonPath, manager) {
    const catalogDeps = new Map();
    if (!tree.exists(packageJsonPath)) {
        return catalogDeps;
    }
    try {
        const packageJson = (0, json_1.readJson)(tree, packageJsonPath);
        const allDependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
            ...packageJson.optionalDependencies,
        };
        for (const [packageName, version] of Object.entries(allDependencies || {})) {
            if (manager.isCatalogReference(version)) {
                const catalogRef = manager.parseCatalogReference(version);
                if (catalogRef) {
                    catalogDeps.set(packageName, catalogRef.catalogName);
                }
            }
        }
    }
    catch (error) {
        // If we can't read the package.json, return empty map
    }
    return catalogDeps;
}
