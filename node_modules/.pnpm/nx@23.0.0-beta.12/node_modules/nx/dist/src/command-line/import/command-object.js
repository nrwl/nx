"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsImportCommand = void 0;
const native_1 = require("../../native");
const handle_errors_1 = require("../../utils/handle-errors");
const ai_output_1 = require("../ai/ai-output");
const ai_output_2 = require("./utils/ai-output");
const documentation_1 = require("../yargs-utils/documentation");
const shared_options_1 = require("../yargs-utils/shared-options");
const handle_import_1 = require("../../utils/handle-import");
exports.yargsImportCommand = {
    command: 'import [sourceRepository] [destinationDirectory]',
    describe: 'Import code and git history from another repository into this repository.',
    builder: (yargs) => (0, documentation_1.linkToNxDevAndExamples)((0, shared_options_1.withVerbose)(yargs
        .positional('sourceRepository', {
        type: 'string',
        description: 'The remote URL or local path of the source repository to import.',
    })
        .positional('destinationDirectory', {
        type: 'string',
        alias: 'destination',
        description: 'The directory in the current workspace to import into.',
    })
        .option('sourceDirectory', {
        type: 'string',
        alias: 'source',
        description: 'The directory in the source repository to import from.',
    })
        .option('ref', {
        type: 'string',
        description: 'The branch from the source repository to import.',
    })
        .option('depth', {
        type: 'number',
        description: 'The depth to clone the source repository (limit this for faster git clone).',
    })
        .option('interactive', {
        type: 'boolean',
        description: 'Interactive mode.',
        default: true,
    })
        .option('plugins', {
        type: 'string',
        description: 'Plugins to install after import: "skip" for none, "all" for all detected, or comma-separated list (e.g., @nx/vite,@nx/jest).',
    })), 'import'),
    handler: async (args) => {
        const exitCode = await (0, handle_errors_1.handleErrors)(args.verbose, async () => {
            try {
                return await (await (0, handle_import_1.handleImport)('./import.js', __dirname)).importHandler(args);
            }
            catch (error) {
                if ((0, native_1.isAiAgent)()) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorCode = (0, ai_output_2.determineImportErrorCode)(error);
                    const errorLogPath = (0, ai_output_2.writeErrorLog)(error, 'nx-import');
                    (0, ai_output_1.writeAiOutput)((0, ai_output_2.buildImportErrorResult)(errorMessage, errorCode, errorLogPath));
                }
                throw error;
            }
        });
        process.exit(exitCode);
    },
};
