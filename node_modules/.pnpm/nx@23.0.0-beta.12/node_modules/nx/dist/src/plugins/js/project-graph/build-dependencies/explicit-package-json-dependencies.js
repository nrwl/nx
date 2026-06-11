"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplicitPackageJsonDependencies = buildExplicitPackageJsonDependencies;
const project_graph_1 = require("../../../../config/project-graph");
const file_utils_1 = require("../../../../project-graph/file-utils");
const project_graph_builder_1 = require("../../../../project-graph/project-graph-builder");
const json_1 = require("../../../../utils/json");
function buildExplicitPackageJsonDependencies(ctx, targetProjectLocator) {
    const res = [];
    const roots = {};
    Object.values(ctx.projects).forEach((project) => {
        roots[project.root] = true;
    });
    Object.keys(ctx.filesToProcess.projectFileMap).forEach((source) => {
        Object.values(ctx.filesToProcess.projectFileMap[source]).forEach((f) => {
            if (isPackageJsonAtProjectRoot(roots, f.file)) {
                processPackageJson(source, f.file, ctx, targetProjectLocator, res);
            }
        });
    });
    return res;
}
function isPackageJsonAtProjectRoot(roots, fileName) {
    if (!fileName.endsWith('package.json')) {
        return false;
    }
    const filePath = fileName.slice(0, -13);
    return !!roots[filePath];
}
function processPackageJson(sourceProject, packageJsonPath, ctx, targetProjectLocator, collectedDeps) {
    try {
        const deps = readDeps((0, json_1.parseJson)((0, file_utils_1.defaultFileRead)(packageJsonPath)));
        Object.keys(deps).forEach((packageName) => {
            const packageVersion = deps[packageName];
            const localProject = targetProjectLocator.findDependencyInWorkspaceProjects(packageJsonPath, packageName, packageVersion);
            if (localProject) {
                // package.json refers to another project in the monorepo
                const dependency = {
                    source: sourceProject,
                    target: localProject,
                    sourceFile: packageJsonPath,
                    type: project_graph_1.DependencyType.static,
                };
                (0, project_graph_builder_1.validateDependency)(dependency, ctx);
                collectedDeps.push(dependency);
                return;
            }
            const externalNodeName = targetProjectLocator.findNpmProjectFromImport(packageName, packageJsonPath);
            if (!externalNodeName) {
                return;
            }
            const dependency = {
                source: sourceProject,
                target: externalNodeName,
                sourceFile: packageJsonPath,
                type: project_graph_1.DependencyType.static,
            };
            (0, project_graph_builder_1.validateDependency)(dependency, ctx);
            collectedDeps.push(dependency);
        });
    }
    catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
            console.error(e);
        }
    }
}
function readDeps(packageJson) {
    const deps = {};
    /**
     * We process dependencies in a rough order of increasing importance such that if a dependency is listed in multiple
     * sections, the version listed under the "most important" one wins, with production dependencies being the most important.
     */
    const depType = [
        'optionalDependencies',
        'peerDependencies',
        'devDependencies',
        'dependencies',
    ];
    for (const type of depType) {
        Object.keys(packageJson[type] || {}).forEach((depName) => {
            deps[depName] = packageJson[type][depName];
        });
    }
    return deps;
}
