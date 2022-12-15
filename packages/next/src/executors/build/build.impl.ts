import 'dotenv/config';
import {
  ExecutorContext,
  readJsonFile,
  workspaceLayout,
  workspaceRoot,
  createPackageJson,
  createLockFile,
  writeJsonFile,
} from '@nrwl/devkit';
import build from 'next/dist/build';
import { join, resolve } from 'path';
import { copySync, existsSync, mkdir, writeFileSync } from 'fs-extra';
import { gte } from 'semver';
import { directoryExists } from '@nrwl/workspace/src/utilities/fileutils';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';

import { prepareConfig } from '../../utils/config';
import { updatePackageJson } from './lib/update-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { checkPublicDirectory } from './lib/check-project';
import { NextBuildBuilderOptions } from '../../utils/types';
import { PHASE_PRODUCTION_BUILD } from '../../utils/constants';
import { getLockFileName } from 'nx/src/lock-file/lock-file';

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
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    dependencies = result.dependencies;
  }

  // Set `__NEXT_REACT_ROOT` based on installed ReactDOM version
  const packageJsonPath = join(root, 'package.json');
  const packageJson = existsSync(packageJsonPath)
    ? readJsonFile(packageJsonPath)
    : undefined;
  const rootPackageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  const reactDomVersion =
    packageJson?.dependencies?.['react-dom'] ??
    rootPackageJson.dependencies?.['react-dom'];
  const hasReact18 =
    reactDomVersion &&
    gte(checkAndCleanWithSemver('react-dom', reactDomVersion), '18.0.0');
  if (hasReact18) {
    (process.env as any).__NEXT_REACT_ROOT ||= 'true';
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

  const builtPackageJson = createPackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      isProduction: !options.includeDevDependenciesInPackageJson, // By default we remove devDependencies since this is a production build.
    }
  );
  updatePackageJson(builtPackageJson, context);
  const lockFile = createLockFile(builtPackageJson);
  writeJsonFile(`${options.outputPath}/package.json`, builtPackageJson);
  writeFileSync(`${options.outputPath}/${getLockFileName()}`, lockFile, {
    encoding: 'utf-8',
  });

  createNextConfigFile(options, context);

  copySync(join(root, 'public'), join(options.outputPath, 'public'));

  return { success: true };
}
