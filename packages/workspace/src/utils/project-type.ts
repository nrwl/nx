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
