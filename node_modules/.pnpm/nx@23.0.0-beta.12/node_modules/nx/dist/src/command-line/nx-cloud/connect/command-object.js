"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsViewLogsCommand = exports.yargsConnectCommand = void 0;
const handle_import_1 = require("../../../utils/handle-import");
const documentation_1 = require("../../yargs-utils/documentation");
const shared_options_1 = require("../../yargs-utils/shared-options");
exports.yargsConnectCommand = {
    command: 'connect',
    aliases: ['connect-to-nx-cloud'],
    describe: `Connect workspace to Nx Cloud.`,
    builder: (yargs) => (0, documentation_1.linkToNxDevAndExamples)(withConnectOptions(yargs), 'connect-to-nx-cloud'),
    handler: async (args) => {
        const checkRemote = process.env.NX_SKIP_CHECK_REMOTE !== 'true';
        await (await (0, handle_import_1.handleImport)('./connect-to-nx-cloud.js', __dirname)).connectToNxCloudCommand({ ...args, checkRemote });
        process.exit(0);
    },
};
function withConnectOptions(yargs) {
    return (0, shared_options_1.withVerbose)(yargs).option('generateToken', {
        type: 'boolean',
        description: 'Explicitly asks for a token to be created, do not override existing tokens from Nx Cloud.',
    });
}
exports.yargsViewLogsCommand = {
    command: 'view-logs',
    describe: 'Enables you to view and interact with the logs via the advanced analytic UI from Nx Cloud to help you debug your issue. To do this, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.',
    handler: async () => process.exit(await (await (0, handle_import_1.handleImport)('./view-logs.js', __dirname)).viewLogs()),
};
