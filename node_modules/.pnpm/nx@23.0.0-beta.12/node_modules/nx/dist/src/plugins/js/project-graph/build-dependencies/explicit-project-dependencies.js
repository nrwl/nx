"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplicitTypeScriptDependencies = buildExplicitTypeScriptDependencies;
const path_1 = require("path");
const project_graph_1 = require("../../../../config/project-graph");
const project_graph_builder_1 = require("../../../../project-graph/project-graph-builder");
const path_2 = require("../../../../utils/path");
const workspace_root_1 = require("../../../../utils/workspace-root");
function isRoot(projects, projectName) {
    return projects[projectName]?.root === '.';
}
function convertImportToDependency(importExpr, sourceFile, source, type, targetProjectLocator) {
    const target = targetProjectLocator.findProjectFromImport(importExpr, sourceFile);
    if (!target) {
        return;
    }
    return {
        source,
        target,
        sourceFile,
        type,
    };
}
function buildExplicitTypeScriptDependencies(ctx, targetProjectLocator) {
    const res = [];
    const filesToProcess = {};
    const moduleExtensions = [
        '.ts',
        '.js',
        '.tsx',
        '.jsx',
        '.mts',
        '.mjs',
        '.cjs',
        '.cts',
        '.vue',
    ];
    for (const [project, fileData] of Object.entries(ctx.filesToProcess.projectFileMap)) {
        filesToProcess[project] ??= [];
        for (const { file } of fileData) {
            if (moduleExtensions.some((ext) => file.endsWith(ext))) {
                filesToProcess[project].push((0, path_1.join)(workspace_root_1.workspaceRoot, file));
            }
        }
    }
    const { findImports } = require('../../../../native');
    const imports = findImports(filesToProcess);
    for (const { sourceProject, file, staticImportExpressions, dynamicImportExpressions, } of imports) {
        const normalizedFilePath = (0, path_2.normalizePath)((0, path_1.relative)(workspace_root_1.workspaceRoot, file));
        for (const importExpr of staticImportExpressions) {
            const dependency = convertImportToDependency(importExpr, normalizedFilePath, sourceProject, project_graph_1.DependencyType.static, targetProjectLocator);
            if (!dependency) {
                continue;
            }
            // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
            if (isRoot(ctx.projects, dependency.source) ||
                !isRoot(ctx.projects, dependency.target)) {
                res.push(dependency);
            }
        }
        for (const importExpr of dynamicImportExpressions) {
            const dependency = convertImportToDependency(importExpr, normalizedFilePath, sourceProject, project_graph_1.DependencyType.dynamic, targetProjectLocator);
            if (!dependency) {
                continue;
            }
            // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
            if (isRoot(ctx.projects, dependency.source) ||
                !isRoot(ctx.projects, dependency.target)) {
                (0, project_graph_builder_1.validateDependency)(dependency, ctx);
                res.push(dependency);
            }
        }
    }
    return res;
}
