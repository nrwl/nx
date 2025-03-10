import { CommandModule } from 'yargs';
import { withVerbose } from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/handle-errors';

export interface GenerateCacheKeyOptions {
  verbose: boolean;
}

export const yargsGenerateCacheKeyCommand: CommandModule<
  {},
  GenerateCacheKeyOptions
> = {
  command: 'generate-cache-key',
  describe: 'Generate a cache key for Nx cache plugins.',
  builder: (yargs) =>
    withVerbose(yargs).parserConfiguration({
      'strip-dashed': true,
      'unknown-options-as-args': true,
    }),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      return (await import('./generate-cache-key')).handleGenerateCacheKey();
    });
    process.exit(exitCode);
  },
};
