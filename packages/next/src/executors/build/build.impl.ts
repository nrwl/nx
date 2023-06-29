import 'dotenv/config';
import {
  ExecutorContext,
  logger,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { createLockFile, createPackageJson, getLockFileName } from '@nx/js';
import { join } from 'path';
import { copySync, existsSync, mkdir, writeFileSync } from 'fs-extra';
import { gte } from 'semver';
import { directoryExists } from '@nx/workspace/src/utilities/fileutils';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';

import { updatePackageJson } from './lib/update-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { checkPublicDirectory } from './lib/check-project';
import { NextBuildBuilderOptions } from '../../utils/types';
import { execSync, ExecSyncOptions } from 'child_process';
import { createCliOptions } from '../../utils/create-cli-options';

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV ||= 'production';

  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;

  checkPublicDirectory(projectRoot);

  // Set `__NEXT_REACT_ROOT` based on installed ReactDOM version
  const packageJsonPath = join(projectRoot, 'package.json');
  const packageJson = existsSync(packageJsonPath)
    ? readJsonFile(packageJsonPath)
    : undefined;
  const rootPackageJson = readJsonFile(join(context.root, 'package.json'));
  const reactDomVersion =
    packageJson?.dependencies?.['react-dom'] ??
    rootPackageJson.dependencies?.['react-dom'];
  const hasReact18 =
    reactDomVersion &&
    gte(checkAndCleanWithSemver('react-dom', reactDomVersion), '18.0.0');
  if (hasReact18) {
    process.env['__NEXT_REACT_ROOT'] ||= 'true';
  }

  const { experimentalAppOnly, profile, debug } = options;

  const args = createCliOptions({ experimentalAppOnly, profile, debug });
  const command = `npx next build ${args.join(' ')}`;
  const execSyncOptions: ExecSyncOptions = {
    stdio: 'inherit',
    encoding: 'utf-8',
    cwd: projectRoot,
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

  // Update `package.json` to reflect how users should run the build artifacts
  builtPackageJson.scripts = {
    start: 'next start',
  };

  updatePackageJson(builtPackageJson, context);
  writeJsonFile(`${options.outputPath}/package.json`, builtPackageJson);

  if (options.generateLockfile) {
    const lockFile = createLockFile(builtPackageJson);
    writeFileSync(`${options.outputPath}/${getLockFileName()}`, lockFile, {
      encoding: 'utf-8',
    });
  }

  // If output path is different from source path, then copy over the config and public files.
  // This is the default behavior when running `nx build <app>`.
  if (options.outputPath.replace(/\/$/, '') !== projectRoot) {
    createNextConfigFile(options, context);
    copySync(join(projectRoot, 'public'), join(options.outputPath, 'public'), {
      dereference: true,
    });
  }
  return { success: true };
}
