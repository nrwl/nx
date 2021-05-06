import {
  createProjectGraph,
  onlyWorkspaceProjects,
} from '../core/project-graph';
import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import { readWorkspaceFiles, workspaceLayout } from '../core/file-utils';
import { output } from '../utilities/output';
import * as path from 'path';

export function workspaceLint() {
  const graph = onlyWorkspaceProjects(createProjectGraph());

  const cliErrorOutputConfigs = new WorkspaceIntegrityChecks(
    graph,
    readAllFilesFromAppsAndLibs()
  ).run();

  if (cliErrorOutputConfigs.length > 0) {
    cliErrorOutputConfigs.forEach((errorConfig) => {
      output.error(errorConfig);
    });
    process.exit(1);
  }
}

function readAllFilesFromAppsAndLibs() {
  const wl = workspaceLayout();
  return readWorkspaceFiles()
    .map((f) => f.file)
    .filter(
      (f) => f.startsWith(`${wl.appsDir}/`) || f.startsWith(`${wl.libsDir}/`)
    )
    .filter((f) => !path.basename(f).startsWith('.'));
}
