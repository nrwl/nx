import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';

export interface ConfigureAiAgentsOptions {
  agents?: string[];
  interactive?: boolean;
  verbose?: boolean;
  check?: boolean;
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
        description:
          'List of AI agents to set up (e.g., claude, codex, vscode, cursor, gemini).',
        choices: ['claude', 'codex', 'vscode', 'cursor', 'gemini'],
      })
      .option('interactive', {
        type: 'boolean',
        description:
          'When false disables interactive input prompts for options.',
        default: true,
      })
      .option('check', {
        type: 'boolean',
        description:
          'Check if any configured agents are out of date and need to be updated. Does not make any changes.',
        default: false,
      })
      .example(
        '$0 configure-ai-agents',
        'Interactively select AI agents to update and configure'
      )
      .example(
        '$0 configure-ai-agents --agents claude gemini',
        'Configures and updates Claude and Gemini AI agents '
      )
      .example(
        '$0 configure-ai-agents --check',
        'Checks if any configured agents are out of date and need to be updated'
      ),
  handler: async (args) => {
    await (
      await import('./configure-ai-agents')
    ).configureAiAgentsHandler(args);
  },
};
