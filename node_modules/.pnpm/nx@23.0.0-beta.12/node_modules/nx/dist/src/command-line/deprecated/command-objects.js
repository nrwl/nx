"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsPrintAffectedCommand = exports.yargsAffectedGraphCommand = void 0;
const handle_errors_1 = require("../../utils/handle-errors");
const shared_options_1 = require("../yargs-utils/shared-options");
const command_object_1 = require("../graph/command-object");
const affectedGraphDeprecationMessage = 'Use `nx graph --affected`, or `nx affected --graph` instead depending on which best suits your use case. The `affected:graph` command has been removed in Nx 19.';
const printAffectedDeprecationMessage = 'Use `nx show projects --affected`, `nx affected --graph -t build` or `nx graph --affected` depending on which best suits your use case. The `print-affected` command has been removed in Nx 19.';
/**
 * @deprecated 'Use `nx graph --affected`, or` nx affected --graph` instead depending on which best suits your use case. The `affected:graph` command will be removed in Nx 19.'
 */
exports.yargsAffectedGraphCommand = {
    command: 'affected:graph',
    describe: false,
    aliases: ['affected:dep-graph'],
    builder: (yargs) => (0, shared_options_1.withAffectedOptions)((0, command_object_1.withGraphOptions)(yargs)),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(false, () => {
            throw new Error(affectedGraphDeprecationMessage);
        });
        process.exit(exitCode);
    },
    deprecated: affectedGraphDeprecationMessage,
};
/**
 * @deprecated 'Use `nx show --affected`, `nx affected --graph` or `nx graph --affected` depending on which best suits your use case. The `print-affected` command will be removed in Nx 19.'
 */
exports.yargsPrintAffectedCommand = {
    command: 'print-affected',
    describe: false,
    builder: (yargs) => (0, shared_options_1.withAffectedOptions)((0, shared_options_1.withTargetAndConfigurationOption)(yargs, false))
        .option('select', {
        type: 'string',
        describe: 'Select the subset of the returned json document (e.g., --select=projects).',
    })
        .option('type', {
        type: 'string',
        choices: ['app', 'lib'],
        describe: 'Select the type of projects to be returned (e.g., --type=app).',
    }),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(false, () => {
            throw new Error(printAffectedDeprecationMessage);
        });
        process.exit(exitCode);
    },
    deprecated: printAffectedDeprecationMessage,
};
