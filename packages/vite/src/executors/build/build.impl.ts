import 'dotenv/config';
import { ExecutorContext, logger } from '@nrwl/devkit';
import { build, InlineConfig } from 'vite';
import { getBuildAndSharedConfig } from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import { copyAssets } from '@nrwl/js';
import { existsSync } from 'fs';
import { resolve } from 'path';

export default async function viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot = context.workspace.projects[context.projectName].root;

  await runInstance(await getBuildAndSharedConfig(options, context));

  const libraryPackageJson = resolve(projectRoot, 'package.json');
  const rootPackageJson = resolve(context.root, 'package.json');

  // For buildable libs, copy package.json if it exists.
  if (
    existsSync(libraryPackageJson) &&
    rootPackageJson !== libraryPackageJson
  ) {
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
