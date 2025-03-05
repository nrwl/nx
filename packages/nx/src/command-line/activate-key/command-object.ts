import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/handle-errors';

export interface ActivateKeyOptions {
  key: string;
  verbose: boolean;
}

export const yargsActivateKeyCommand: CommandModule<{}, ActivateKeyOptions> = {
  command: 'activate-key <key>',
  aliases: ['activate-powerpack'],
  describe: false,
  // describe: 'Activate a Nx Powerpack license.',
  builder: (yargs) =>
    withVerbose(yargs)
      .parserConfiguration({
        'strip-dashed': true,
        'unknown-options-as-args': true,
      })
      .positional('key', {
        type: 'string',
        description: 'This is a key for Nx.',
      })
      .example('$0 activate-key <key>', 'Activate a Nx key'),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      return (await import('./activate-key')).handleActivateKey(args);
    });
    process.exit(exitCode);
  },
};
