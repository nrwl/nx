import 'dotenv/config';
import {
  ExecutorContext,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
  logger,
} from '@nx/devkit';
import { createLockFile, createPackageJson, getLockFileName } from '@nx/js';
import { join, resolve } from 'path';
import { copySync, existsSync, mkdir, writeFileSync } from 'fs-extra';
import { lt, gte } from 'semver';
import { directoryExists } from '@nx/workspace/src/utilities/fileutils';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';

import { updatePackageJson } from './lib/update-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { checkPublicDirectory } from './lib/check-project';
import { NextBuildBuilderOptions } from '../../utils/types';
import { ExecSyncOptions, execSync } from 'child_process';
import { formatObjectToCli } from '../server/formatObjectToCli';

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV ||= 'production';

  const root = resolve(context.root, options.root);

  checkPublicDirectory(root);

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

  const { experimentalAppOnly, profile, debug } = options;

  const args = formatObjectToCli({ experimentalAppOnly, profile, debug });
  const command = `next build ${args}`;
  const execSyncOptions: ExecSyncOptions = {
    stdio: 'inherit',
    encoding: 'utf-8',
    cwd: root,
  };
  try {
    execSync(command, execSyncOptions);
  } catch (error) {
    logger.error(`Error occurred while trying to run the ${command}`);
    logger.error(error);
    return { success: false };
  }

  if (!directoryExists(options.outputPath)) {
    mkdir(options.outputPath);
  }

  const builtPackageJson = createPackageJson(
    context.projectName,
    context.projectGraph,
    {
      target: context.targetName,
      root: context.root,
      isProduction: !options.includeDevDependenciesInPackageJson, // By default we remove devDependencies since this is a production build.
    }
  );
  updatePackageJson(builtPackageJson, context);
  writeJsonFile(`${options.outputPath}/package.json`, builtPackageJson);

  if (options.generateLockfile) {
    const lockFile = createLockFile(builtPackageJson);
    writeFileSync(`${options.outputPath}/${getLockFileName()}`, lockFile, {
      encoding: 'utf-8',
    });
  }

  createNextConfigFile(options, context);

  copySync(join(root, 'public'), join(options.outputPath, 'public'), {
    dereference: true,
  });

  return { success: true };
}
