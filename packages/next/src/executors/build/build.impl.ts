import { ExecutorContext } from '@nrwl/devkit';

import build from 'next/dist/build';
import { PHASE_PRODUCTION_BUILD } from 'next/dist/next-server/lib/constants';

import { join, resolve } from 'path';
import { copySync } from 'fs-extra';

import { prepareConfig } from '../../utils/config';
import { NextBuildBuilderOptions } from '../../utils/types';
import { createPackageJson } from './lib/create-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';

try {
  require('dotenv').config();
} catch (e) {}

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const root = resolve(context.root, options.root);
  const config = prepareConfig(PHASE_PRODUCTION_BUILD, options, context);
  await build(root, config as any);
  createPackageJson(options, context);
  createNextConfigFile(options, context);

  copySync(join(root, 'public'), join(options.outputPath, 'public'));

  return { success: true };
}
