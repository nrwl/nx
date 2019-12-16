import {
  createProjectGraph,
  onlyWorkspaceProjects
} from '../core/project-graph';
import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { allFilesInDir } from '../core/file-utils';
import { output } from '../utils/output';

export function workspaceLint() {
  const graph = onlyWorkspaceProjects(createProjectGraph());

  const cliErrorOutputConfigs = new WorkspaceIntegrityChecks(
    graph,
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
