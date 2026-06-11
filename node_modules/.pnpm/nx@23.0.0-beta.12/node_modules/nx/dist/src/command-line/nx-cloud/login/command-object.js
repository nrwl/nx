"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsLoginCommand = void 0;
const shared_options_1 = require("../../yargs-utils/shared-options");
const handle_import_1 = require("../../../utils/handle-import");
exports.yargsLoginCommand = {
    command: 'login [nxCloudUrl]',
    describe: 'Login to Nx Cloud. This command is an alias for `nx-cloud login`.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs.positional('nxCloudUrl', {
        describe: 'The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to your configured Nx Cloud instance by default.',
        type: 'string',
        required: false,
    }))
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./login.js', __dirname)).loginHandler(args));
    },
};
