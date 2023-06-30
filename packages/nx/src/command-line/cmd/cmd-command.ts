import { execSync } from 'child_process';
import { readNxJson } from '../../config/configuration';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import {
  NxArgs,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { output } from '../../utils/output';
import { workspaceConfigurationCheck } from '../../utils/workspace-configuration-check';
import { runProjectsTopologically } from './run-projects-topologically';

export async function cmdCommand(
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = { excludeTaskDependencies: false, loadDotEnvFiles: true } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
) {
  workspaceConfigurationCheck();
  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: args.graph !== 'stdout' },
    nxJson
  );

  args.verbose &&
    output.logSingleLine('running with args: ' + JSON.stringify(args));

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = projectsToRun(nxArgs, projectGraph);

  args.verbose &&
    output.log({
      title: 'running on projects:',
      bodyLines: projects.map((p) => p.name),
    });

  const runner: (node: ProjectGraphProjectNode) => Promise<unknown> = async (
    node
  ) => execSync(args.command, { cwd: node.data.root, stdio: 'inherit' });

  await runProjectsTopologically(projects, projectGraph, runner, {
    concurrency: nxArgs.parallel ?? 3,
  });
}

function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  const selectedProjects: Record<string, ProjectGraphProjectNode> = {};
  if (nxArgs.all && nxArgs.projects.length === 0) {
    for (const projectName of Object.keys(projectGraph.nodes)) {
      selectedProjects[projectName] = projectGraph.nodes[projectName];
    }
  } else {
    const matchingProjects = findMatchingProjects(
      nxArgs.projects,
      projectGraph.nodes
    );
    for (const project of matchingProjects) {
      selectedProjects[project] = projectGraph.nodes[project];
    }
  }

  const excludedProjects = findMatchingProjects(
    nxArgs.exclude,
    selectedProjects
  );

  for (const excludedProject of excludedProjects) {
    delete selectedProjects[excludedProject];
  }

  return Object.values(selectedProjects);
}
