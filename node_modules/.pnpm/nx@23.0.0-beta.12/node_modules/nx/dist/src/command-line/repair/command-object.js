"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsRepairCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
const documentation_1 = require("../yargs-utils/documentation");
const shared_options_1 = require("../yargs-utils/shared-options");
exports.yargsRepairCommand = {
    command: 'repair',
    describe: `Repair any configuration that is no longer supported by Nx.

    Specifically, this will run every migration within the \`nx\` package
    against the current repository. Doing so should fix any configuration
    details left behind if the repository was previously updated to a new
    Nx version without using \`nx migrate\`.

    If your repository has only ever updated to newer versions of Nx with
    \`nx migrate\`, running \`nx repair\` should do nothing.
  `,
    builder: (yargs) => (0, documentation_1.linkToNxDevAndExamples)((0, shared_options_1.withVerbose)(yargs), 'repair'),
    handler: async (args) => process.exit(await (await (0, handle_import_1.handleImport)('./repair.js', __dirname)).repair(args)),
};
