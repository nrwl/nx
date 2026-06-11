"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsRunManyCommand = void 0;
const handle_errors_1 = require("../../utils/handle-errors");
const documentation_1 = require("../yargs-utils/documentation");
const shared_options_1 = require("../yargs-utils/shared-options");
const handle_import_1 = require("../../utils/handle-import");
exports.yargsRunManyCommand = {
    command: 'run-many',
    describe: 'Run target for multiple listed projects.',
    builder: (yargs) => (0, documentation_1.linkToNxDevAndExamples)((0, shared_options_1.withTuiOptions)((0, shared_options_1.withRunManyOptions)((0, shared_options_1.withOutputStyleOption)((0, shared_options_1.withTargetAndConfigurationOption)((0, shared_options_1.withBatch)(yargs))))), 'run-many'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose ?? process.env.NX_VERBOSE_LOGGING === 'true', async () => {
            await (0, handle_import_1.handleImport)('./run-many.js', __dirname).then((m) => m.runMany((0, shared_options_1.withOverrides)(args)));
        });
        process.exit(exitCode);
    },
};
