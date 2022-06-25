import { joinPathFragments, logger } from '@nrwl/devkit';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { relative, resolve } from 'path';
import { readCachedProjectGraph } from 'nx/src/project-graph/project-graph';
import {
  getProjectNameFromDirPath,
  getSourceDirOfDependentProjects,
} from 'nx/src/utils/project-graph-utils';

/**
 * Generates a set of glob patterns based off the source root of the app and its dependencies
 * @param dirPath workspace relative directory path that will be used to infer the parent project and dependencies
 * @param fileGlobPattern pass a custom glob pattern to be used
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPattern: string
): string[] {
  const filenameRelativeToWorkspaceRoot = relative(workspaceRoot, dirPath);
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
    const [projectDirs, warnings] = getSourceDirOfDependentProjects(
      projectName,
      projectGraph
    );

    if (warnings.length > 0) {
      logger.warn(`
[createGlobPatternsForDependencies] Failed to generate glob pattern for the following:
${warnings.join('\n- ')}\n
due to missing "sourceRoot" in the dependencies' project configuration
      `);
    }

    return projectDirs.map((sourceDir) =>
      resolve(workspaceRoot, joinPathFragments(sourceDir, fileGlobPattern))
    );
  } catch (e) {
    throw new Error(
      `createGlobPatternsForDependencies: Error when generating globs.\n${e?.message}`
    );
  }
}
