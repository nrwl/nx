import * as yargs from 'yargs';
import { runCommand } from '../tasks-runner/run-command';
import type { NxArgs, RawNxArgs } from './utils';
import { splitArgsIntoNxArgsAndOverrides } from './utils';
import { createProjectGraphAsync } from '../core/project-graph';
import type { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import { readEnvironment, workspaceLayout } from '../core/file-utils';
import { projectHasTarget } from '../utilities/project-graph-utils';
import { output } from '../utilities/output';
import { connectToNxCloudUsingScan } from './connect-to-nx-cloud';
import { performance } from 'perf_hooks';
import * as path from 'path';
import { sync as globSync } from 'glob';
import type { Environment } from '../core/shared-interfaces';

export async function runMany(parsedArgs: yargs.Arguments & RawNxArgs) {
  performance.mark('command-execution-begins');
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    parsedArgs,
    'run-many'
  );

  await connectToNxCloudUsingScan(nxArgs.scan);

  const projectGraph = await createProjectGraphAsync();
  const projects = projectsToRun(nxArgs, projectGraph);
  const projectsNotExcluded = applyExclude(projects, nxArgs);
  const env = readEnvironment();
  const filteredProjects = applyOnlyFailed(projectsNotExcluded, nxArgs, env);

  await runCommand(
    filteredProjects,
    projectGraph,
    env,
    nxArgs,
    overrides,
    nxArgs.hideCachedOutput ? 'hide-cached-output' : 'default',
    null
  );
}

function projectsToRun(nxArgs: NxArgs, projectGraph: ProjectGraph) {
  const allProjects = Object.values(projectGraph.nodes);
  if (nxArgs.all) {
    return runnableForTarget(allProjects, nxArgs.target).reduce(
      (m, c) => ((m[c.name] = c), m),
      {}
    );
  } else {
    checkForInvalidProjects(nxArgs, allProjects);

    // TODO: use groupBy
    const globPatterns = nxArgs.projects.filter((p) => p.endsWith('*'));
    const actuallProjectNames = nxArgs.projects.filter((p) => !p.endsWith('*'));

    const shouldGlobProjects = globPatterns.length;

    const { appsDir, libsDir } = workspaceLayout();

    const globbedAppProjects = shouldGlobProjects
      ? globPatterns
          .map((pattern) =>
            globSync(pattern, {
              cwd: path.resolve(appsDir),
            })
          )
          .flat()
      : [];

    const globbedLibProjects = shouldGlobProjects
      ? globPatterns
          .map((pattern) =>
            globSync(pattern, {
              cwd: path.resolve(libsDir),
            })
          )
          .flat()
      : [];

    let selectedProjectNames = Array.from(
      new Set(
        actuallProjectNames.concat(globbedAppProjects, globbedLibProjects)
      )
    );

    let selectedProjects = selectedProjectNames.map((name) =>
      allProjects.find((project) => project.name === name)
    );

    return runnableForTarget(selectedProjects, nxArgs.target, true).reduce(
      (m, c) => ((m[c.name] = c), m),
      {}
    );
  }
}

function applyExclude(
  projects: Record<string, ProjectGraphNode>,
  nxArgs: NxArgs
) {
  return Object.keys(projects)
    .filter((key) => !(nxArgs.exclude || []).includes(key))
    .reduce((p, key) => {
      p[key] = projects[key];
      return p;
    }, {} as Record<string, ProjectGraphNode>);
}

function applyOnlyFailed(
  projectsNotExcluded: Record<string, ProjectGraphNode>,
  nxArgs: NxArgs,
  env: Environment
) {
  return Object.values(projectsNotExcluded).filter(
    (n) => !nxArgs.onlyFailed || !env.workspaceResults.getResult(n.name)
  );
}

function checkForInvalidProjects(
  nxArgs: NxArgs,
  allProjects: ProjectGraphNode[]
) {
  const invalid = nxArgs.projects.filter(
    (name) => !(allProjects.find((p) => p.name === name) && name.endsWith('*'))
  );

  if (invalid.length !== 0) {
    throw new Error(`Invalid projects: ${invalid.join(', ')}`);
  }
}

function runnableForTarget(
  projects: ProjectGraphNode[],
  target: string,
  strict = false
): ProjectGraphNode[] {
  const notRunnable = [] as ProjectGraphNode[];
  const runnable = [] as ProjectGraphNode[];

  for (let project of projects) {
    if (projectHasTarget(project, target)) {
      runnable.push(project);
    } else {
      notRunnable.push(project);
    }
  }

  if (strict && notRunnable.length) {
    output.warn({
      title: `the following do not have configuration for "${target}"`,
      bodyLines: notRunnable.map((p) => `- ${p.name}`),
    });
  }

  return runnable;
}
