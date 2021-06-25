import { joinPathFragments, logger } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import { getSourceDirOfDependentProjects } from '@nrwl/workspace/src/utilities/project-graph-utils';
import { resolve } from 'path';

/**
 * Use createGlobPatterns instead
 * @deprecated Use createGlobPatterns instead
 */
export function createGlobPatternsOfDependentProjects(
  projectName: string,
  fileGlobPattern: string = '/**/!(*.stories|*.spec).tsx'
): string[] {
  logger.warn(
    `createGlobPatternsOfDependentProjects is deprecated. Use "createGlobPatterns(__filename)" instead`
  );

  try {
    const projectDirs = getSourceDirOfDependentProjects(projectName);

    return projectDirs.map((sourceDir) =>
      resolve(appRootPath, joinPathFragments(sourceDir, fileGlobPattern))
    );
  } catch (e) {
    throw new Error(
      `createGlobPatternsOfDependentProjects: Error when generating globs: ${e?.message}`
    );
  }
}
