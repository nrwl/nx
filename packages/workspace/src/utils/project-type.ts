import { Tree } from '@angular-devkit/schematics';
import { getProjectConfig } from './ast-utils';
import { join, Path } from '@angular-devkit/core';

export enum ProjectType {
  Application = 'application',
  Library = 'library',
}

export function projectRootDir(projectType: ProjectType) {
  if (projectType == ProjectType.Application) {
    return 'apps';
  } else if (projectType == ProjectType.Library) {
    return 'libs';
  }
}

export function projectDir(projectType: ProjectType) {
  if (projectType == ProjectType.Application) {
    // apps/test-app/src/app
    return 'app';
  } else if (projectType == ProjectType.Library) {
    // libs/test-lib/src/lib
    return 'lib';
  }
}

export function projectRootPath(tree: Tree, projectName: string): string {
  const { sourceRoot: projectSrcRoot, projectType } = getProjectConfig(
    tree,
    projectName
  );
  return join(projectSrcRoot, projectDir(projectType));
}
