import { joinPathFragments } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { relative, resolve } from 'path';
import { readCachedProjectGraph } from '../core/project-graph';
import {
  getProjectNameFromDirPath,
  getSourceDirOfDependentProjects,
} from './project-graph-utils';

/**
 * Generates a set of glob patterns based off the source root of the app and its dependencies
 * @param dirPath workspace relative directory path that will be used to infer the parent project and dependencies
 * @param fileGlobPattern pass a custom glob pattern to be used
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPattern: string
): string[] {
  const filenameRelativeToWorkspaceRoot = relative(appRootPath, dirPath);
  const projectGraph = readCachedProjectGraph();

  // find the project
  let projectName;
  try {
    projectName = getProjectNameFromDirPath(
      filenameRelativeToWorkspaceRoot,
      projectGraph
    );
  } catch (e) {
    throw new Error(
      `createGlobPatternsForDependencies: Error when trying to determine main project.\n${e?.message}`
    );
  }

  // generate the glob
  try {
    const projectDirs = getSourceDirOfDependentProjects(
      projectName,
      projectGraph
    );

    return projectDirs.map((sourceDir) =>
      resolve(appRootPath, joinPathFragments(sourceDir, fileGlobPattern))
    );
  } catch (e) {
    throw new Error(
      `createGlobPatternsForDependencies: Error when generating globs.\n${e?.message}`
    );
  }
}
