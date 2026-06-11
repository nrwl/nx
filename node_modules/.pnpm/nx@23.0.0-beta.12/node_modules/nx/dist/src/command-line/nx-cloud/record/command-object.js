"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsRecordCommand = void 0;
const handle_import_1 = require("../../../utils/handle-import");
const shared_options_1 = require("../../yargs-utils/shared-options");
exports.yargsRecordCommand = {
    command: 'record [options]',
    describe: 'Records a command execution for distributed task execution. This command is an alias for [`nx-cloud record`](/ci/reference/nx-cloud-cli#npx-nxcloud-record).',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .parserConfiguration({
        'populate--': true,
    })
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./record.js', __dirname)).recordHandler(args));
    },
};
