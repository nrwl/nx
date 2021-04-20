import { Tree } from '@nrwl/tao/src/shared/tree';
import { names, readProjectConfiguration } from '@nrwl/devkit';

export function getUnscopedLibName(host: Tree, projectName: string) {
  const libConfig = readProjectConfiguration(host, projectName);
  const libRoot = libConfig.root;
  return libRoot.substr(libRoot.lastIndexOf('/') + 1);
}

export function getE2eProjectName(
  host: Tree,
  projectName: string,
  cypressDirectory: string
) {
  if (cypressDirectory) {
    return `${filePathPrefix(cypressDirectory)}-${getUnscopedLibName(
      host,
      projectName
    )}-e2e`;
  }
  return `${projectName}-e2e`;
}

export function filePathPrefix(directory: string) {
  return `${names(directory).fileName}`.replace(new RegExp('/', 'g'), '-');
}
