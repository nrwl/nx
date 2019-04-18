import {
  getProjectNodes,
  allFilesInDir,
  readAngularJson,
  readNxJson
} from './shared';
import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import * as appRoot from 'app-root-path';
import * as path from 'path';

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
    ...allFilesInDir(`${appRoot.path}/apps`).map(f => f.file),
    ...allFilesInDir(`${appRoot.path}/libs`).map(f => f.file)
  ].filter(f => !path.basename(f).startsWith('.'));
}
