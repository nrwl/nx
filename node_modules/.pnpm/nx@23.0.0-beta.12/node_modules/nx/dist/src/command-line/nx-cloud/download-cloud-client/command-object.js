"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsDownloadCloudClientCommand = void 0;
const handle_import_1 = require("../../../utils/handle-import");
const shared_options_1 = require("../../yargs-utils/shared-options");
exports.yargsDownloadCloudClientCommand = {
    command: 'download-cloud-client',
    describe: 'Download the Nx Cloud client.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs),
    handler: async (args) => {
        process.exit(await (await (0, handle_import_1.handleImport)('./download-cloud-client.js', __dirname)).downloadCloudClientHandler(args));
    },
};
