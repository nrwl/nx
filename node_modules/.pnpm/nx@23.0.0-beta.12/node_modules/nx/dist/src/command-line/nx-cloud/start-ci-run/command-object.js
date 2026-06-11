"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsStartCiRunCommand = void 0;
const handle_import_1 = require("../../../utils/handle-import");
const shared_options_1 = require("../../yargs-utils/shared-options");
exports.yargsStartCiRunCommand = {
    command: 'start-ci-run [options]',
    describe: 'Starts a new CI run for distributed task execution. This command is an alias for [`nx-cloud start-ci-run`](/docs/reference/nx-cloud-cli#npx-nxcloud-start-ci-run).',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./start-ci-run.js', __dirname)).startCiRunHandler(args));
    },
};
