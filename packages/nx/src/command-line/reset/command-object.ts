import { CommandModule } from 'yargs';

export const yargsResetCommand: CommandModule = {
  command: 'reset',
  describe:
    'Clears all the cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.',
  aliases: ['clear-cache'],
  handler: async () => (await import('./reset')).resetHandler(),
};
