import { ExecutorContext } from '@nrwl/devkit';

import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

import { NextBuildBuilderOptions } from '../../../utils/types';

export function createNextConfigFile(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const nextConfigPath = options.nextConfig
    ? join(context.root, options.nextConfig)
    : join(context.root, options.root, 'next.config.js');

  if (existsSync(nextConfigPath)) {
    copyFileSync(nextConfigPath, join(options.outputPath, 'next.config.js'));
  }
}
