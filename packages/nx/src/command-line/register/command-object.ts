import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/handle-errors';

export interface RegisterOptions {
  key?: string;
  verbose?: boolean;
}

export const yargsRegisterCommand: CommandModule<{}, RegisterOptions> = {
  command: 'register [key]',
  aliases: ['activate-powerpack'],
  describe: false,
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
      .example('$0 register <key>', 'Register a Nx key'),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose ?? false, async () => {
      return (await import('./register')).handleRegister(args);
    });
    process.exit(exitCode);
  },
};
