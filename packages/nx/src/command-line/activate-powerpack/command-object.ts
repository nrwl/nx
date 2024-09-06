import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/handle-errors';

export interface ActivatePowerpackOptions {
  license: string;
  verbose: boolean;
}

export const yargsActivatePowerpackCommand: CommandModule<
  {},
  ActivatePowerpackOptions
> = {
  command: 'activate-powerpack <license>',
  describe: 'Activate a Nx Powerpack license.',
  builder: (yargs) =>
    withVerbose(yargs)
      .parserConfiguration({
        'strip-dashed': true,
        'unknown-options-as-args': true,
      })
      .positional('license', {
        type: 'string',
        description: 'License Key.',
        required: true,
      })
      .example(
        '$0 activate-powerpack <license key>',
        'Activate powerpack license'
      ),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      return (await import('./activate-powerpack')).handleActivatePowerpack(
        args
      );
    });
    process.exit(exitCode);
  },
};
