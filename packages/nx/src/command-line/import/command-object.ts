import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/params';

export const yargsImportCommand: CommandModule = {
  command: 'import [sourceRemoteUrl] [destination]',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withVerbose(
        yargs
          .positional('sourceRemoteUrl', {
            type: 'string',
            description: 'The remote URL of the source to import',
          })
          .positional('destination', {
            type: 'string',
            description:
              'The directory in the current workspace to import into',
          })
          .option('source', {
            type: 'string',
            description:
              'The directory in the source repository to import from',
          })
          .option('ref', {
            type: 'string',
            description: 'The branch from the source repository to import',
          })
          .option('depth', {
            type: 'number',
            description:
              'The depth to clone the source repository (limit this for faster git clone)',
          })
          .option('interactive', {
            type: 'boolean',
            description: 'Interactive mode',
            default: true,
          })
      ),
      'import'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      return (await import('./import')).importHandler(args as any);
    });
    process.exit(exitCode);
  },
};
