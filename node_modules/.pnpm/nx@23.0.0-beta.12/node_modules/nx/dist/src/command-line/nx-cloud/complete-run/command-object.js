"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsStopAllAgentsCommand = void 0;
const handle_import_1 = require("../../../utils/handle-import");
const shared_options_1 = require("../../yargs-utils/shared-options");
exports.yargsStopAllAgentsCommand = {
    command: 'stop-all-agents [options]',
    aliases: ['complete-ci-run'],
    describe: 'Terminates all dedicated agents associated with this CI pipeline execution. This command is an alias for [`nx-cloud stop-all-agents`](/docs/reference/nx-cloud-cli#nx-cloud-stop-all-agents).',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./stop-all-agents.js', __dirname)).stopAllAgentsHandler(args));
    },
};
