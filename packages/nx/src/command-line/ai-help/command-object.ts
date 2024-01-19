import { CommandModule } from 'yargs';

export const yargsAICommand: CommandModule = {
  command: 'ai [prompt]',
  describe: 'Write in natural language what you want to run.',
  builder: (yargs) =>
    yargs.positional('prompt', {
      type: 'string',
      description: 'What command you want to run.',
    }),
  handler: async (args: any) => {
    await (await import('./ai-help')).aiHandler(args);
    process.exit(0);
  },
};
