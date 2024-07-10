import type { CommandModule } from 'yargs';

export interface SyncOptions {
  check?: boolean;
  verbose?: boolean;
}

export const yargsSyncCommand: CommandModule<
  Record<string, unknown>,
  SyncOptions
> = {
  command: 'sync',
  describe:
    'Sync the workspace configuration by running the registered sync generators.',
  builder: (yargs) =>
    yargs
      .option('check', {
        type: 'boolean',
        description: 'Check if the workspace is in sync without making changes',
      })
      .option('verbose', {
        type: 'boolean',
        description:
          'Prints additional information about the commands (e.g., stack traces)',
      })
      .example(
        '$0 --check',
        'Check if the workspace is in sync without making changes. It throws an error and exits with a non-zero status code if the workspace is not in sync'
      ) as any,
  handler: async (args) => {
    process.exit(await import('./sync').then((m) => m.addHandler(args)));
  },
};
