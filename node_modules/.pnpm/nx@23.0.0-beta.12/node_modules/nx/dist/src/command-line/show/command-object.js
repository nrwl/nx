"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsShowCommand = void 0;
const yargs_1 = require("yargs");
const native_1 = require("../../native");
const handle_errors_1 = require("../../utils/handle-errors");
const shared_options_1 = require("../yargs-utils/shared-options");
const handle_import_1 = require("../../utils/handle-import");
exports.yargsShowCommand = {
    command: 'show',
    describe: 'Show information about the workspace (e.g., list of projects).',
    builder: (yargs) => yargs
        .command(showProjectsCommand)
        .command(showProjectCommand)
        .command(showTargetCommand)
        .demandCommand()
        .option('json', {
        type: 'boolean',
        description: 'Output JSON.',
    })
        .middleware((args) => {
        if (args.json == null && (0, native_1.isAiAgent)()) {
            args.json = true;
        }
    })
        .example('$0 show projects', 'Show a list of all projects in the workspace')
        .example('$0 show projects --with-target serve', 'Show a list of all projects in the workspace that have a "serve" target')
        .example('$0 show project [projectName]', 'Shows the resolved configuration for [projectName]')
        .example('$0 show target my-app:build', 'Shows resolved configuration for the build target of my-app')
        .example('$0 show target inputs my-app:build', 'List resolved input files for the build target')
        .example('$0 show target outputs my-app:build', 'List resolved output paths for the build target'),
    handler: async (args) => {
        (0, yargs_1.showHelp)();
        process.exit(1);
    },
};
const showProjectsCommand = {
    command: 'projects',
    describe: 'Show a list of projects in the workspace.',
    builder: (yargs) => (0, shared_options_1.withVerbose)((0, shared_options_1.withAffectedOptions)(yargs))
        .option('affected', {
        type: 'boolean',
        description: 'Show only affected projects.',
    })
        .option('projects', {
        type: 'string',
        alias: ['p'],
        description: 'Show only projects that match a given pattern.',
        coerce: shared_options_1.parseCSV,
    })
        .option('withTarget', {
        type: 'string',
        alias: ['t'],
        description: 'Show only projects that have a specific target.',
        coerce: shared_options_1.parseCSV,
    })
        .option('type', {
        type: 'string',
        description: 'Select only projects of the given type.',
        choices: ['app', 'lib', 'e2e'],
    })
        .option('sep', {
        type: 'string',
        description: 'Outputs projects with the specified seperator.',
    })
        .implies('untracked', 'affected')
        .implies('uncommitted', 'affected')
        .implies('files', 'affected')
        .implies('base', 'affected')
        .implies('head', 'affected')
        .conflicts('sep', 'json')
        .conflicts('json', 'sep')
        .example('$0 show projects --projects "apps/*"', 'Show all projects in the apps directory')
        .example('$0 show projects --projects "shared-*"', 'Show all projects that start with "shared-"')
        .example('$0 show projects --affected', 'Show affected projects in the workspace')
        .example('$0 show projects --type app --affected', 'Show affected apps in the workspace')
        .example('$0 show projects --affected --exclude=*-e2e', 'Show affected projects in the workspace, excluding end-to-end projects'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => {
            const { showProjectsHandler } = await (0, handle_import_1.handleImport)('./projects.js', __dirname);
            await showProjectsHandler(args);
        });
        process.exit(exitCode);
    },
};
const showProjectCommand = {
    command: 'project [projectName]',
    describe: 'Shows resolved project configuration for a given project. If run within a project directory and no project name is provided, the project is inferred from the current working directory.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .positional('projectName', {
        type: 'string',
        alias: 'p',
        description: 'The project to show. If not provided, infers the project from the current working directory.',
    })
        .option('web', {
        type: 'boolean',
        description: 'Show project details in the browser. (default when interactive).',
    })
        .option('open', {
        type: 'boolean',
        description: 'Set to false to prevent the browser from opening when using --web.',
        implies: 'web',
    })
        .check((argv) => {
        // If TTY is enabled, default to web. Otherwise, default to JSON.
        const alreadySpecified = argv.web !== undefined || argv.json !== undefined;
        if (!alreadySpecified) {
            if (process.stdout.isTTY) {
                argv.web = true;
            }
            else {
                argv.json = true;
            }
        }
        return true;
    })
        .example('$0 show project my-app', 'View project information for my-app in JSON format')
        .example('$0 show project my-app --web', 'View project information for my-app in the browser')
        .example('$0 show project', 'View project information for the project in the current working directory'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => {
            const { showProjectHandler } = await (0, handle_import_1.handleImport)('./project.js', __dirname);
            await showProjectHandler(args);
        });
        process.exit(exitCode);
    },
};
const showTargetInfoCommand = {
    command: '$0 [target] [subcommand]',
    describe: 'Shows resolved target configuration for a given project target. Target can be specified as project:target or just target (infers project from cwd).',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .positional('target', {
        type: 'string',
        description: 'The target to inspect, in the format project:target or just target.',
    })
        .positional('subcommand', {
        type: 'string',
        choices: ['inputs', 'outputs'],
        description: 'Invokes `nx show target inputs/outputs for the specified target.',
    })
        .option('configuration', {
        type: 'string',
        alias: 'c',
        description: 'The configuration to inspect.',
    })
        .option('check', {
        type: 'string',
        array: true,
        description: 'Checks whether a set of values are or are not an input/output for the target.',
    })
        .implies('check', 'subcommand')
        .conflicts('check', 'json')
        .example('$0 show target my-app:build', 'Show target configuration for my-app:build')
        .example('$0 show target my-app:build -c production', 'Show target configuration with production configuration applied'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => {
            const { showTargetInfoHandler, showTargetInputsHandler, showTargetOutputsHandler, } = await (0, handle_import_1.handleImport)('./show-target/index.js', __dirname);
            if (args.subcommand === 'inputs') {
                await showTargetInputsHandler(args);
                return;
            }
            else if (args.subcommand === 'outputs') {
                await showTargetOutputsHandler(args);
                return;
            }
            await showTargetInfoHandler(args);
        });
        process.exit(process.exitCode || exitCode);
    },
};
const showTargetInputsCommand = {
    command: 'inputs [target]',
    describe: 'List resolved input files for a target.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .positional('target', {
        type: 'string',
        description: 'The target to inspect, in the format project:target or just target.',
    })
        .option('check', {
        type: 'string',
        array: true,
        requiresArg: true,
        description: 'Check whether a set of values are an input for the target. Accepts a file path, environment variable name, runtime command, or external dependency.',
    })
        .conflicts('check', 'json')
        .example('$0 show target inputs my-app:build', 'List resolved input files for my-app:build')
        .example('$0 show target inputs my-app:build --check src/main.ts', 'Check if src/main.ts is an input for my-app:build'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => {
            const { showTargetInputsHandler } = await (0, handle_import_1.handleImport)('./show-target/index.js', __dirname);
            await showTargetInputsHandler(args);
        });
        process.exit(process.exitCode || exitCode);
    },
};
const showTargetOutputsCommand = {
    command: 'outputs [target]',
    describe: 'List resolved output paths for a target.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .positional('target', {
        type: 'string',
        description: 'The target to inspect, in the format project:target or just target.',
    })
        .option('configuration', {
        type: 'string',
        alias: 'c',
        description: 'The configuration to inspect.',
    })
        .option('check', {
        type: 'string',
        array: true,
        requiresArg: true,
        description: 'Check whether a set of files is an output for the target. Accepts a workspace-relative path.',
    })
        .conflicts('check', 'json')
        .example('$0 show target outputs my-app:build', 'List resolved output paths for my-app:build')
        .example('$0 show target outputs my-app:build --check dist/my-app', 'Check if dist/my-app is an output of my-app:build'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => {
            const { showTargetOutputsHandler } = await (0, handle_import_1.handleImport)('./show-target/index.js', __dirname);
            await showTargetOutputsHandler(args);
        });
        process.exit(process.exitCode || exitCode);
    },
};
const showTargetCommand = {
    command: 'target',
    describe: 'Shows resolved target configuration for a given project target. Use subcommands to inspect inputs or outputs.',
    builder: (yargs) => yargs
        .command(showTargetInputsCommand)
        .command(showTargetOutputsCommand)
        .command(showTargetInfoCommand),
    handler: async () => {
        (0, yargs_1.showHelp)();
        process.exit(1);
    },
};
