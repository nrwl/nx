"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsFixCiCommand = void 0;
const shared_options_1 = require("../../yargs-utils/shared-options");
const handle_import_1 = require("../../../utils/handle-import");
exports.yargsFixCiCommand = {
    command: 'fix-ci [options]',
    describe: 'Fixes CI failures. This command is an alias for [`nx-cloud fix-ci`](/ci/reference/nx-cloud-cli#npx-nxcloud-fix-ci).',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./fix-ci.js', __dirname)).fixCiHandler(args));
    },
};
