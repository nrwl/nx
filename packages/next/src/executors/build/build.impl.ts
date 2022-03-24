import 'dotenv/config';
import { ExecutorContext } from '@nrwl/devkit';

import build from 'next/dist/build';

import { join, resolve } from 'path';
import { copySync, mkdir } from 'fs-extra';

import { prepareConfig } from '../../utils/config';
import { NextBuildBuilderOptions } from '../../utils/types';
import { createPackageJson } from './lib/create-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { directoryExists } from '@nrwl/workspace/src/utilities/fileutils';
import { readCachedProjectGraph } from '@nrwl/devkit';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { checkPublicDirectory } from './lib/check-project';
import { importConstants } from '../../utils/require-shim';
import { workspaceLayout } from '@nrwl/devkit';

const { PHASE_PRODUCTION_BUILD } = importConstants();

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV ||= 'production';

  let dependencies: DependentBuildableProjectNode[] = [];
  const root = resolve(context.root, options.root);
  const libsDir = join(context.root, workspaceLayout().libsDir);

  checkPublicDirectory(root);

  if (!options.buildLibsFromSource && context.targetName) {
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    dependencies = result.dependencies;
  }

  const config = await prepareConfig(
    PHASE_PRODUCTION_BUILD,
    options,
    context,
    dependencies,
    libsDir
  );

  await build(root, config as any);

  if (!directoryExists(options.outputPath)) {
    mkdir(options.outputPath);
  }

  await createPackageJson(options, context);
  createNextConfigFile(options, context);

  copySync(join(root, 'public'), join(options.outputPath, 'public'));

  return { success: true };
}
