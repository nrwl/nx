import { removeSync } from 'fs-extra';
import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

export function cleanUpFiles(appName: string, isNested: boolean) {
  // Delete targets from project since we delegate to npm scripts.
  const projectJsonPath = isNested
    ? 'project.json'
    : `apps/${appName}/project.json`;
  const json = readJsonFile(projectJsonPath);
  delete json.targets;
  if (isNested) {
    if (json.sourceRoot) {
      json.sourceRoot = json.sourceRoot.replace(`apps/${appName}/`, '');
    }
    if (json['$schema']) {
      json['$schema'] = json['$schema'].replace(
        '../../node_modules',
        'node_modules'
      );
    }
  }
  writeJsonFile(projectJsonPath, json);

  removeSync('temp-workspace');
}
