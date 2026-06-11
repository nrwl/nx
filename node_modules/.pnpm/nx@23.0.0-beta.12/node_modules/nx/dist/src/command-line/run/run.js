"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printRunHelp = printRunHelp;
exports.validateProject = validateProject;
exports.runExecutor = runExecutor;
exports.printTargetRunHelp = printTargetRunHelp;
exports.run = run;
const npm_run_path_1 = require("npm-run-path");
const params_1 = require("../../utils/params");
const handle_errors_1 = require("../../utils/handle-errors");
const handle_import_1 = require("../../utils/handle-import");
const print_help_1 = require("../../utils/print-help");
const path_1 = require("path");
const serialize_overrides_into_command_line_1 = require("../../utils/serialize-overrides-into-command-line");
const project_graph_1 = require("../../project-graph/project-graph");
const configuration_1 = require("../../config/configuration");
const async_iterator_1 = require("../../utils/async-iterator");
const executor_utils_1 = require("./executor-utils");
const pseudo_terminal_1 = require("../../tasks-runner/pseudo-terminal");
const child_process_1 = require("child_process");
function printRunHelp(opts, schema, plugin) {
    (0, print_help_1.printHelp)(`run ${opts.project}:${opts.target}`, schema, {
        mode: 'run',
        ...plugin,
    });
}
function validateProject(projects, projectName) {
    const project = projects.projects[projectName];
    if (!project) {
        throw new Error(`Could not find project "${projectName}"`);
    }
}
function isPromise(v) {
    return typeof v?.then === 'function';
}
async function* promiseToIterator(v) {
    yield await v;
}
async function iteratorToProcessStatusCode(i) {
    const { success } = await (0, async_iterator_1.getLastValueFromAsyncIterableIterator)(i);
    return success ? 0 : 1;
}
async function parseExecutorAndTarget({ project, target }, root, projectsConfigurations) {
    const proj = projectsConfigurations.projects[project];
    const targetConfig = proj.targets?.[target];
    if (!targetConfig) {
        throw new Error(`Cannot find target '${target}' for project '${project}'`);
    }
    const [nodeModule, executor] = (0, executor_utils_1.parseExecutor)(targetConfig.executor);
    const { schema, implementationFactory } = (0, executor_utils_1.getExecutorInformation)(nodeModule, executor, root, projectsConfigurations.projects);
    return { executor, implementationFactory, nodeModule, schema, targetConfig };
}
async function printTargetRunHelpInternal({ project, target }, root, projectsConfigurations) {
    const { executor, nodeModule, schema, targetConfig } = await parseExecutorAndTarget({ project, target }, root, projectsConfigurations);
    printRunHelp({ project, target }, schema, {
        plugin: nodeModule,
        entity: executor,
    });
    if (nodeModule === 'nx' &&
        executor === 'run-commands' &&
        targetConfig.options.command) {
        const command = targetConfig.options.command.split(' ')[0];
        const helpCommand = `${command} --help`;
        const localEnv = (0, npm_run_path_1.env)();
        const env = {
            ...process.env,
            ...localEnv,
        };
        if (pseudo_terminal_1.PseudoTerminal.isSupported()) {
            const terminal = (0, pseudo_terminal_1.createPseudoTerminal)();
            await new Promise(() => {
                const cp = terminal.runCommand(helpCommand, { jsEnv: env });
                cp.onExit((code) => {
                    process.exit(code);
                });
            });
        }
        else {
            const cp = (0, child_process_1.exec)(helpCommand, {
                env,
                windowsHide: true,
            });
            cp.on('exit', (code) => {
                process.exit(code);
            });
        }
    }
    else {
        process.exit(0);
    }
}
async function runExecutorInternal({ project, target, configuration }, overrides, root, cwd, projectsConfigurations, nxJsonConfiguration, projectGraph, taskGraph, isVerbose) {
    validateProject(projectsConfigurations, project);
    const { executor, implementationFactory, nodeModule, schema, targetConfig } = await parseExecutorAndTarget({ project, target, configuration }, root, projectsConfigurations);
    configuration ??= targetConfig.defaultConfiguration;
    const combinedOptions = (0, params_1.combineOptionsForExecutor)(overrides, configuration, targetConfig, schema, project, (0, path_1.relative)(root, cwd), isVerbose);
    if ((0, executor_utils_1.getExecutorInformation)(nodeModule, executor, root, projectsConfigurations.projects).isNxExecutor) {
        const implementation = implementationFactory();
        const r = implementation(combinedOptions, {
            root,
            target: targetConfig,
            projectsConfigurations,
            nxJsonConfiguration,
            projectName: project,
            targetName: target,
            configurationName: configuration,
            projectGraph,
            taskGraph,
            cwd,
            isVerbose,
        });
        if (isPromise(r)) {
            return promiseToIterator(r);
        }
        else if ((0, async_iterator_1.isAsyncIterator)(r)) {
            return r;
        }
        else {
            throw new TypeError(`NX Executor "${targetConfig.executor}" should return either a Promise or an AsyncIterator`);
        }
    }
    else {
        require('../../adapter/compat');
        const observable = await (await (0, handle_import_1.handleImport)('../../adapter/ngcli-adapter.js', __dirname)).scheduleTarget(root, {
            project,
            target,
            configuration,
            runOptions: combinedOptions,
            projects: projectsConfigurations.projects,
        }, isVerbose, projectGraph);
        const { eachValueFrom } = await (0, handle_import_1.handleImport)('../../adapter/rxjs-for-await.js', __dirname);
        return eachValueFrom(observable);
    }
}
/**
 * Loads and invokes executor.
 *
 * This is analogous to invoking executor from the terminal, with the exception
 * that the params aren't parsed from the string, but instead provided parsed already.
 *
 * Apart from that, it works the same way:
 *
 * - it will load the workspace configuration
 * - it will resolve the target
 * - it will load the executor and the schema
 * - it will load the options for the appropriate configuration
 * - it will run the validations and will set the default
 * - and, of course, it will invoke the executor
 *
 * Example:
 *
 * ```typescript
 * for await (const s of await runExecutor({project: 'myproj', target: 'serve'}, {watch: true}, context)) {
 *   // s.success
 * }
 * ```
 *
 * Note that the return value is a promise of an iterator, so you need to await before iterating over it.
 */
async function runExecutor(targetDescription, overrides, context) {
    return await runExecutorInternal(targetDescription, {
        ...overrides,
        __overrides_unparsed__: (0, serialize_overrides_into_command_line_1.serializeOverridesIntoCommandLine)(overrides),
    }, context.root, context.cwd, context.projectsConfigurations, context.nxJsonConfiguration, context.projectGraph, context.taskGraph, context.isVerbose);
}
function printTargetRunHelp(targetDescription, root) {
    const projectGraph = (0, project_graph_1.readCachedProjectGraph)();
    return (0, handle_errors_1.handleErrors)(false, async () => {
        const projectsConfigurations = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
        await printTargetRunHelpInternal(targetDescription, root, projectsConfigurations);
    });
}
function run(cwd, root, targetDescription, overrides, isVerbose, taskGraph) {
    const projectGraph = (0, project_graph_1.readCachedProjectGraph)();
    return (0, handle_errors_1.handleErrors)(isVerbose, async () => {
        const projectsConfigurations = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
        return iteratorToProcessStatusCode(await runExecutorInternal(targetDescription, overrides, root, cwd, projectsConfigurations, (0, configuration_1.readNxJson)(), projectGraph, taskGraph, isVerbose));
    });
}
