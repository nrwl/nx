import {
  type CreateNodesContext,
  joinPathFragments,
} from 'nx/src/devkit-exports';
import { join } from 'path';
import { readdirSync } from 'fs';
import { minimatch } from 'minimatch';
import {
  combineGlobPatterns,
  getGlobPatternsFromPackageManagerWorkspaces,
} from 'nx/src/devkit-internals';

export function projectFoundInRootPath(
  rootPath: string,
  context: CreateNodesContext,
  additionalProjectFiles: string[] = []
): boolean {
  const siblingFiles = readdirSync(join(context.workspaceRoot, rootPath));
  const rootPathIsWorkspaceRoot = rootPath === '' || rootPath === '.';

  const containProjectJsonFile = siblingFiles.includes('project.json');
  const containPackageJsonFile = siblingFiles.includes('package.json');
  // if additional files provided, check that one exist in the path
  const containAdditionalProjectFile = additionalProjectFiles.some(
    (additionalFile) => siblingFiles.includes(additionalFile)
  );

  // Path is not considered as a project if it does not contain any project files
  if (
    !containProjectJsonFile &&
    !containPackageJsonFile &&
    !containAdditionalProjectFile
  ) {
    return false;
  }

  // Path is not considered as a project if the package.json is specified but not part of the root workspaces
  if (
    !containProjectJsonFile &&
    !containAdditionalProjectFile &&
    containPackageJsonFile &&
    !rootPathIsWorkspaceRoot
  ) {
    const path = joinPathFragments(rootPath, 'package.json');

    const packageManagerWorkspacesGlob = combineGlobPatterns(
      getGlobPatternsFromPackageManagerWorkspaces(context.workspaceRoot)
    );

    return minimatch(path, packageManagerWorkspacesGlob);
  }

  return true;
}
