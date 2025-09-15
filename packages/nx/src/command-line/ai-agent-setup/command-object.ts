import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';

export interface AiAgentSetupOptions {
  agents?: string[];
  interactive?: boolean;
  verbose?: boolean;
}

export const yargsAiAgentSetupCommand: CommandModule<{}, AiAgentSetupOptions> =
  {
    command: 'ai-agent-setup',
    describe: 'Set up AI agent configurations for your workspace.',
    builder: (yargs) =>
      withVerbose(yargs)
        .option('agents', {
          type: 'array',
          string: true,
          description:
            'List of AI agents to set up (e.g., claude, codex, vscode, cursor, gemini).',
          choices: ['claude', 'codex', 'vscode', 'cursor', 'gemini'],
        } as const)
        .option('interactive', {
          type: 'boolean',
          description:
            'When false disables interactive input prompts for options.',
          default: true,
        })
        .example(
          '$0 ai-agent-setup',
          'Interactively select AI agents to set up'
        )
        .example(
          '$0 ai-agent-setup --agents claude gemini',
          'Set up Claude and Gemini AI agents without prompts'
        ),
    handler: async (args) => {
      try {
        await import('./ai-agent-setup').then((m) =>
          m.aiAgentSetupHandler(args)
        );
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
    },
  };
