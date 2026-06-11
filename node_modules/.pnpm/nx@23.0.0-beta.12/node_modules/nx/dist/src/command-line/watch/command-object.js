"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsWatchCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
const documentation_1 = require("../yargs-utils/documentation");
const shared_options_1 = require("../yargs-utils/shared-options");
exports.yargsWatchCommand = {
    command: 'watch',
    describe: 'Watch for changes within projects, and execute commands.',
    builder: (yargs) => (0, documentation_1.linkToNxDevAndExamples)(withWatchOptions(yargs), 'watch'),
    handler: async (args) => {
        await (0, handle_import_1.handleImport)('./watch.js', __dirname).then((m) => m.watch(args));
    },
};
function withWatchOptions(yargs) {
    return (0, shared_options_1.withVerbose)(yargs)
        .parserConfiguration({
        'strip-dashed': true,
        'populate--': true,
    })
        .option('projects', {
        type: 'string',
        alias: 'p',
        coerce: shared_options_1.parseCSV,
        description: 'Projects to watch (comma/space delimited).',
    })
        .option('all', {
        type: 'boolean',
        description: 'Watch all projects.',
    })
        .option('includeDependentProjects', {
        type: 'boolean',
        description: 'When watching selected projects, include dependent projects as well.',
        alias: 'd',
    })
        .option('includeGlobalWorkspaceFiles', {
        type: 'boolean',
        description: 'Include global workspace files that are not part of a project. For example, the root eslint, or tsconfig file.',
        alias: 'g',
        hidden: true,
    })
        .option('command', { type: 'string', hidden: true })
        .option('verbose', {
        type: 'boolean',
        description: 'Run watch mode in verbose mode, where commands are logged before execution.',
    })
        .option('initialRun', {
        type: 'boolean',
        description: 'Run the command once before watching for changes.',
        alias: 'i',
        default: false,
    })
        .conflicts({
        all: 'projects',
    })
        .check((args) => {
        if (!args.all && !args.projects) {
            throw Error('Please specify either --all or --projects');
        }
        return true;
    })
        .middleware((args) => {
        const { '--': doubledash } = args;
        if (doubledash && Array.isArray(doubledash)) {
            args.command = doubledash.join(' ');
        }
        else {
            throw Error('No command specified for watch mode.');
        }
    }, true);
}
