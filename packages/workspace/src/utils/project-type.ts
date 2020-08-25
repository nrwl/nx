export enum ProjectType {
  Application = 'application',
  Library = 'library',
}

/**
 *
 * @throws {TypeError}
 */
export function projectRootDir(projectType: ProjectType) {
  if (projectType == ProjectType.Application) {
    return 'apps';
  }
  if (projectType == ProjectType.Library) {
    return 'libs';
  }

  throw new TypeError(
    `You provided projectType=${projectType}, which is invalid. Use 'ProjectType' enum`
  );
}
