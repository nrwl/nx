import { names } from '@nrwl/devkit';

export function normalizeDirectory(appName: string, directoryName: string) {
  return directoryName
    ? `${names(directoryName).fileName}/${names(appName).fileName}`
    : names(appName).fileName;
}

export function normalizeProjectName(appName: string, directoryName: string) {
  return normalizeDirectory(appName, directoryName)
    .replace(new RegExp('/', 'g'), '-')
    .replace(/-\d+/g, '');
}
