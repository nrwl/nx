"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsInitCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
const shared_options_1 = require("../yargs-utils/shared-options");
exports.yargsInitCommand = {
    command: 'init',
    describe: 'Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.',
    builder: async (yargs) => {
        // Check for --help flag directly since async builder doesn't receive helpOrVersionSet reliably
        const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
        if (wantsHelp) {
            const y = await withInitOptions(yargs);
            y.showHelp();
            process.exit(0);
        }
        return withInitOptions(yargs);
    },
    handler: async (args) => {
        // Node 24 has stricter readline behavior, and enquirer is not checking for closed state
        // when invoking operations, thus you get an ERR_USE_AFTER_CLOSE error.
        process.on('uncaughtException', (error) => {
            if (error &&
                typeof error === 'object' &&
                'code' in error &&
                error['code'] === 'ERR_USE_AFTER_CLOSE')
                return;
            throw error;
        });
        const useV2 = await isInitV2();
        if (useV2) {
            await require('./init-v2').initHandler(args);
        }
        else {
            // v1 path retained for `NX_ADD_PLUGINS=false`; slated for removal.
            await require('./init-v1').initHandler(args);
        }
        process.exit(0);
    },
};
async function isInitV2() {
    return (process.env['NX_ADD_PLUGINS'] !== 'false' &&
        (await (0, handle_import_1.handleImport)('../../config/nx-json.js', __dirname)).readNxJson()
            .useInferencePlugins !== false);
}
async function withInitOptions(yargs) {
    const useV2 = await isInitV2();
    if (useV2) {
        return yargs
            .option('nxCloud', {
            type: 'boolean',
            description: 'Set up distributed caching with Nx Cloud.',
        })
            .option('interactive', {
            describe: 'When false disables interactive input prompts for options.',
            type: 'boolean',
            default: true,
        })
            .option('useDotNxInstallation', {
            type: 'boolean',
            description: 'Initialize an Nx workspace setup in the .nx directory of the current repository.',
            default: false,
        })
            .option('aiAgents', {
            type: 'array',
            string: true,
            description: 'List of AI agents to set up.',
            choices: ['claude', 'codex', 'copilot', 'cursor', 'gemini', 'opencode'],
        })
            .option('plugins', {
            type: 'string',
            description: 'Plugins to install: "skip" for none, "all" for all detected, or comma-separated list (e.g., @nx/vite,@nx/jest).',
        })
            .option('cacheable', {
            type: 'string',
            description: 'Comma-separated list of cacheable operations (e.g., build,test,lint).',
            coerce: shared_options_1.parseCSV,
        });
    }
    else {
        return yargs
            .option('nxCloud', {
            type: 'boolean',
            description: 'Set up remote caching with Nx Cloud.',
        })
            .option('interactive', {
            describe: 'When false disables interactive input prompts for options.',
            type: 'boolean',
            default: true,
        })
            .option('integrated', {
            type: 'boolean',
            description: 'Migrate to an Nx integrated layout workspace. Only for Angular CLI workspaces.',
            default: false,
        })
            .option('useDotNxInstallation', {
            type: 'boolean',
            description: 'Initialize an Nx workspace setup in the .nx directory of the current repository.',
            default: false,
        })
            .option('cacheable', {
            type: 'string',
            description: 'Comma-separated list of cacheable operations. Only used for internal testing.',
            coerce: shared_options_1.parseCSV,
            hidden: true,
        });
    }
}
