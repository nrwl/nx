import { names } from '@nrwl/devkit';

export function getUnscopedLibName(libRoot: string) {
  return libRoot.substr(libRoot.lastIndexOf('/') + 1);
}

export function getE2eProjectName(
  targetProjectName: string,
  targetLibRoot: string,
  cypressDirectory?: string
) {
  if (cypressDirectory) {
    return `${filePathPrefix(cypressDirectory)}-${getUnscopedLibName(
      targetLibRoot
    )}-e2e`;
  }
  return `${targetProjectName}-e2e`;
}

export function filePathPrefix(directory: string) {
  return `${names(directory).fileName}`.replace(new RegExp('/', 'g'), '-');
}
