import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';

export const yargsImportCommand: CommandModule = {
  command: 'import [sourceRepository] [destinationDirectory]',
  describe:
    'Import code and git history from another repository into this repository.',
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withVerbose(
        yargs
          .positional('sourceRepository', {
            type: 'string',
            description: 'The remote URL of the source to import.',
          })
          .positional('destinationDirectory', {
            type: 'string',
            alias: 'destination',
            description:
              'The directory in the current workspace to import into.',
          })
          .option('sourceDirectory', {
            type: 'string',
            alias: 'source',
            description:
              'The directory in the source repository to import from.',
          })
          .option('ref', {
            type: 'string',
            description: 'The branch from the source repository to import.',
          })
          .option('depth', {
            type: 'number',
            description:
              'The depth to clone the source repository (limit this for faster git clone).',
          })
          .option('interactive', {
            type: 'boolean',
            description: 'Interactive mode.',
            default: true,
          })
          .option('plugins', {
            type: 'string',
            description:
              'Plugins to install after import: "skip" for none, "all" for all detected, or comma-separated list (e.g., @nx/vite,@nx/jest).',
          })
      ),
      'import'
    ),
  handler: async (args) => {
    try {
      await (await import('./import')).importHandler(args as any);
      process.exit(0);
    } catch (error) {
      if ((await import('../../native')).isAiAgent()) {
        const {
          buildImportErrorResult,
          determineImportErrorCode,
          writeErrorLog,
        } = await import('./utils/ai-output');
        const { writeAiOutput } = await import('../ai/ai-output');
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = determineImportErrorCode(error);
        const errorLogPath = writeErrorLog(error, 'nx-import');
        writeAiOutput(
          buildImportErrorResult(errorMessage, errorCode, errorLogPath)
        );
      }
      process.exit(1);
    }
  },
};
