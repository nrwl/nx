"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pruneProjectGraph = pruneProjectGraph;
exports.findNodeMatchingVersion = findNodeMatchingVersion;
exports.addNodesAndDependencies = addNodesAndDependencies;
exports.rehoistNodes = rehoistNodes;
const semver_1 = require("semver");
const operators_1 = require("../../../project-graph/operators");
const project_graph_builder_1 = require("../../../project-graph/project-graph-builder");
const catalog_1 = require("../../../utils/catalog");
const workspace_root_1 = require("../../../utils/workspace-root");
const get_workspace_packages_from_graph_1 = require("../utils/get-workspace-packages-from-graph");
/**
 * Prune project graph's external nodes and their dependencies
 * based on the pruned package.json
 */
function pruneProjectGraph(graph, prunedPackageJson, workspaceRootPath = workspace_root_1.workspaceRoot) {
    const builder = new project_graph_builder_1.ProjectGraphBuilder();
    const workspacePackages = (0, get_workspace_packages_from_graph_1.getWorkspacePackagesFromGraph)(graph);
    const combinedDependencies = normalizeDependencies(prunedPackageJson, graph, workspacePackages, workspaceRootPath);
    addNodesAndDependencies(graph, combinedDependencies, workspacePackages, builder);
    for (const project of workspacePackages.values()) {
        const node = graph.nodes[project.name];
        builder.addNode(node);
    }
    // for NPM (as well as the graph consistency)
    // we need to distinguish between hoisted and non-hoisted dependencies
    rehoistNodes(graph, combinedDependencies, builder);
    return builder.getUpdatedProjectGraph();
}
// ensure that dependency ranges from package.json (e.g. ^1.0.0)
// are replaced with the actual version based on the available nodes (e.g. 1.0.1)
function normalizeDependencies(packageJson, graph, workspacePackages, workspaceRootPath) {
    const { dependencies, devDependencies, optionalDependencies, peerDependencies, } = packageJson;
    const combinedDependencies = {
        ...dependencies,
        ...devDependencies,
        ...optionalDependencies,
        ...peerDependencies,
    };
    Object.entries(combinedDependencies).forEach(([packageName, versionRange]) => {
        let resolvedVersionRange = versionRange;
        const manager = (0, catalog_1.getCatalogManager)(workspaceRootPath);
        if (manager?.isCatalogReference(versionRange)) {
            resolvedVersionRange = manager.resolveCatalogReference(workspaceRootPath, packageName, versionRange);
            if (!resolvedVersionRange) {
                throw new Error(`Could not resolve catalog reference for ${packageName}@${versionRange}.`);
            }
        }
        if (graph.externalNodes[`npm:${packageName}@${resolvedVersionRange}`]) {
            combinedDependencies[packageName] = resolvedVersionRange;
            return;
        }
        if (graph.externalNodes[`npm:${packageName}`] &&
            graph.externalNodes[`npm:${packageName}`].data.version ===
                resolvedVersionRange) {
            combinedDependencies[packageName] = resolvedVersionRange;
            return;
        }
        // otherwise we need to find the correct version
        const node = findNodeMatchingVersion(graph, packageName, resolvedVersionRange);
        if (node) {
            combinedDependencies[packageName] = node.data.version;
        }
        else if (workspacePackages.has(packageName)) {
            // workspace module, leave as is
            combinedDependencies[packageName] = resolvedVersionRange;
        }
        else {
            throw new Error(`Pruned lock file creation failed. The following package was not found in the root lock file: ${packageName}@${resolvedVersionRange}`);
        }
    });
    return combinedDependencies;
}
function findNodeMatchingVersion(graph, packageName, versionExpr) {
    if (versionExpr === '*') {
        return graph.externalNodes[`npm:${packageName}`];
    }
    const nodes = Object.values(graph.externalNodes)
        .filter((n) => n.data.packageName === packageName)
        .sort((a, b) => ((0, semver_1.gte)(b.data.version, a.data.version) ? 1 : -1));
    if (versionExpr === 'latest') {
        return nodes.sort((a, b) => +(0, semver_1.gte)(b.data.version, a.data.version))[0];
    }
    if (graph.externalNodes[`npm:${packageName}`] &&
        (0, semver_1.satisfies)(graph.externalNodes[`npm:${packageName}`].data.version, versionExpr)) {
        return graph.externalNodes[`npm:${packageName}`];
    }
    return nodes.find((n) => (0, semver_1.satisfies)(n.data.version, versionExpr));
}
function addNodesAndDependencies(graph, packageJsonDeps, workspacePackages, builder) {
    Object.entries(packageJsonDeps).forEach(([name, version]) => {
        const node = graph.externalNodes[`npm:${name}@${version}`] ||
            graph.externalNodes[`npm:${name}`];
        if (node) {
            traverseNode(graph, builder, node);
        }
        else if (workspacePackages.has(name)) {
            // Workspace Node
            const workspaceNode = workspacePackages.get(name);
            if (workspaceNode) {
                traverseWorkspaceNode(graph, builder, workspaceNode);
            }
        }
    });
}
function traverseNode(graph, builder, node) {
    if (builder.graph.externalNodes[node.name]) {
        return;
    }
    builder.addExternalNode(node);
    graph.dependencies[node.name]?.forEach((dep) => {
        const depNode = graph.externalNodes[dep.target];
        traverseNode(graph, builder, depNode);
        builder.addStaticDependency(node.name, dep.target);
    });
}
function traverseWorkspaceNode(graph, builder, node, visited = new Set()) {
    if (visited.has(node.name))
        return;
    visited.add(node.name);
    graph.dependencies[node.name]?.forEach((dep) => {
        const externalDepNode = graph.externalNodes[dep.target];
        if (externalDepNode) {
            traverseNode(graph, builder, externalDepNode);
            return;
        }
        const workspaceDepNode = graph.nodes[dep.target];
        if (workspaceDepNode) {
            traverseWorkspaceNode(graph, builder, workspaceDepNode, visited);
        }
    });
}
function rehoistNodes(graph, packageJsonDeps, builder) {
    const packagesToRehoist = new Map();
    // find all packages that need to be rehoisted
    Object.values(graph.externalNodes).forEach((node) => {
        if (node.name === `npm:${node.data.packageName}` &&
            !builder.graph.externalNodes[node.name]) {
            const nestedNodes = Object.values(builder.graph.externalNodes).filter((n) => n.data.packageName === node.data.packageName);
            if (nestedNodes.length > 0) {
                packagesToRehoist.set(node.data.packageName, nestedNodes);
            }
        }
    });
    if (!packagesToRehoist.size) {
        return;
    }
    // invert dependencies for easier traversal back
    const invertedGraph = (0, operators_1.reverse)(builder.graph);
    const invBuilder = new project_graph_builder_1.ProjectGraphBuilder(invertedGraph, {});
    // find new hoisted version
    packagesToRehoist.forEach((nestedNodes) => {
        if (nestedNodes.length === 1) {
            switchNodeToHoisted(nestedNodes[0], builder, invBuilder);
        }
        else {
            let minDistance = Infinity;
            let closest;
            nestedNodes.forEach((node) => {
                const distance = pathLengthToIncoming(node, packageJsonDeps, builder, invertedGraph);
                if (distance < minDistance) {
                    minDistance = distance;
                    closest = node;
                }
            });
            if (closest) {
                switchNodeToHoisted(closest, builder, invBuilder);
            }
        }
    });
}
function switchNodeToHoisted(node, builder, invBuilder) {
    // make a copy of current name, all the dependencies and dependents
    const previousName = node.name;
    const targets = (builder.graph.dependencies[node.name] || []).map((d) => d.target);
    const sources = Object.keys(builder.graph.dependencies).filter((name) => builder.graph.dependencies[name].some((d) => d.target === previousName));
    builder.removeNode(node.name);
    invBuilder.removeNode(node.name);
    // modify the node and re-add it
    node.name = `npm:${node.data.packageName}`;
    builder.addExternalNode(node);
    invBuilder.addExternalNode(node);
    targets.forEach((target) => {
        builder.addStaticDependency(node.name, target);
        invBuilder.addStaticDependency(target, node.name);
    });
    sources.forEach((source) => {
        builder.addStaticDependency(source, node.name);
        invBuilder.addStaticDependency(node.name, source);
    });
}
// BFS to find the shortest path to a dependency specified in package.json
// package version with the shortest path is the one that should be hoisted
function pathLengthToIncoming(node, packageJsonDeps, builder, invertedGraph) {
    const visited = new Set([node.name]);
    const queue = [[node, 0]];
    while (queue.length > 0) {
        const [current, distance] = queue.shift();
        if (packageJsonDeps[current.data.packageName] === current.data.version) {
            return distance;
        }
        for (let { target } of invertedGraph.dependencies[current.name] || []) {
            if (!visited.has(target)) {
                visited.add(target);
                queue.push([builder.graph.externalNodes[target], distance + 1]);
            }
        }
    }
}
