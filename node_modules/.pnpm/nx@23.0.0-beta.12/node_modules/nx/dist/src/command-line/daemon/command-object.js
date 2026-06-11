"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsDaemonCommand = void 0;
const documentation_1 = require("../yargs-utils/documentation");
const handle_errors_1 = require("../../utils/handle-errors");
const handle_import_1 = require("../../utils/handle-import");
const shared_options_1 = require("../yargs-utils/shared-options");
const arguments_of_1 = require("../yargs-utils/arguments-of");
const builder = (yargs) => (0, documentation_1.linkToNxDevAndExamples)((0, shared_options_1.withVerbose)(withDaemonOptions(yargs)), 'daemon');
exports.yargsDaemonCommand = (0, arguments_of_1.makeCommandModule)({
    command: 'daemon',
    describe: 'Prints information about the Nx Daemon process or starts a daemon process.',
    builder,
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => (await (0, handle_import_1.handleImport)('./daemon.js', __dirname)).daemonHandler(args));
        process.exit(exitCode);
    },
});
function withDaemonOptions(yargs) {
    return yargs
        .option('start', {
        type: 'boolean',
        default: false,
    })
        .option('stop', {
        type: 'boolean',
        default: false,
    });
}
