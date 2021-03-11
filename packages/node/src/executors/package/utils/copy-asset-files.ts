import { ExecutorContext, logger } from '@nrwl/devkit';
import { NormalizedBuilderOptions } from './models';
import { copy } from 'fs-extra';

export default function copyAssetFiles(
  options: NormalizedBuilderOptions,
  context: ExecutorContext
) {
  logger.info('Copying asset files...');
  return Promise.all(options.files.map((file) => copy(file.input, file.output)))
    .then(() => {
      logger.info('Done copying asset files.');
      return {
        success: true,
      };
    })
    .catch((err: Error) => {
      return {
        error: err.message,
        success: false,
      };
    });
}
