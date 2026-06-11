"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsApplyLocallyCommand = void 0;
const shared_options_1 = require("../../yargs-utils/shared-options");
const handle_import_1 = require("../../../utils/handle-import");
exports.yargsApplyLocallyCommand = {
    command: 'apply-locally [options]',
    describe: 'Applies a self-healing CI fix locally. This command is an alias for `nx-cloud apply-locally`.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .help(false)
        .showHelpOnFail(false)
        .option('help', { describe: 'Show help.', type: 'boolean' }),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./apply-locally.js', __dirname)).applyLocallyHandler(args));
    },
};
