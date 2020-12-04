import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { BuilderContext } from '@angular-devkit/architect';
import { NextBuildBuilderOptions } from '../../../utils/types';

export async function createNextConfigFile(
  options: NextBuildBuilderOptions,
  context: BuilderContext
) {
  const nextConfigPath = options.nextConfig
    ? join(context.workspaceRoot, options.nextConfig)
    : join(context.workspaceRoot, options.root, 'next.config.js');

  if (existsSync(nextConfigPath)) {
    copyFileSync(nextConfigPath, join(options.outputPath, 'next.config.js'));
  }
}
