import type { CommandModule } from 'yargs';

export interface SyncArgs {
  verbose?: boolean;
}

export const yargsSyncCommand: CommandModule<
  Record<string, unknown>,
  SyncArgs
> = {
  command: 'sync',
  describe: false,
  builder: (yargs) =>
    yargs.option('verbose', {
      type: 'boolean',
      description:
        'Prints additional information about the commands (e.g., stack traces)',
    }),
  handler: async (args) => {
    process.exit(await import('./sync').then((m) => m.syncHandler(args)));
  },
};

export const yargsSyncCheckCommand: CommandModule<
  Record<string, unknown>,
  SyncArgs
> = {
  command: 'sync:check',
  describe: false,
  builder: (yargs) =>
    yargs.option('verbose', {
      type: 'boolean',
      description:
        'Prints additional information about the commands (e.g., stack traces)',
    }),
  handler: async (args) => {
    process.exit(
      await import('./sync').then((m) =>
        m.syncHandler({ ...args, check: true })
      )
    );
  },
};
