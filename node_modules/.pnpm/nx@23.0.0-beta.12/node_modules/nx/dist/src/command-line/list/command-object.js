"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsListCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
exports.yargsListCommand = {
    command: 'list [plugin]',
    describe: 'Lists installed plugins, capabilities of installed plugins and other available plugins.',
    builder: (yargs) => yargs
        .positional('plugin', {
        type: 'string',
        description: 'The name of an installed plugin to query.',
    })
        .option('json', {
        type: 'boolean',
        description: 'Output JSON.',
    }),
    handler: async (args) => {
        await (await (0, handle_import_1.handleImport)('./list.js', __dirname)).listHandler(args);
        process.exit(0);
    },
};
