"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplicitDependencies = buildExplicitDependencies;
const explicit_package_json_dependencies_1 = require("./explicit-package-json-dependencies");
const explicit_project_dependencies_1 = require("./explicit-project-dependencies");
const target_project_locator_1 = require("./target-project-locator");
function buildExplicitDependencies(jsPluginConfig, ctx) {
    if (totalNumberOfFilesToProcess(ctx) === 0)
        return [];
    let dependencies = [];
    // TODO: TargetProjectLocator is a public API, so we can't change the shape of it
    // We should eventually let it accept Record<string, ProjectConfiguration> s.t. we
    // don't have to reshape the CreateDependenciesContext here.
    const nodes = {};
    Object.keys(ctx.projects).forEach((key) => {
        nodes[key] = {
            name: key,
            type: null,
            data: ctx.projects[key],
        };
    });
    const targetProjectLocator = new target_project_locator_1.TargetProjectLocator(nodes, ctx.externalNodes);
    if (jsPluginConfig.analyzeSourceFiles === undefined ||
        jsPluginConfig.analyzeSourceFiles === true) {
        let tsExists = false;
        try {
            require.resolve('typescript');
            tsExists = true;
        }
        catch { }
        if (tsExists) {
            dependencies = dependencies.concat((0, explicit_project_dependencies_1.buildExplicitTypeScriptDependencies)(ctx, targetProjectLocator));
        }
    }
    if (jsPluginConfig.analyzePackageJson === undefined ||
        jsPluginConfig.analyzePackageJson === true) {
        dependencies = dependencies.concat((0, explicit_package_json_dependencies_1.buildExplicitPackageJsonDependencies)(ctx, targetProjectLocator));
    }
    return dependencies;
}
function totalNumberOfFilesToProcess(ctx) {
    let totalNumOfFilesToProcess = 0;
    Object.values(ctx.filesToProcess.projectFileMap).forEach((t) => (totalNumOfFilesToProcess += t.length));
    return totalNumOfFilesToProcess;
}
