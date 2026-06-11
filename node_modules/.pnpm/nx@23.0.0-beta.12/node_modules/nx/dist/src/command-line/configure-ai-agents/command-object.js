"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsConfigureAiAgentsCommand = void 0;
const shared_options_1 = require("../yargs-utils/shared-options");
const handle_import_1 = require("../../utils/handle-import");
exports.yargsConfigureAiAgentsCommand = {
    command: 'configure-ai-agents',
    describe: 'Configure and update AI agent configurations for your workspace.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .option('agents', {
        type: 'array',
        string: true,
        description: 'List of AI agents to set up.',
        choices: ['claude', 'codex', 'copilot', 'cursor', 'gemini', 'opencode'],
    })
        .option('interactive', {
        type: 'boolean',
        description: 'When false disables interactive input prompts for options.',
        default: true,
    })
        .option('check', {
        type: 'string',
        description: 'Check agent configurations. Use --check or --check=outdated to check only configured agents, or --check=all to include unconfigured/partial configurations. Does not make any changes.',
        coerce: (value) => {
            // --check (no value)
            if (value === '')
                return 'outdated';
            // --check=true
            if (value === 'true')
                return 'outdated';
            // --no-check or --check=false
            if (value === 'false')
                return false;
            // --check=all or --check=outdated
            return value;
        },
        choices: ['outdated', 'all'],
    })
        .example('$0 configure-ai-agents', 'Interactively select AI agents to update and configure')
        .example('$0 configure-ai-agents --agents claude gemini', 'Prompts for updates and and configuration of Claude and Gemini AI agents')
        .example('$0 configure-ai-agents --check', 'Checks if any configured agents are out of date and need to be updated')
        .example('$0 configure-ai-agents --check=all', 'Checks if any agents are not configured, out of date or partially configured')
        .example('$0 configure-ai-agents --agents claude gemini --no-interactive', 'Configures and updates Claude and Gemini AI agents without prompts'), // because of the coerce function
    handler: async (args) => {
        await (await (0, handle_import_1.handleImport)('./configure-ai-agents.js', __dirname)).configureAiAgentsHandler(args);
    },
};
