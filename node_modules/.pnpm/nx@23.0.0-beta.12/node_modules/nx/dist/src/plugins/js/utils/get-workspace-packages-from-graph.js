"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspacePackagesFromGraph = getWorkspacePackagesFromGraph;
function getWorkspacePackagesFromGraph(graph) {
    const workspacePackages = new Map();
    for (const [projectName, project] of Object.entries(graph.nodes)) {
        const pkgName = project.data?.metadata?.js?.packageName;
        if (pkgName) {
            workspacePackages.set(pkgName, project);
        }
    }
    return workspacePackages;
}
