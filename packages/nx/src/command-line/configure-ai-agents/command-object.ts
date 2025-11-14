import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';

export interface ConfigureAiAgentsOptions {
  agents?: string[];
  interactive?: boolean;
  verbose?: boolean;
  check?: boolean | 'outdated' | 'all';
}

export const yargsConfigureAiAgentsCommand: CommandModule<
  {},
  ConfigureAiAgentsOptions
> = {
  command: 'configure-ai-agents',
  describe: 'Configure and update AI agent configurations for your workspace.',
  builder: (yargs) =>
    withVerbose(yargs)
      .option('agents', {
        type: 'array',
        string: true,
        description: 'List of AI agents to set up.',
        choices: ['claude', 'codex', 'copilot', 'cursor', 'gemini'],
      })
      .option('interactive', {
        type: 'boolean',
        description:
          'When false disables interactive input prompts for options.',
        default: true,
      })
      .option('check', {
        type: 'string',
        description:
          'Check agent configurations. Use --check or --check=outdated to check only configured agents, or --check=all to include unconfigured/partial configurations. Does not make any changes.',
        coerce: (value: string) => {
          // --check (no value)
          if (value === '') return 'outdated';
          // --check=true
          if (value === 'true') return 'outdated';
          // --no-check or --check=false
          if (value === 'false') return false;
          // --check=all or --check=outdated
          return value;
        },
        choices: ['outdated', 'all'],
      })
      .example(
        '$0 configure-ai-agents',
        'Interactively select AI agents to update and configure'
      )
      .example(
        '$0 configure-ai-agents --agents claude gemini',
        'Prompts for updates and and configuration of Claude and Gemini AI agents'
      )
      .example(
        '$0 configure-ai-agents --check',
        'Checks if any configured agents are out of date and need to be updated'
      )
      .example(
        '$0 configure-ai-agents --check=all',
        'Checks if any agents are not configured, out of date or partially configured'
      )
      .example(
        '$0 configure-ai-agents --agents claude gemini --no-interactive',
        'Configures and updates Claude and Gemini AI agents without prompts'
      ) as any, // because of the coerce function
  handler: async (args) => {
    await (
      await import('./configure-ai-agents.js')
    ).configureAiAgentsHandler(args);
  },
};
