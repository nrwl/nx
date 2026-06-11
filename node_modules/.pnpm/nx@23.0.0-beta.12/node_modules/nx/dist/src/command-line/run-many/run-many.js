"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMany = runMany;
exports.projectsToRun = projectsToRun;
const run_command_1 = require("../../tasks-runner/run-command");
const command_line_utils_1 = require("../../utils/command-line-utils");
const project_graph_utils_1 = require("../../utils/project-graph-utils");
const connect_to_nx_cloud_1 = require("../nx-cloud/connect/connect-to-nx-cloud");
const perf_hooks_1 = require("perf_hooks");
const project_graph_1 = require("../../project-graph/project-graph");
const configuration_1 = require("../../config/configuration");
const output_1 = require("../../utils/output");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
const graph_1 = require("../graph/graph");
async function runMany(args, extraTargetDependencies = {}, extraOptions = {
    excludeTaskDependencies: args.excludeTaskDependencies,
    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
}) {
    perf_hooks_1.performance.mark('code-loading:end');
    perf_hooks_1.performance.measure('code-loading', 'init-local', 'code-loading:end');
    const nxJson = (0, configuration_1.readNxJson)();
    const { nxArgs, overrides } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)(args, 'run-many', { printWarnings: args.graph !== 'stdout' }, nxJson);
    if (nxArgs.verbose) {
        process.env.NX_VERBOSE_LOGGING = 'true';
    }
    await (0, connect_to_nx_cloud_1.connectToNxCloudIfExplicitlyAsked)(nxArgs);
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
    const projects = projectsToRun(nxArgs, projectGraph);
    if (nxArgs.graph) {
        const file = (0, command_line_utils_1.readGraphFileFromGraphArg)(nxArgs);
        const projectNames = projects.map((t) => t.name);
        return await (0, graph_1.generateGraph)({
            watch: true,
            open: true,
            view: 'tasks',
            all: nxArgs.all && (!nxArgs.projects || nxArgs.projects.length === 0),
            targets: nxArgs.targets,
            projects: projectNames,
            file,
        }, projectNames);
    }
    else {
        const status = await (0, run_command_1.runCommand)(projects, projectGraph, { nxJson }, nxArgs, overrides, null, extraTargetDependencies, extraOptions);
        process.exit(status);
    }
}
function projectsToRun(nxArgs, projectGraph) {
    const selectedProjects = {};
    const validProjects = runnableForTarget(projectGraph.nodes, nxArgs.targets);
    const invalidProjects = [];
    // --all is default now, if --projects is provided, it'll override the --all
    if (nxArgs.all && nxArgs.projects.length === 0) {
        for (const projectName of validProjects) {
            selectedProjects[projectName] = projectGraph.nodes[projectName];
        }
    }
    else {
        const matchingProjects = (0, find_matching_projects_1.findMatchingProjects)(nxArgs.projects, projectGraph.nodes);
        for (const project of matchingProjects) {
            if (!validProjects.has(project)) {
                invalidProjects.push(project);
            }
            else {
                selectedProjects[project] = projectGraph.nodes[project];
            }
        }
        if (invalidProjects.length > 0) {
            output_1.output.warn({
                title: `The following projects do not have a configuration for any of the provided targets ("${nxArgs.targets.join(', ')}")`,
                bodyLines: invalidProjects.map((name) => `- ${name}`),
            });
        }
    }
    const excludedProjects = (0, find_matching_projects_1.findMatchingProjects)(nxArgs.exclude, selectedProjects);
    for (const excludedProject of excludedProjects) {
        delete selectedProjects[excludedProject];
    }
    return Object.values(selectedProjects);
}
function runnableForTarget(projects, targets) {
    const runnable = new Set();
    for (let projectName in projects) {
        const project = projects[projectName];
        if (targets.find((target) => (0, project_graph_utils_1.projectHasTarget)(project, target))) {
            runnable.add(projectName);
        }
    }
    return runnable;
}
