"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformProjectGraphForRust = transformProjectGraphForRust;
function transformProjectGraphForRust(graph) {
    const dependencies = {};
    const nodes = {};
    const externalNodes = {};
    for (const [projectName, projectNode] of Object.entries(graph.nodes)) {
        const targets = {};
        for (const [targetName, targetConfig] of Object.entries(projectNode.data.targets ?? {})) {
            targets[targetName] = {
                executor: targetConfig.executor,
                inputs: targetConfig.inputs,
                outputs: targetConfig.outputs,
                options: JSON.stringify(targetConfig.options),
                configurations: JSON.stringify(targetConfig.configurations),
                parallelism: targetConfig.parallelism,
            };
        }
        nodes[projectName] = {
            root: projectNode.data.root,
            namedInputs: projectNode.data.namedInputs,
            targets,
            tags: projectNode.data.tags,
        };
        if (graph.dependencies[projectName]) {
            dependencies[projectName] = [];
            for (const dep of graph.dependencies[projectName]) {
                dependencies[projectName].push(dep.target);
            }
        }
    }
    for (const [projectName, externalNode] of Object.entries(graph.externalNodes ?? {})) {
        externalNodes[projectName] = {
            packageName: externalNode.data.packageName,
            hash: externalNode.data.hash,
            version: externalNode.data.version,
        };
        if (graph.dependencies[projectName]) {
            dependencies[projectName] = [];
            for (const dep of graph.dependencies[projectName]) {
                dependencies[projectName].push(dep.target);
            }
        }
    }
    return {
        nodes,
        externalNodes,
        dependencies,
    };
}
