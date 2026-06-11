"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showProjectHandler = showProjectHandler;
const output_1 = require("../../utils/output");
const project_graph_1 = require("../../project-graph/project-graph");
const graph_1 = require("../graph/graph");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
const workspace_root_1 = require("../../utils/workspace-root");
const configuration_1 = require("../../config/configuration");
const calculate_default_project_name_1 = require("../../config/calculate-default-project-name");
async function showProjectHandler(args) {
    performance.mark('code-loading:end');
    performance.measure('code-loading', 'init-local', 'code-loading:end');
    const graph = await (0, project_graph_1.createProjectGraphAsync)();
    let projectName = args.projectName;
    // If no project name is provided, try to infer from cwd
    if (!projectName) {
        const nxJson = (0, configuration_1.readNxJson)();
        projectName = (0, calculate_default_project_name_1.calculateDefaultProjectName)(process.cwd(), workspace_root_1.workspaceRoot, (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(graph), nxJson);
        if (!projectName) {
            output_1.output.error({
                title: 'Could not find a project in the current working directory.',
                bodyLines: [
                    `Please specify a project name using:`,
                    `  nx show project <project-name>`,
                    ``,
                    `Or run this command from within a project directory.`,
                ],
            });
            process.exit(1);
        }
    }
    let node = graph.nodes[projectName];
    if (!node) {
        const projects = (0, find_matching_projects_1.findMatchingProjects)([projectName], graph.nodes);
        if (projects.length === 1) {
            const matchedProjectName = projects[0];
            node = graph.nodes[matchedProjectName];
        }
        else if (projects.length > 1) {
            output_1.output.error({
                title: `Multiple projects matched:`,
                bodyLines: projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
            });
            console.log(`Multiple projects matched:\n  ${(projects.length > 100
                ? [...projects.slice(0, 100), '...']
                : projects).join('  \n')}`);
            process.exit(1);
        }
        else {
            console.log(`Could not find project ${projectName}`);
            process.exit(1);
        }
    }
    if (args.json) {
        console.log(JSON.stringify(node.data));
    }
    else if (args.web) {
        await (0, graph_1.generateGraph)({
            view: 'project-details',
            focus: node.name,
            watch: true,
            open: args.open ?? true,
        }, []);
    }
    else {
        const pc = require('picocolors');
        const logIfExists = (label, key) => {
            if (node.data[key]) {
                console.log(`${pc.bold(label)}: ${node.data[key]}`);
            }
        };
        logIfExists('Name', 'name');
        logIfExists('Root', 'root');
        logIfExists('Source Root', 'sourceRoot');
        logIfExists('Tags', 'tags');
        logIfExists('Implicit Dependencies', 'implicitDependencies');
        const targets = Object.entries(node.data.targets ?? {});
        const maxTargetNameLength = Math.max(...targets.map(([t]) => t.length));
        const maxExecutorNameLength = Math.max(...targets.map(([, t]) => t?.executor?.length ?? 0));
        if (targets.length > 0) {
            console.log(`${pc.bold('Targets')}: `);
            for (const [target, targetConfig] of targets) {
                const executorCommandText = targetConfig.metadata?.scriptContent ??
                    targetConfig?.options?.command ??
                    (targetConfig?.options?.commands?.length === 1
                        ? targetConfig.options.commands[0]
                        : targetConfig?.executor) ??
                    '';
                console.log(`- ${pc.bold((target + ':').padEnd(maxTargetNameLength + 2))} ${executorCommandText.padEnd(maxExecutorNameLength + 2)} ${(() => {
                    const configurations = Object.keys(targetConfig.configurations ?? {});
                    if (configurations.length) {
                        return pc.dim(configurations.join(', '));
                    }
                    return '';
                })()}`);
            }
        }
    }
    // TODO: Find a better fix for this
    await new Promise((res) => setImmediate(res));
    await output_1.output.drain();
}
