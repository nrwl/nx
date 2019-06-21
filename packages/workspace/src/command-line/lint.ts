import {
  getProjectNodes,
  allFilesInDir,
  readAngularJson,
  readNxJson
} from './shared';
import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';

export function lint() {
  const nodes = getProjectNodes(readAngularJson(), readNxJson());

  const errorGroups = new WorkspaceIntegrityChecks(
    nodes,
    readAllFilesFromAppsAndLibs()
  ).run();
  if (errorGroups.length > 0) {
    errorGroups.forEach(g => {
      console.error(`${g.header}:`);
      g.errors.forEach(e => console.error(e));
      console.log('');
    });
    process.exit(1);
  }
}

function readAllFilesFromAppsAndLibs() {
  return [
    ...allFilesInDir(`${appRootPath}/apps`).map(f => f.file),
    ...allFilesInDir(`${appRootPath}/libs`).map(f => f.file)
  ].filter(f => !path.basename(f).startsWith('.'));
}
