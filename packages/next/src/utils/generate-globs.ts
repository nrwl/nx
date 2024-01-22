import { joinPathFragments, logger } from '@nx/devkit';
import { workspaceRoot } from '@nx/devkit';
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
    `createGlobPatternsOfDependentProjects is deprecated. Use "createGlobPatternsForDependencies(__dirname)" from "@nx/next/tailwind" instead`
  );

  try {
    const [projectDirs, warnings] =
      getSourceDirOfDependentProjects(projectName);

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
      `createGlobPatternsOfDependentProjects: Error when generating globs: ${e?.message}`
    );
  }
}
