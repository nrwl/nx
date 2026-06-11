"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nxExecCommand = nxExecCommand;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const path_1 = require("path");
const process_1 = require("process");
const yargs_parser_1 = tslib_1.__importDefault(require("yargs-parser"));
const fs_1 = require("fs");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
const configuration_1 = require("../../config/configuration");
const project_graph_1 = require("../../project-graph/project-graph");
const command_line_utils_1 = require("../../utils/command-line-utils");
const fileutils_1 = require("../../utils/fileutils");
const output_1 = require("../../utils/output");
const package_manager_1 = require("../../utils/package-manager");
const workspace_root_1 = require("../../utils/workspace-root");
const path_2 = require("../../utils/path");
const calculate_default_project_name_1 = require("../../config/calculate-default-project-name");
const get_command_projects_1 = require("../../commands-runner/get-command-projects");
async function nxExecCommand(args) {
    const nxJson = (0, configuration_1.readNxJson)();
    const { nxArgs, overrides } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)(args, 'run-many', { printWarnings: args.graph !== 'stdout' }, nxJson);
    const scriptArgV = readScriptArgV(overrides);
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
    // NX is already running
    if (process.env.NX_TASK_TARGET_PROJECT) {
        const command = scriptArgV
            .reduce((cmd, arg) => cmd + `"${arg}" `, '')
            .trim();
        (0, child_process_1.execSync)(command, {
            stdio: 'inherit',
            env: {
                ...process.env,
                NX_PROJECT_NAME: process.env.NX_TASK_TARGET_PROJECT,
                NX_PROJECT_ROOT_PATH: projectGraph.nodes?.[process.env.NX_TASK_TARGET_PROJECT]?.data?.root,
            },
            windowsHide: true,
        });
    }
    else {
        // nx exec is being ran inside of Nx's context
        return runScriptAsNxTarget(projectGraph, scriptArgV, nxArgs);
    }
}
async function runScriptAsNxTarget(projectGraph, argv, nxArgs) {
    // NPM, Yarn, and PNPM set this to the name of the currently executing script. Lets use it if we can.
    const targetName = process.env.npm_lifecycle_event;
    if (targetName) {
        const defaultPorject = getDefaultProject(projectGraph);
        const scriptDefinition = getScriptDefinition(targetName, defaultPorject);
        if (scriptDefinition) {
            runTargetOnProject(scriptDefinition, targetName, defaultPorject, defaultPorject.name, argv);
            return;
        }
    }
    const projects = getProjects(projectGraph, nxArgs);
    const projectsToRun = (0, get_command_projects_1.getCommandProjects)(projectGraph, projects, nxArgs);
    projectsToRun.forEach((projectName) => {
        const command = argv.reduce((cmd, arg) => cmd + `"${arg}" `, '').trim();
        (0, child_process_1.execSync)(command, {
            stdio: 'inherit',
            env: {
                ...process.env,
                NX_PROJECT_NAME: projectGraph.nodes?.[projectName]?.name,
                NX_PROJECT_ROOT_PATH: projectGraph.nodes?.[projectName]?.data?.root,
            },
            cwd: projectGraph.nodes?.[projectName]?.data?.root
                ? (0, path_2.joinPathFragments)(workspace_root_1.workspaceRoot, projectGraph.nodes?.[projectName]?.data?.root)
                : workspace_root_1.workspaceRoot,
            windowsHide: true,
        });
    });
}
function runTargetOnProject(scriptDefinition, targetName, project, projectName, argv) {
    ensureNxTarget(project, targetName);
    // Get ArgV that is provided in npm script definition
    const providedArgs = (0, yargs_parser_1.default)(scriptDefinition)._.slice(2);
    const extraArgs = providedArgs.length === argv.length ? [] : argv.slice(providedArgs.length);
    const pm = (0, package_manager_1.getPackageManagerCommand)();
    // `targetName` might be an npm script with `:` like: `start:dev`, `start:debug`.
    const command = `${pm.exec} nx run ${projectName}:\\\"${targetName}\\\" ${extraArgs.join(' ')}`;
    (0, child_process_1.execSync)(command, {
        stdio: 'inherit',
        windowsHide: true,
    });
}
function readScriptArgV(overrides) {
    const scriptSeparatorIdx = process.argv.findIndex((el) => el === '--');
    if (scriptSeparatorIdx === -1) {
        output_1.output.error({
            title: '`nx exec` requires passing in a command after `--`',
        });
        process.exit(1);
    }
    return overrides.__overrides_unparsed__;
}
function getScriptDefinition(targetName, project) {
    if (!project) {
        return;
    }
    const packageJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, project.data.root, 'package.json');
    if ((0, fs_1.existsSync)(packageJsonPath)) {
        const scriptDefinition = (0, fileutils_1.readJsonFile)(packageJsonPath).scripts?.[targetName];
        return scriptDefinition;
    }
}
function ensureNxTarget(project, targetName) {
    if (!project.data.targets[targetName]) {
        output_1.output.error({
            title: `Nx cannot find a target called "${targetName}" for ${project.name}`,
            bodyLines: [
                `Is ${targetName} missing from ${project.data.root}/package.json's nx.includedScripts field?`,
            ],
        });
        (0, process_1.exit)(1);
    }
}
function getDefaultProject(projectGraph) {
    const defaultProjectName = (0, calculate_default_project_name_1.calculateDefaultProjectName)(process.cwd(), workspace_root_1.workspaceRoot, (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph), (0, configuration_1.readNxJson)());
    if (defaultProjectName && projectGraph.nodes[defaultProjectName]) {
        return projectGraph.nodes[defaultProjectName];
    }
}
function getProjects(projectGraph, nxArgs) {
    let selectedProjects = {};
    // get projects matched
    if (nxArgs.projects?.length) {
        const matchingProjects = (0, find_matching_projects_1.findMatchingProjects)(nxArgs.projects, projectGraph.nodes);
        for (const project of matchingProjects) {
            selectedProjects[project] = projectGraph.nodes[project];
        }
    }
    else {
        // if no project specified, return all projects
        selectedProjects = { ...projectGraph.nodes };
    }
    const excludedProjects = (0, find_matching_projects_1.findMatchingProjects)(nxArgs.exclude, selectedProjects);
    for (const excludedProject of excludedProjects) {
        delete selectedProjects[excludedProject];
    }
    return Object.values(selectedProjects);
}
