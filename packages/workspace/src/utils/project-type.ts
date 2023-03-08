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
