import { ExecutorContext } from '@nrwl/devkit';

import build from 'next/dist/build';
import { PHASE_PRODUCTION_BUILD } from 'next/dist/next-server/lib/constants';

import { join, resolve } from 'path';
import { copySync, mkdir } from 'fs-extra';

import { prepareConfig } from '../../utils/config';
import { NextBuildBuilderOptions } from '../../utils/types';
import { createPackageJson } from './lib/create-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { directoryExists } from '@nrwl/workspace/src/utilities/fileutils';
import { createProjectGraphAsync } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { assertDependentProjectsHaveBeenBuilt } from '../../utils/buildable-libs';

try {
  require('dotenv').config();
} catch (e) {}

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  let dependencies: DependentBuildableProjectNode[] = [];
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';

  const root = resolve(context.root, options.root);

  if (!options.buildLibsFromSource && context.targetName) {
    const projGraph = await createProjectGraphAsync();
    const result = calculateProjectDependencies(
      projGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    dependencies = result.dependencies;

    assertDependentProjectsHaveBeenBuilt(dependencies, context);
  }

  const config = await prepareConfig(
    PHASE_PRODUCTION_BUILD,
    options,
    context,
    dependencies
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
