import { runCommand } from '../tasks-runner/run-command';
import type { NxArgs } from '../utils/command-line-utils';
import { splitArgsIntoNxArgsAndOverrides } from '../utils/command-line-utils';
import { projectHasTarget } from '../utils/project-graph-utils';
import { connectToNxCloudIfExplicitlyAsked } from './connect';
import { performance } from 'perf_hooks';
import * as minimatch from 'minimatch';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { TargetDependencyConfig } from '../config/workspace-config-project-config';
import { readNxConfig } from '../config/configuration';
import { output } from '../utils/output';

export async function runMany(
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
  performance.mark('command-execution-begins');
  const nxConfig = readNxConfig();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: true },
    nxConfig
  );
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = projectsToRun(nxArgs, projectGraph);

  await runCommand(
    projects,
    projectGraph,
    { nxConfig },
    nxArgs,
    overrides,
    null,
    extraTargetDependencies,
    extraOptions
  );
}

export function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  const selectedProjects = new Map<string, ProjectGraphProjectNode>();
  const validProjects = runnableForTarget(projectGraph.nodes, nxArgs.target);
  const validProjectNames = Array.from(validProjects.keys());
  const invalidProjects: string[] = [];

  // --all is default now, if --projects is provided, it'll override the --all
  if (nxArgs.all && nxArgs.projects.length === 0) {
    for (const projectName of validProjects) {
      selectedProjects.set(projectName, projectGraph.nodes[projectName]);
    }
  } else {
    for (const nameOrGlob of nxArgs.projects) {
      if (validProjects.has(nameOrGlob)) {
        selectedProjects.set(nameOrGlob, projectGraph.nodes[nameOrGlob]);
        continue;
      } else if (projectGraph.nodes[nameOrGlob]) {
        invalidProjects.push(nameOrGlob);
        continue;
      }

      const matchedProjectNames = minimatch.match(
        validProjectNames,
        nameOrGlob
      );

      if (matchedProjectNames.length === 0) {
        throw new Error(`No projects matching: ${nameOrGlob}`);
      }

      matchedProjectNames.forEach((matchedProjectName) => {
        selectedProjects.set(
          matchedProjectName,
          projectGraph.nodes[matchedProjectName]
        );
      });
    }

    if (invalidProjects.length > 0) {
      output.warn({
        title: `the following do not have configuration for "${nxArgs.target}"`,
        bodyLines: invalidProjects.map((name) => `- ${name}`),
      });
    }
  }

  for (const nameOrGlob of nxArgs.exclude ?? []) {
    const project = selectedProjects.has(nameOrGlob);
    if (project) {
      selectedProjects.delete(nameOrGlob);
      continue;
    }

    const matchedProjects = minimatch.match(
      Array.from(selectedProjects.keys()),
      nameOrGlob
    );

    matchedProjects.forEach((matchedProjectName) => {
      selectedProjects.delete(matchedProjectName);
    });
  }

  return Array.from(selectedProjects.values());
}

function runnableForTarget(
  projects: Record<string, ProjectGraphProjectNode>,
  target: string
): Set<string> {
  const runnable = new Set<string>();
  for (let projectName in projects) {
    const project = projects[projectName];
    if (projectHasTarget(project, target)) {
      runnable.add(projectName);
    }
  }
  return runnable;
}
