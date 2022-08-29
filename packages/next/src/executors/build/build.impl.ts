import 'dotenv/config';
import { ExecutorContext, readJsonFile, workspaceLayout } from '@nrwl/devkit';
import build from 'next/dist/build';
import { join, resolve } from 'path';
import { copySync, mkdir } from 'fs-extra';
import { gte } from 'semver';
import { directoryExists } from '@nrwl/workspace/src/utilities/fileutils';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';

import { prepareConfig } from '../../utils/config';
import { createPackageJson } from './lib/create-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { checkPublicDirectory } from './lib/check-project';
import { NextBuildBuilderOptions } from '../../utils/types';
import { PHASE_PRODUCTION_BUILD } from '../../utils/constants';

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV ||= 'production';

  // Set `__NEXT_REACT_ROOT` based on installed ReactDOM version
  const packageJson = readJsonFile(join(context.root, 'package.json'));
  const reactDomVersion = packageJson.dependencies['react-dom'];
  const hasReact18 =
    reactDomVersion &&
    gte(checkAndCleanWithSemver('react-dom', reactDomVersion), '18.0.0');
  if (hasReact18) {
    (process.env as any).__NEXT_REACT_ROOT ||= 'true';
  }

  let dependencies: DependentBuildableProjectNode[] = [];
  const root = resolve(context.root, options.root);
  const libsDir = join(context.root, workspaceLayout().libsDir);

  checkPublicDirectory(root);

  if (!options.buildLibsFromSource && context.targetName) {
    const result = calculateProjectDependencies(
      context.projectGraph,
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
