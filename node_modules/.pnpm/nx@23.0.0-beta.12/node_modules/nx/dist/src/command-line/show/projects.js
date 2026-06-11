"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showProjectsHandler = showProjectsHandler;
const output_1 = require("../../utils/output");
const nx_json_1 = require("../../config/nx-json");
const affected_project_graph_1 = require("../../project-graph/affected/affected-project-graph");
const file_utils_1 = require("../../project-graph/file-utils");
const operators_1 = require("../../project-graph/operators");
const project_graph_1 = require("../../project-graph/project-graph");
const command_line_utils_1 = require("../../utils/command-line-utils");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
async function showProjectsHandler(args) {
    performance.mark('code-loading:end');
    performance.measure('code-loading', 'init-local', 'code-loading:end');
    let graph = await (0, project_graph_1.createProjectGraphAsync)();
    const nxJson = (0, nx_json_1.readNxJson)();
    const { nxArgs } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)(args, 'affected', {
        printWarnings: false,
    }, nxJson);
    // Affected touches dependencies so it needs to be processed first.
    if (args.affected) {
        const touchedFiles = await getTouchedFiles(nxArgs);
        graph = await getAffectedGraph(touchedFiles, nxJson, graph);
    }
    const filter = (0, operators_1.filterNodes)((node) => {
        if (args.type && node.type !== args.type) {
            return false;
        }
        return true;
    });
    graph = filter(graph);
    // Apply projects filter and get resultant graph
    if (args.projects) {
        graph.nodes = getGraphNodesMatchingPatterns(graph, args.projects);
    }
    // Grab only the nodes with the specified target
    if (args.withTarget) {
        graph.nodes = Object.entries(graph.nodes).reduce((acc, [name, node]) => {
            if (args.withTarget.some((target) => node.data.targets?.[target])) {
                acc[name] = node;
            }
            return acc;
        }, {});
    }
    const selectedProjects = new Set(Object.keys(graph.nodes));
    if (args.exclude) {
        const excludedProjects = (0, find_matching_projects_1.findMatchingProjects)(nxArgs.exclude, graph.nodes);
        for (const excludedProject of excludedProjects) {
            selectedProjects.delete(excludedProject);
        }
    }
    if (args.json) {
        console.log(JSON.stringify(Array.from(selectedProjects)));
    }
    else if (args.sep) {
        console.log(Array.from(selectedProjects.values()).join(args.sep));
    }
    else {
        for (const project of selectedProjects) {
            console.log(project);
        }
    }
    // TODO: Find a better fix for this
    await new Promise((res) => setImmediate(res));
    await output_1.output.drain();
}
function getGraphNodesMatchingPatterns(graph, patterns) {
    const nodes = {};
    const matches = (0, find_matching_projects_1.findMatchingProjects)(patterns, graph.nodes);
    for (const match of matches) {
        nodes[match] = graph.nodes[match];
    }
    return nodes;
}
function getAffectedGraph(touchedFiles, nxJson, graph) {
    return (0, affected_project_graph_1.filterAffected)(graph, touchedFiles, nxJson);
}
async function getTouchedFiles(nxArgs) {
    return (0, file_utils_1.calculateFileChanges)((0, command_line_utils_1.parseFiles)(nxArgs).files, nxArgs);
}
