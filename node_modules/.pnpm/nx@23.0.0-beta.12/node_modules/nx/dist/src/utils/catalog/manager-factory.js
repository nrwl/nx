"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCatalogManager = getCatalogManager;
const package_manager_1 = require("../package-manager");
const pnpm_manager_1 = require("./pnpm-manager");
const yarn_manager_1 = require("./yarn-manager");
/**
 * Factory function to get the appropriate catalog manager based on the package manager
 */
function getCatalogManager(workspaceRoot) {
    const packageManager = (0, package_manager_1.detectPackageManager)(workspaceRoot);
    switch (packageManager) {
        case 'pnpm':
            return new pnpm_manager_1.PnpmCatalogManager();
        case 'yarn':
            return new yarn_manager_1.YarnCatalogManager();
        default:
            return null;
    }
}
