import { names } from '@nx/devkit';
import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export function getUnscopedLibName(libRoot: string) {
  return libRoot.slice(libRoot.lastIndexOf('/') + 1);
}

export function getE2eProjectName(
  targetProjectName: string,
  targetLibRoot: string,
  cypressDirectory?: string,
  nameAndProjectRootFormat: ProjectNameAndRootFormat = 'as-provided'
) {
  if (cypressDirectory && nameAndProjectRootFormat !== 'as-provided') {
    return `${filePathPrefix(cypressDirectory)}-${getUnscopedLibName(
      targetLibRoot
    )}-e2e`;
  }
  return `${targetProjectName}-e2e`;
}

export function filePathPrefix(directory: string) {
  return `${names(directory).fileName}`.replace(new RegExp('/', 'g'), '-');
}
