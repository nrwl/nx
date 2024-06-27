import {
  detectPackageManager,
  ExecutorContext,
  logger,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { createLockFile, createPackageJson, getLockFileName } from '@nx/js';
import { join, resolve as pathResolve } from 'path';
import { copySync, existsSync, mkdir, writeFileSync } from 'fs-extra';
import { gte } from 'semver';
import { directoryExists } from '@nx/workspace/src/utilities/fileutils';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';

import { updatePackageJson } from './lib/update-package-json';
import { createNextConfigFile } from './lib/create-next-config-file';
import { checkPublicDirectory } from './lib/check-project';
import { NextBuildBuilderOptions } from '../../utils/types';
import { ChildProcess, fork } from 'child_process';
import { createCliOptions } from '../../utils/create-cli-options';
import { signalToCode } from 'nx/src/utils/exit-codes';

let childProcess: ChildProcess;

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

  try {
    await runCliBuild(workspaceRoot, projectRoot, options);
  } catch ({ error, code, signal }) {
    if (code || signal) {
      logger.error(
        `Build process exited due to ${code ? 'code ' + code : ''} ${
          code && signal ? 'and' : ''
        } ${signal ? 'signal ' + signal : ''}`
      );
    } else {
      logger.error(`Error occurred while trying to run the build command`);
      logger.error(error);
    }
    return { success: false };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
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
    const packageManager = detectPackageManager(context.root);
    const lockFile = createLockFile(
      builtPackageJson,
      context.projectGraph,
      packageManager
    );
    writeFileSync(
      `${options.outputPath}/${getLockFileName(packageManager)}`,
      lockFile,
      {
        encoding: 'utf-8',
      }
    );
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

function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: NextBuildBuilderOptions
) {
  const {
    experimentalAppOnly,
    experimentalBuildMode,
    profile,
    debug,
    outputPath,
  } = options;

  // Set output path here since it can also be set via CLI
  // We can retrieve it inside plugins/with-nx
  process.env.NX_NEXT_OUTPUT_PATH ??= outputPath;

  const args = createCliOptions({
    experimentalAppOnly,
    experimentalBuildMode,
    profile,
    debug,
  });
  return new Promise((resolve, reject) => {
    childProcess = fork(
      require.resolve('next/dist/bin/next'),
      ['build', ...args],
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        env: process.env,
      }
    );

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => childProcess.kill());

    process.on('SIGTERM', (signal) => {
      reject({ code: signalToCode(signal), signal });
    });
    process.on('SIGINT', (signal) => {
      reject({ code: signalToCode(signal), signal });
    });

    childProcess.on('error', (err) => {
      reject({ error: err });
    });

    childProcess.on('exit', (code, signal) => {
      if (code === 0) {
        resolve({ code, signal });
      } else {
        reject({ code, signal });
      }
    });
  });
}
