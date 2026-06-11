"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOne = runOne;
exports.parseRunOneOptions = parseRunOneOptions;
const calculate_default_project_name_1 = require("../../config/calculate-default-project-name");
const configuration_1 = require("../../config/configuration");
const handle_import_1 = require("../../utils/handle-import");
const project_graph_1 = require("../../project-graph/project-graph");
const run_command_1 = require("../../tasks-runner/run-command");
const command_line_utils_1 = require("../../utils/command-line-utils");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
const output_1 = require("../../utils/output");
const split_target_1 = require("../../utils/split-target");
const workspace_root_1 = require("../../utils/workspace-root");
const graph_1 = require("../graph/graph");
const connect_to_nx_cloud_1 = require("../nx-cloud/connect/connect-to-nx-cloud");
async function runOne(cwd, args, extraTargetDependencies = {}, extraOptions = {
    excludeTaskDependencies: args.excludeTaskDependencies,
    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
}) {
    performance.mark('code-loading:end');
    performance.measure('code-loading', 'init-local', 'code-loading:end');
    const nxJson = (0, configuration_1.readNxJson)();
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)();
    const opts = parseRunOneOptions(cwd, args, projectGraph, nxJson);
    const { nxArgs, overrides } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)({
        ...opts.parsedArgs,
        configuration: opts.configuration,
        targets: [opts.target],
    }, 'run-one', { printWarnings: args.graph !== 'stdout' }, nxJson);
    const { projects, projectName } = getProjects(projectGraph, opts.project);
    if (nxArgs.help) {
        await (await (0, handle_import_1.handleImport)('./run.js', __dirname)).printTargetRunHelp({
            ...opts,
            project: projectName,
        }, workspace_root_1.workspaceRoot);
        process.exit(0);
    }
    await (0, connect_to_nx_cloud_1.connectToNxCloudIfExplicitlyAsked)(nxArgs);
    if (nxArgs.graph) {
        const projectNames = projects.map((t) => t.name);
        const file = (0, command_line_utils_1.readGraphFileFromGraphArg)(nxArgs);
        return await (0, graph_1.generateGraph)({
            watch: true,
            open: true,
            view: 'tasks',
            targets: nxArgs.targets,
            projects: projectNames,
            file,
        }, projectNames);
    }
    else {
        const status = await (0, run_command_1.runCommand)(projects, projectGraph, { nxJson }, nxArgs, overrides, projectName, extraTargetDependencies, extraOptions);
        process.exit(status);
    }
}
function getProjects(projectGraph, projectName) {
    if (projectGraph.nodes[projectName]) {
        return {
            projectName: projectName,
            projects: [projectGraph.nodes[projectName]],
            projectsMap: {
                [projectName]: projectGraph.nodes[projectName],
            },
        };
    }
    else {
        const projects = (0, find_matching_projects_1.findMatchingProjects)([projectName], projectGraph.nodes);
        if (projects.length === 1) {
            const projectName = projects[0];
            const project = projectGraph.nodes[projectName];
            return {
                projectName,
                projects: [project],
                projectsMap: {
                    [project.data.name]: project,
                },
            };
        }
        else if (projects.length > 1) {
            output_1.output.error({
                title: `Multiple projects matched:`,
                bodyLines: projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
            });
            process.exit(1);
        }
    }
    output_1.output.error({
        title: `Cannot find project '${projectName}'`,
    });
    process.exit(1);
}
const targetAliases = {
    b: 'build',
    e: 'e2e',
    l: 'lint',
    s: 'serve',
    t: 'test',
};
const PROJECT_TARGET_CONFIG = 'project:target:configuration';
function parseRunOneOptions(cwd, parsedArgs, projectGraph, nxJson) {
    const defaultProjectName = (0, calculate_default_project_name_1.calculateDefaultProjectName)(cwd, workspace_root_1.workspaceRoot, (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph), nxJson);
    let project;
    let target;
    let configuration;
    if (typeof parsedArgs[PROJECT_TARGET_CONFIG] === 'string' &&
        parsedArgs[PROJECT_TARGET_CONFIG].lastIndexOf(':') > 0) {
        // run case
        [project, target, configuration] = (0, split_target_1.splitTarget)(parsedArgs[PROJECT_TARGET_CONFIG], projectGraph, { currentProject: defaultProjectName });
        // this is to account for "nx npmscript:dev"
        if (project && !target && defaultProjectName) {
            target = project;
            project = defaultProjectName;
        }
    }
    else if (parsedArgs.target) {
        target = parsedArgs.target;
    }
    else if (typeof parsedArgs[PROJECT_TARGET_CONFIG] === 'string') {
        // If project:target:configuration exists but has no colon, check if it's a project with run target
        if (projectGraph.nodes[parsedArgs[PROJECT_TARGET_CONFIG]]?.data?.targets?.run) {
            target = 'run';
            project = parsedArgs[PROJECT_TARGET_CONFIG];
        }
        else {
            target = parsedArgs[PROJECT_TARGET_CONFIG];
        }
    }
    if (parsedArgs.project) {
        project = parsedArgs.project;
    }
    if (!project && defaultProjectName) {
        project = defaultProjectName;
    }
    if (!project || !target) {
        throw new Error(`Both project and target have to be specified`);
    }
    if (targetAliases[target]) {
        target = targetAliases[target];
    }
    if (parsedArgs.configuration) {
        configuration = parsedArgs.configuration;
    }
    else if (parsedArgs.prod) {
        configuration = 'production';
    }
    const res = { project, target, configuration, parsedArgs };
    delete parsedArgs['c'];
    delete parsedArgs[PROJECT_TARGET_CONFIG];
    delete parsedArgs['configuration'];
    delete parsedArgs['prod'];
    delete parsedArgs['project'];
    return res;
}
