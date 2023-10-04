import { removeSync } from 'fs-extra';
import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';

export function cleanUpFiles(appName: string, isStandalone: boolean) {
  // Delete targets from project since we delegate to npm scripts.
  const projectJsonPath = isStandalone
    ? 'project.json'
    : `apps/${appName}/project.json`;
  const json = readJsonFile(projectJsonPath);
  delete json.targets;
  if (isStandalone) {
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

  if (isStandalone) {
    removeSync('babel.config.json');
    removeSync('jest.preset.js');
    removeSync('jest.config.ts');
    removeSync('libs');
    removeSync('tools');
  }
}
