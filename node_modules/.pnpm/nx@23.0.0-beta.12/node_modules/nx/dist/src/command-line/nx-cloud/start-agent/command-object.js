"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsStartAgentCommand = void 0;
const handle_import_1 = require("../../../utils/handle-import");
const shared_options_1 = require("../../yargs-utils/shared-options");
exports.yargsStartAgentCommand = {
    command: 'start-agent [options]',
    describe: 'Starts a new agent for distributed task execution. This command is an alias for [`nx-cloud start-agent`](/docs/reference/nx-cloud-cli).',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./start-agent.js', __dirname)).startAgentHandler(args));
    },
};
