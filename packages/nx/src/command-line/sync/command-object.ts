import type { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';

export interface SyncArgs {
  verbose?: boolean;
}

export const yargsSyncCommand: CommandModule<
  Record<string, unknown>,
  SyncArgs
> = {
  command: 'sync',
  describe: 'Sync the workspace files by running all the sync generators.',
  builder: (yargs) => withVerbose(yargs),
  handler: async (args) => {
    process.exit(await import('./sync').then((m) => m.syncHandler(args)));
  },
};

export const yargsSyncCheckCommand: CommandModule<
  Record<string, unknown>,
  SyncArgs
> = {
  command: 'sync:check',
  describe:
    'Check that no changes are required after running all sync generators.',
  builder: (yargs) => withVerbose(yargs),
  handler: async (args) => {
    process.exit(
      await import('./sync').then((m) =>
        m.syncHandler({ ...args, check: true })
      )
    );
  },
};
