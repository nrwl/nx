import { joinPathFragments, logger, normalizePath } from '@nx/devkit';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { dirname, join, relative, resolve } from 'path';
import { readCachedProjectGraph } from 'nx/src/project-graph/project-graph';
import { getSourceDirOfDependentProjects } from 'nx/src/utils/project-graph-utils';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import ignore from 'ignore';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';

function configureIgnore() {
  let ig: ReturnType<typeof ignore>;
  const pathToGitIgnore = join(workspaceRoot, '.gitignore');
  if (existsSync(pathToGitIgnore)) {
    ig = ignore();
    ig.add(readFileSync(pathToGitIgnore, { encoding: 'utf-8' }));
  }
  return ig;
}

/**
 * Generates a set of glob patterns based off the source root of the app and its dependencies
 * @param dirPath workspace relative directory path that will be used to infer the parent project and dependencies
 * @param fileGlobPattern pass a custom glob pattern to be used
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPattern: string
): string[] {
  let ig = configureIgnore();
  const filenameRelativeToWorkspaceRoot = normalizePath(
    relative(workspaceRoot, dirPath)
  );
  const projectGraph = readCachedProjectGraph();
  const projectRootMappings = createProjectRootMappings(projectGraph.nodes);

  // find the project
  let projectName;
  try {
    projectName = findProjectForPath(
      filenameRelativeToWorkspaceRoot,
      projectRootMappings
    );

    if (!projectName) {
      throw new Error(
        `createGlobPatternsForDependencies: Could not find any project containing the file "${filenameRelativeToWorkspaceRoot}" among it's project files`
      );
    }
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

    const dirsToUse = [];
    const recursiveScanDirs = (dirPath) => {
      const children = readdirSync(resolve(workspaceRoot, dirPath));
      for (const child of children) {
        const childPath = join(dirPath, child);
        if (
          ig?.ignores(childPath) ||
          !lstatSync(resolve(workspaceRoot, childPath)).isDirectory()
        ) {
          continue;
        }
        if (existsSync(join(workspaceRoot, childPath, 'ng-package.json'))) {
          dirsToUse.push(childPath);
        } else {
          recursiveScanDirs(childPath);
        }
      }
    };

    for (const srcDir of projectDirs) {
      dirsToUse.push(srcDir);
      const root = dirname(srcDir);
      recursiveScanDirs(root);
    }

    if (warnings.length > 0) {
      logger.warn(`
[createGlobPatternsForDependencies] Failed to generate glob pattern for the following:
${warnings.join('\n- ')}\n
due to missing "sourceRoot" in the dependencies' project configuration
      `);
    }

    return dirsToUse.map((sourceDir) =>
      resolve(workspaceRoot, joinPathFragments(sourceDir, fileGlobPattern))
    );
  } catch (e) {
    throw new Error(
      `createGlobPatternsForDependencies: Error when generating globs.\n${e?.message}`
    );
  }
}
