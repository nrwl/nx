import { ExecutorContext, logger } from '@nrwl/devkit';
import { build, InlineConfig } from 'vite';
import 'dotenv/config';
import { getBuildConfig } from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import { copyAssets } from '@nrwl/js';

export default async function viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  if (options.assets) {
    await copyAssets(
      {
        outputPath: options.outputPath,
        assets: options.assets,
      },
      context
    );
  }

  logger.info(`NX Vite builder starting ...`);
  await runInstance(await getBuildConfig(options, context));
  logger.info(`NX Vite builder finished ...`);
  logger.info(`NX Vite files available in ${options.outputPath}`);
  return { success: true };
}

function runInstance(options: InlineConfig) {
  return build({
    ...options,
  });
}
