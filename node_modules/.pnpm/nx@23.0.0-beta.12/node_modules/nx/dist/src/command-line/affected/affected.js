"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.affected = affected;
exports.getAffectedGraphNodes = getAffectedGraphNodes;
const file_utils_1 = require("../../project-graph/file-utils");
const run_command_1 = require("../../tasks-runner/run-command");
const output_1 = require("../../utils/output");
const connect_to_nx_cloud_1 = require("../nx-cloud/connect/connect-to-nx-cloud");
const command_line_utils_1 = require("../../utils/command-line-utils");
const perf_hooks_1 = require("perf_hooks");
const project_graph_1 = require("../../project-graph/project-graph");
const project_graph_utils_1 = require("../../utils/project-graph-utils");
const affected_project_graph_1 = require("../../project-graph/affected/affected-project-graph");
const configuration_1 = require("../../config/configuration");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
const graph_1 = require("../graph/graph");
async function affected(command, args, extraTargetDependencies = {}, extraOptions = {
    excludeTaskDependencies: args.excludeTaskDependencies,
    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
}) {
    perf_hooks_1.performance.mark('code-loading:end');
    perf_hooks_1.performance.measure('code-loading', 'init-local', 'code-loading:end');
    const nxJson = (0, configuration_1.readNxJson)();
    const { nxArgs, overrides } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)(args, 'affected', {
        printWarnings: command !== 'print-affected' && !args.plain && args.graph !== 'stdout',
    }, nxJson);
    await (0, connect_to_nx_cloud_1.connectToNxCloudIfExplicitlyAsked)(nxArgs);
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({
        exitOnError: true,
    });
    const projects = await getAffectedGraphNodes(nxArgs, projectGraph);
    try {
        switch (command) {
            case 'affected': {
                const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
                if (nxArgs.graph) {
                    const projectNames = projectsWithTarget.map((t) => t.name);
                    const file = (0, command_line_utils_1.readGraphFileFromGraphArg)(nxArgs);
                    return await (0, graph_1.generateGraph)({
                        watch: true,
                        open: true,
                        view: 'tasks',
                        targets: nxArgs.targets,
                        all: nxArgs.all &&
                            (!nxArgs.projects || nxArgs.projects.length === 0),
                        projects: projectNames,
                        file,
                    }, projectNames);
                }
                else {
                    const status = await (0, run_command_1.runCommand)(projectsWithTarget, projectGraph, { nxJson }, nxArgs, overrides, null, extraTargetDependencies, extraOptions);
                    process.exit(status);
                }
                break;
            }
        }
        await output_1.output.drain();
    }
    catch (e) {
        printError(e, args.verbose);
        process.exit(1);
    }
}
async function getAffectedGraphNodes(nxArgs, projectGraph) {
    let affectedGraph = nxArgs.all
        ? projectGraph
        : await (0, affected_project_graph_1.filterAffected)(projectGraph, (0, file_utils_1.calculateFileChanges)((0, command_line_utils_1.parseFiles)(nxArgs).files, nxArgs));
    if (nxArgs.exclude) {
        const excludedProjects = new Set((0, find_matching_projects_1.findMatchingProjects)(nxArgs.exclude, affectedGraph.nodes));
        return Object.entries(affectedGraph.nodes)
            .filter(([projectName]) => !excludedProjects.has(projectName))
            .map(([, project]) => project);
    }
    return Object.values(affectedGraph.nodes);
}
function allProjectsWithTarget(projects, nxArgs) {
    return projects.filter((p) => nxArgs.targets.find((target) => (0, project_graph_utils_1.projectHasTarget)(p, target)));
}
function printError(e, verbose) {
    const bodyLines = [e.message];
    if (verbose && e.stack) {
        bodyLines.push('');
        bodyLines.push(e.stack);
    }
    output_1.output.error({
        title: 'There was a critical error when running your command',
        bodyLines,
    });
}
