import 'dotenv/config';
import { ExecutorContext, logger } from '@nrwl/devkit';
import { build, InlineConfig } from 'vite';
import { getBuildAndSharedConfig } from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import { copyAssets } from '@nrwl/js';
import { existsSync } from 'fs';
import { join } from 'path';

export default async function viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot = context.workspace.projects[context.projectName].root;

  logger.info(`NX Vite build starting ...`);
  const buildResult = await runInstance(
    await getBuildAndSharedConfig(options, context)
  );
  logger.info(`NX Vite build finished ...`);
  logger.info(`NX Vite files available in ${options.outputPath}`);

  // For buildable libs, copy package.json if it exists.
  if (existsSync(join(projectRoot, 'package.json'))) {
    await copyAssets(
      {
        outputPath: options.outputPath,
        assets: [
          {
            input: '.',
            output: '.',
            glob: 'package.json',
          },
        ],
      },
      context
    );
  }

  return { success: true };
}

function runInstance(options: InlineConfig) {
  return build({
    ...options,
  });
}
