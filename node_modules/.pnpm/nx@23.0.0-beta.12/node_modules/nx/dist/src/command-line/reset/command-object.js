"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsResetCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
exports.yargsResetCommand = {
    command: 'reset',
    describe: 'Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.',
    aliases: ['clear-cache'],
    builder: (yargs) => yargs
        .option('onlyCache', {
        description: 'Clears the Nx cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache.',
        type: 'boolean',
    })
        .option('onlyDaemon', {
        description: 'Stops the Nx Daemon and clears its workspace data, it will be restarted fresh when the next Nx command is run.',
        type: 'boolean',
    })
        .option('onlyCloud', {
        description: 'Resets the Nx Cloud client. NOTE: Does not clear the remote cache.',
        type: 'boolean',
    })
        .option('onlyWorkspaceData', {
        description: 'Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc).',
        type: 'boolean',
    }),
    handler: async (argv) => (await (0, handle_import_1.handleImport)('./reset.js', __dirname)).resetHandler(argv),
};
