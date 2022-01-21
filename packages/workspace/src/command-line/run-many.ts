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
import groupBy = require('lodash.groupby');

type ProjectMatchingType =
  | 'globPatterns'
  | 'ignorePatterns'
  | 'specificPatterns';

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

    const groupedProjectMatchingPatterns = groupBy(nxArgs.projects, (p) =>
      isValidWildcardMatchingPattern(p)
        ? isIgnorePattern(p)
          ? 'ignorePatterns'
          : 'globPatterns'
        : 'specificPatterns'
    ) as unknown as Record<ProjectMatchingType, string[]>;

    const {
      globPatterns = [],
      specificPatterns = [],
      // ignore patterns are shared in apps and libs globbing
      ignorePatterns = [],
    } = groupedProjectMatchingPatterns;

    // double check
    const ignorePatternsMatching = ignorePatterns.map((p) =>
      p.startsWith('!') ? p.slice(1, p.length) : p
    );

    const shouldGlobProjects = Boolean(globPatterns.length);

    // usage with appsDir/libsDir prefix is not supported as we think apps package and libs package should not use the same name
    const { appsDir, libsDir } = workspaceLayout();

    // glob packages inside appsDir
    const globbedAppProjects = shouldGlobProjects
      ? globPatterns
          .map((pattern) =>
            globSync(pattern, {
              cwd: path.resolve(appsDir),
              ignore: ignorePatternsMatching,
            })
          )
          .flat()
      : [];

    // glob packages inside libsDir
    const globbedLibProjects = shouldGlobProjects
      ? globPatterns
          .map((pattern) =>
            globSync(pattern, {
              cwd: path.resolve(libsDir),
              ignore: ignorePatternsMatching,
            })
          )
          .flat()
      : [];

    const validProjectList = allProjects.filter((project) =>
      Array.from(
        new Set(specificPatterns.concat(globbedAppProjects, globbedLibProjects))
      ).includes(project.name)
    );

    return runnableForTarget(validProjectList, nxArgs.target, true).reduce(
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
    (name) =>
      !(
        allProjects.find((p) => p.name === name) ||
        isValidWildcardMatchingPattern(name)
      )
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

// nx run-many --project='nx-plugin-*'
function isValidWildcardMatchingPattern(pattern: string): boolean {
  return (
    pattern.endsWith('*') || pattern.startsWith('!') || pattern.startsWith('*')
  );
}

function isIgnorePattern(pattern: string): boolean {
  return pattern.startsWith('!');
}
