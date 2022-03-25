import { joinPathFragments, logger } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/devkit';
import { getSourceDirOfDependentProjects } from 'nx/src/utils/project-graph-utils';
import { resolve } from 'path';

/**
 * Use createGlobPatterns instead
 * @deprecated Use createGlobPatternsForDependencies instead
 */
export function createGlobPatternsOfDependentProjects(
  projectName: string,
  fileGlobPattern: string = '/**/!(*.stories|*.spec).tsx'
): string[] {
  logger.warn(
    `createGlobPatternsOfDependentProjects is deprecated. Use "createGlobPatternsForDependencies(__dirname)" from "@nrwl/next/tailwind" instead`
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
