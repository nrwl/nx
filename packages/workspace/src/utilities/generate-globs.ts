import { joinPathFragments, logger } from '@nrwl/devkit';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { dirname, join, relative, resolve } from 'path';
import { readCachedProjectGraph } from 'nx/src/project-graph/project-graph';
import {
  getProjectNameFromDirPath,
  getSourceDirOfDependentProjects,
} from 'nx/src/utils/project-graph-utils';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import ignore, { Ignore } from 'ignore';

function configureIgnore() {
  let ig: Ignore;
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

    const dirsToUse = [];
    const recursiveScanDirs = (dirPath) => {
      const children = readdirSync(dirPath);
      for (const child of children) {
        const childPath = join(dirPath, child);
        if (ig?.ignores(childPath) || !lstatSync(childPath).isDirectory()) {
          continue;
        }
        if (existsSync(join(childPath, 'ng-package.json'))) {
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
