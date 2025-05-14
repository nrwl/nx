import { rmSync } from 'node:fs';
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

  rmSync('temp-workspace', { recursive: true, force: true });

  if (isStandalone) {
    rmSync('babel.config.json', { recursive: true, force: true });
    rmSync('jest.preset.js', { recursive: true, force: true });
    rmSync('jest.config.ts', { recursive: true, force: true });
    rmSync('libs', { recursive: true, force: true });
    rmSync('tools', { recursive: true, force: true });
  }
}
