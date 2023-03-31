import { workspaceRoot } from '@nrwl/devkit';
import { runCommand, runNxCommand } from './commands';
import { tmpProjPath } from './paths';

/**
 * This function is used to run the create package CLI command.
 * It builds the plugin library and the create package library and run the create package command with for the plugin library.
 * It needs to be ran inside an Nx project. It would assume that an Nx project already exists.
 * @param pluginLibraryName e.g. my-plugin
 * @param pluginLibraryBuildPath e.g. dist/packages/my-plugin
 * @param createPackageLibraryName e.g. create-my-plugin-package
 * @param createPackageLibraryBuildPath e.g. dist/packages/create-my-plugin-package
 * @param projectToBeCreated project name to be created using the cli
 * @returns results for the create package command
 */
export function runCreatePackageCli(
  pluginLibraryName: string,
  pluginLibraryBuildPath: string,
  createPackageLibraryName: string,
  createPackageLibraryBuildPath: string,
  projectToBeCreated: string
) {
  runNxCommand(`build ${createPackageLibraryName}`, {
    cwd: process.cwd(),
  });
  return runCommand(
    `node ${workspaceRoot}/${createPackageLibraryBuildPath}/bin/index.js ${projectToBeCreated} --verbose`,
    {
      env: {
        [pluginLibraryName]: `file:${workspaceRoot}/${pluginLibraryBuildPath}`,
      },
      cwd: tmpProjPath(),
    }
  );
}

export function generatedPackagePath(projectToBeCreated: string) {
  return `${tmpProjPath}/${projectToBeCreated}`;
}
