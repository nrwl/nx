import { joinPathFragments } from '@nrwl/devkit';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import { getSourceDirOfDependentProjects } from '@nrwl/workspace/src/utilities/project-graph-utils';
import { resolve } from 'path';

/**
 * Creates an array of of the dependent projects' source directories, appended
 * with the passed glob pattern.
 * @param projectName workspace relative filename, you can pass `__filename` if executed in a node process
 * @param fileGlobPattern the glob pattern to be applied to the various project directories
 * @returns
 */
export function createGlobPatternsOfDependentProjects(
  projectName: string,
  fileGlobPattern: string = '/**/!(*.stories|*.spec).tsx'
): string[] {
  const projectGraph = createProjectGraph();
  const projectDirs = getSourceDirOfDependentProjects(
    projectName,
    projectGraph
  );

  return projectDirs.map((sourceDir) =>
    resolve(appRootPath, joinPathFragments(sourceDir, fileGlobPattern))
  );
}
