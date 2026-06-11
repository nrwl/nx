"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsNxInfixCommand = exports.yargsRunCommand = void 0;
const yargs_1 = require("yargs");
const handle_errors_1 = require("../../utils/handle-errors");
const handle_import_1 = require("../../utils/handle-import");
const shared_options_1 = require("../yargs-utils/shared-options");
exports.yargsRunCommand = {
    command: 'run [project][:target][:configuration] [_..]',
    describe: `Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.`,
    builder: (yargs) => (0, shared_options_1.withTuiOptions)((0, shared_options_1.withRunOneOptions)((0, shared_options_1.withBatch)(yargs))),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose ?? process.env.NX_VERBOSE_LOGGING === 'true', async () => {
            await (0, handle_import_1.handleImport)('./run-one.js', __dirname).then((m) => m.runOne(process.cwd(), (0, shared_options_1.withOverrides)(args)));
        });
        process.exit(exitCode);
    },
};
/**
 * Handles the infix notation for running a target.
 */
exports.yargsNxInfixCommand = {
    ...exports.yargsRunCommand,
    command: '$0 <target> [project] [_..]',
    describe: 'Run a target for a project.',
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose ?? process.env.NX_VERBOSE_LOGGING === 'true', async () => {
            // Yargs parses <target> as 'undefined' if running just 'nx'
            if (!args.target || args.target === 'undefined') {
                (0, yargs_1.showHelp)();
                process.exit(1);
            }
            return (await (0, handle_import_1.handleImport)('./run-one.js', __dirname)).runOne(process.cwd(), (0, shared_options_1.withOverrides)(args, 0));
        });
        process.exit(exitCode);
    },
};
