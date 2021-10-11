import {
  createProjectGraphAsync,
  onlyWorkspaceProjects,
  ProjectGraph,
} from '../core/project-graph';
import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import { workspaceLayout } from '../core/file-utils';
import { output } from '../utilities/output';
import * as path from 'path';

export async function workspaceLint(): Promise<void> {
  const projectGraph = await createProjectGraphAsync('4.0');
  const graph = onlyWorkspaceProjects(projectGraph);

  const cliErrorOutputConfigs = new WorkspaceIntegrityChecks(
    graph,
    readAllFilesFromAppsAndLibs(projectGraph)
  ).run();

  if (cliErrorOutputConfigs.length > 0) {
    cliErrorOutputConfigs.forEach((errorConfig) => {
      output.error(errorConfig);
    });
    process.exit(1);
  }
}

function readAllFilesFromAppsAndLibs(projectGraph: ProjectGraph) {
  const wl = workspaceLayout();
  const allWorkspaceFiles = [];
  Object.values(projectGraph.nodes).forEach((f) => {
    allWorkspaceFiles.push(...f.data.files);
  });
  return allWorkspaceFiles
    .map((f) => f.file)
    .filter(
      (f) => f.startsWith(`${wl.appsDir}/`) || f.startsWith(`${wl.libsDir}/`)
    )
    .filter((f) => !path.basename(f).startsWith('.'));
}
