import { workspaceRoot } from '@nx/devkit';
import { tmpFolder } from './paths';
import { fork } from 'child_process';

/**
 * This function is used to run the create package CLI command.
 * It builds the plugin library and the create package library and run the create package command with for the plugin library.
 * It needs to be ran inside an Nx project. It would assume that an Nx project already exists.
 * @param projectToBeCreated project name to be created using the cli
 * @param pluginLibraryBuildPath e.g. dist/packages/my-plugin
 * @param createPackageLibraryBuildPath e.g. dist/packages/create-my-plugin-package
 * @param extraArguments extra arguments to be passed to the create package command
 * @param verbose if true, NX_VERBOSE_LOGGING will be set to true
 * @returns results for the create package command
 */
export function runCreatePackageCli(
  projectToBeCreated: string,
  {
    pluginLibraryBuildPath,
    createPackageLibraryBuildPath,
    extraArguments,
    verbose,
  }: {
    pluginLibraryBuildPath: string;
    createPackageLibraryBuildPath: string;
    extraArguments?: string[];
    verbose?: boolean;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = fork(
      `${workspaceRoot}/${createPackageLibraryBuildPath}/bin/index.js`,
      [projectToBeCreated, ...(extraArguments || [])],
      {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          [`NX_E2E_PRESET_VERSION`]: `file:${workspaceRoot}/${pluginLibraryBuildPath}`,
          // only add NX_VERBOSE_LOGGING if verbose is true
          ...(verbose && { NX_VERBOSE_LOGGING: 'true' }),
        },
        cwd: tmpFolder(),
      }
    );

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => childProcess.kill());
    process.on('SIGTERM', () => childProcess.kill());

    let allMessages = '';
    childProcess.on('message', (message) => {
      allMessages += message;
    });
    childProcess.stdout.on('data', (data) => {
      allMessages += data;
    });
    childProcess.on('error', (error) => {
      reject(error);
    });
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(allMessages);
      } else {
        reject(allMessages);
      }
    });
  });
}

export function generatedPackagePath(projectToBeCreated: string) {
  return `${tmpFolder()}/${projectToBeCreated}`;
}
