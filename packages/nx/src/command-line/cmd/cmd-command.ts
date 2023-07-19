import { execSync } from 'child_process';
import { readNxJson } from '../../config/configuration';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { LARGE_BUFFER } from '../../executors/run-commands/run-commands.impl';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import {
  NxArgs,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { output } from '../../utils/output';
import { workspaceConfigurationCheck } from '../../utils/workspace-configuration-check';
import { workspaceRoot } from '../../utils/workspace-root';
import { runProjectsTopologically } from './run-projects-topologically';

export async function cmdCommand(args: { [k: string]: any }) {
  workspaceConfigurationCheck();
  const nxJson = readNxJson();
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: false },
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
  ) =>
    execSync(replaceCommandArgs(args.command, node), {
      cwd: node.data.root,
      stdio: 'inherit',
      maxBuffer: LARGE_BUFFER,
    });

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

function replaceCommandArgs(
  command: string,
  project: ProjectGraphProjectNode
): string {
  return command
    .replace(/\{workspaceRoot\}/g, workspaceRoot)
    .replace(/\{projectRoot\}/g, project.data.root)
    .replace(/\{projectName\}/g, project.name);
}
