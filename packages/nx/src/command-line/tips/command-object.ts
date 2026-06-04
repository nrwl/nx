import { CommandModule } from 'yargs';
import { handleErrors } from '../../utils/handle-errors';
import { handleImport } from '../../utils/handle-import';
import type { TipsSubcommand } from './tips';

const runTipsSubcommand =
  (sub: TipsSubcommand): CommandModule['handler'] =>
  async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? false,
      async () =>
        (await handleImport('./tips.js', __dirname)).handleTipsCommand(sub)
    );
    process.exit(exitCode);
  };

export const yargsTipsCommand: CommandModule = {
  command: 'tips',
  describe: 'Manage Nx tip-of-the-run notifications.',
  builder: (yargs) =>
    yargs
      .usage('$0 tips <subcommand>')
      .command({
        command: 'enable',
        describe: 'Enable post-run tip notifications.',
        handler: runTipsSubcommand('enable'),
      })
      .command({
        command: 'disable',
        describe: 'Disable post-run tip notifications.',
        handler: runTipsSubcommand('disable'),
      })
      .command({
        command: 'show',
        describe: 'Preview a tip now.',
        handler: runTipsSubcommand('show'),
      })
      .demandCommand(1, 'Specify a subcommand: enable | disable | show'),
  // Parent command has no handler - subcommand is always required
  handler: () => {},
};
