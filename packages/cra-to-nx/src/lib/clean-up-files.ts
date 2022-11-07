import { removeSync } from 'fs-extra';
import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

export function cleanUpFiles(appName: string) {
  // Delete targets from project since we delegate to npm scripts.
  const json = readJsonFile(`apps/${appName}/project.json`);
  delete json.targets;
  writeJsonFile(`apps/${appName}/project.json`, json);

  removeSync('temp-workspace');
}
