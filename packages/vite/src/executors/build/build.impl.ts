import { ExecutorContext, logger } from '@nrwl/devkit';
import { build, InlineConfig } from 'vite';
import 'dotenv/config';
import { getBuildConfig } from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import { copyAssets } from '@nrwl/js';
import { existsSync } from 'fs';
import { join } from 'path';

export default async function viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot = context.workspace.projects[context.projectName].root;
  let assets = options.assets;

  // Copy package.json as an asset if it exists
  if (existsSync(join(projectRoot, 'package.json'))) {
    assets ??= [];
    assets.push({
      input: '.',
      output: '.',
      glob: 'package.json',
    });
  }

  logger.info(`NX Vite build starting ...`);
  const buildResult = await runInstance(await getBuildConfig(options, context));
  logger.info(`NX Vite build finished ...`);
  logger.info(`NX Vite files available in ${options.outputPath}`);

  // TODO(jack): handle watch once we add that option
  if (assets) {
    await copyAssets(
      {
        outputPath: options.outputPath,
        assets: assets,
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
