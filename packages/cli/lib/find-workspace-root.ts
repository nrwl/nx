import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { Workspace } from './workspace';

/**
 * Recursive function that walks back up the directory
 * tree to try and find a workspace file.
 *
 * @param dir Directory to start searching with
 */
export function findWorkspaceRoot(dir: string): Workspace {
  if (path.dirname(dir) === dir) {
    return null;
  }

  if (existsSync(path.join(dir, 'angular.json'))) {
    return { type: 'angular', dir };
  }

  if (existsSync(path.join(dir, 'workspace.json'))) {
    return { type: 'nx', dir };
  }

  return findWorkspaceRoot(path.dirname(dir));
}

export function isNxBuilder(
  workspaceConfigPath: string,
  projectName: string,
  targetName: string
) {
  try {
    const config = JSON.parse(readFileSync(workspaceConfigPath).toString());
    const [nodeModule] = config.projects[projectName].architect[
      targetName
    ].builder.split(':');
    const packageJsonPath = require.resolve(`${nodeModule}/package.json`);
    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
    const buildersFile = packageJson.builders;
    const buildersFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), buildersFile)
    );
    const buildersJson = JSON.parse(readFileSync(buildersFilePath).toString());
    return buildersJson['$schema'] === '@nrwl/tao/src/builders-schema.json';
  } catch (e) {
    return false;
  }
}
