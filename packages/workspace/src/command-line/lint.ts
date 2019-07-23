import {
  getProjectNodes,
  allFilesInDir,
  readWorkspaceJson,
  readNxJson
} from './shared';
import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { output } from './output';

export function workspaceLint() {
  const nodes = getProjectNodes(readWorkspaceJson(), readNxJson());

  const cliErrorOutputConfigs = new WorkspaceIntegrityChecks(
    nodes,
    readAllFilesFromAppsAndLibs()
  ).run();

  if (cliErrorOutputConfigs.length > 0) {
    cliErrorOutputConfigs.forEach(errorConfig => {
      output.error(errorConfig);
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
