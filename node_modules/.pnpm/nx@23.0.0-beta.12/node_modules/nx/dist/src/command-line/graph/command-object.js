"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsGraphCommand = void 0;
exports.withGraphOptions = withGraphOptions;
const documentation_1 = require("../yargs-utils/documentation");
const shared_options_1 = require("../yargs-utils/shared-options");
const handle_import_1 = require("../../utils/handle-import");
exports.yargsGraphCommand = {
    command: 'graph',
    describe: 'Graph dependencies within workspace.',
    aliases: ['dep-graph'],
    builder: (yargs) => (0, documentation_1.linkToNxDevAndExamples)((0, shared_options_1.withVerbose)((0, shared_options_1.withAffectedOptions)(withGraphOptions(yargs))), 'dep-graph')
        .option('affected', {
        type: 'boolean',
        description: 'Highlight affected projects.',
    })
        .implies('untracked', 'affected')
        .implies('uncommitted', 'affected')
        .implies('files', 'affected')
        .implies('base', 'affected')
        .implies('head', 'affected'),
    handler: async (args) => await (await (0, handle_import_1.handleImport)('./graph.js', __dirname)).generateGraph(args, []),
};
function withGraphOptions(yargs) {
    return yargs
        .option('file', {
        describe: 'Output file (e.g. --file=output.json or --file=dep-graph.html).',
        type: 'string',
    })
        .option('print', {
        describe: 'Print the project graph to stdout in the terminal.',
        type: 'boolean',
    })
        .option('view', {
        describe: 'Choose whether to view the projects or task graph.',
        type: 'string',
        default: 'projects',
        choices: ['projects', 'tasks'],
    })
        .option('targets', {
        describe: 'The target to show tasks for in the task graph.',
        type: 'string',
        coerce: shared_options_1.parseCSV,
    })
        .option('focus', {
        describe: 'Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.',
        type: 'string',
    })
        .option('exclude', {
        describe: 'List of projects delimited by commas to exclude from the project graph.',
        type: 'string',
        coerce: shared_options_1.parseCSV,
    })
        .option('groupByFolder', {
        describe: 'Group projects by folder in the project graph.',
        type: 'boolean',
    })
        .option('host', {
        describe: 'Bind the project graph server to a specific ip address.',
        type: 'string',
    })
        .option('port', {
        describe: 'Bind the project graph server to a specific port.',
        type: 'number',
    })
        .option('watch', {
        describe: 'Watch for changes to project graph and update in-browser.',
        type: 'boolean',
        default: true,
    })
        .option('open', {
        describe: 'Open the project graph in the browser.',
        type: 'boolean',
        default: true,
    });
}
