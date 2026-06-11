"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTouchedNpmPackages = void 0;
const file_utils_1 = require("../../../../project-graph/file-utils");
const json_diff_1 = require("../../../../utils/json-diff");
const logger_1 = require("../../../../utils/logger");
const get_package_name_from_import_path_1 = require("../../../../utils/get-package-name-from-import-path");
const getTouchedNpmPackages = (touchedFiles, _, nxJson, packageJson, projectGraph) => {
    const packageJsonChange = touchedFiles.find((f) => f.file === 'package.json');
    if (!packageJsonChange)
        return [];
    const globalPackages = new Set(getGlobalPackages(nxJson.plugins));
    let touched = [];
    const changes = packageJsonChange.getChanges();
    const npmPackages = Object.values(projectGraph.externalNodes);
    const missingTouchedNpmPackages = [];
    for (const c of changes) {
        if ((0, json_diff_1.isJsonChange)(c) &&
            (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') &&
            c.path.length === 2) {
            // A package was deleted so mark all workspace projects as touched.
            if (c.type === json_diff_1.JsonDiffType.Deleted) {
                touched = Object.keys(projectGraph.nodes);
                break;
            }
            else {
                let npmPackage = npmPackages.find((pkg) => pkg.data.packageName === c.path[1]);
                if (!npmPackage) {
                    // dependency can also point to a workspace project
                    const nodes = Object.values(projectGraph.nodes);
                    npmPackage = nodes.find((n) => n.name === c.path[1]);
                }
                if (!npmPackage) {
                    missingTouchedNpmPackages.push(c.path[1]);
                    continue;
                }
                touched.push(npmPackage.name);
                // If it was a type declarations package then also mark its corresponding implementation package as affected
                if (npmPackage.name.startsWith('npm:@types/')) {
                    const implementationNpmPackage = npmPackages.find((pkg) => pkg.data.packageName === c.path[1].substring(7));
                    if (implementationNpmPackage) {
                        touched.push(implementationNpmPackage.name);
                    }
                }
                if ('packageName' in npmPackage.data) {
                    if (globalPackages.has(npmPackage.data.packageName)) {
                        return Object.keys(projectGraph.nodes);
                    }
                }
            }
        }
        else if ((0, json_diff_1.isJsonChange)(c) &&
            (c.path[0] === 'overrides' ||
                c.path[0] === 'resolutions' ||
                (c.path[0] === 'pnpm' && c.path[1] === 'overrides'))) {
            // Changes to overrides, resolutions, or pnpm.overrides
            // Find which package was changed and mark projects that depend on it as affected
            const packageName = c.path[0] === 'pnpm' ? c.path[2] : c.path[1];
            if (packageName) {
                // Look for the npm package in external nodes
                let npmPackage = npmPackages.find((pkg) => pkg.data.packageName === packageName);
                if (npmPackage) {
                    touched.push(npmPackage.name);
                    // If it's a global package, all projects are affected
                    if ('packageName' in npmPackage.data &&
                        globalPackages.has(npmPackage.data.packageName)) {
                        return Object.keys(projectGraph.nodes);
                    }
                }
                else {
                    // If the package isn't found in external nodes, it might affect all projects
                    // since overrides can affect transitive dependencies
                    return Object.keys(projectGraph.nodes);
                }
            }
        }
        else if ((0, file_utils_1.isWholeFileChange)(c)) {
            // Whole file was touched, so all npm packages are touched.
            touched = npmPackages.map((pkg) => pkg.name);
            break;
        }
    }
    if (missingTouchedNpmPackages.length) {
        logger_1.logger.warn(`The affected projects might have not been identified properly. The package(s) ${missingTouchedNpmPackages.join(', ')} were not found. Please open an issue in GitHub including the package.json file.`);
    }
    return touched;
};
exports.getTouchedNpmPackages = getTouchedNpmPackages;
function getGlobalPackages(plugins) {
    return (plugins ?? [])
        .map((p) => (0, get_package_name_from_import_path_1.getPackageNameFromImportPath)(typeof p === 'string' ? p : p.plugin))
        .concat('nx');
}
