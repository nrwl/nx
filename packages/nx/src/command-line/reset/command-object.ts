import { CommandModule } from 'yargs';

export type ResetCommandOptions = {
  onlyCache?: boolean;
  onlyDaemon?: boolean;
  onlyWorkspaceData?: boolean;
};

export const yargsResetCommand: CommandModule<
  Record<string, unknown>,
  ResetCommandOptions
> = {
  command: 'reset',
  describe:
    'Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.',
  aliases: ['clear-cache'],
  builder: (yargs) =>
    yargs
      .option('onlyCache', {
        description:
          'Clears the Nx cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache.',
        type: 'boolean',
      })
      .option('onlyDaemon', {
        description:
          'Stops the Nx Daemon, it will be restarted fresh when the next Nx command is run.',
        type: 'boolean',
      })
      .option('onlyWorkspaceData', {
        description:
          'Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc)',
        type: 'boolean',
      }),
  handler: async (argv) => (await import('./reset')).resetHandler(argv),
};
