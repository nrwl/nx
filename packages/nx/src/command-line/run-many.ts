import * as yargs from 'yargs';
import * as path from 'path';
import { runCommand } from '../tasks-runner/run-command';
import type { NxArgs, RawNxArgs } from '../utils/command-line-utils';
import { splitArgsIntoNxArgsAndOverrides } from '../utils/command-line-utils';
import { projectHasTarget } from '../utils/project-graph-utils';
import { output } from '../utils/output';
import { connectToNxCloudUsingScan } from './connect-to-nx-cloud';
import { performance } from 'perf_hooks';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { readEnvironment } from './read-environment';
import { sync as globSync } from 'glob';
import { groupBy } from 'lodash';
import { workspaceLayout } from '../project-graph/file-utils';

/**
 * Supported matching pattern types.
 *
 * Even --exlude args is also provided to exclude projects, it's better to use a single argument to handle project selection.
 */
type ProjectMatchingType =
  // --project="*-react-app"
  | 'globPatterns'
  // --project="!*-e2e"
  | 'excludePatterns'
  //  --project="web-app"
  | 'precisePatterns';

export async function runMany(parsedArgs: yargs.Arguments & RawNxArgs) {
  performance.mark('command-execution-begins');
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    parsedArgs,
    'run-many'
  );

  await connectToNxCloudUsingScan(nxArgs.scan);

  const projectGraph = await createProjectGraphAsync();
  const projects = projectsToRun(nxArgs, projectGraph);
  const env = readEnvironment();

  await runCommand(
    projects,
    projectGraph,
    env,
    nxArgs,
    overrides,
    nxArgs.hideCachedOutput ? 'hide-cached-output' : 'default',
    null
  );
}

function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  const allProjects = Object.values(projectGraph.nodes);
  const excludedProjects = new Set(nxArgs.exclude ?? []);

  if (nxArgs.all) {
    return runnableForTarget(allProjects, nxArgs.target).filter(
      (proj) => !excludedProjects.has(proj.name)
    );
  }

  checkForInvalidProjects(nxArgs, allProjects);

  const groupedProjectMatchingPatterns = groupBy(
    nxArgs.projects,
    groupPatterns
  ) as Record<ProjectMatchingType, string[]>;

  const {
    globPatterns = [],
    precisePatterns = [],
    // exclude patterns are shared in apps and libs globbing
    excludePatterns = [],
  } = groupedProjectMatchingPatterns;

  const ignorePatternsMatching = excludePatterns.map((p) =>
    p.startsWith('!') ? p.slice(1, p.length) : p
  );

  // skip when no valid glob patterns provided
  const shouldGlobProjects = Boolean(globPatterns.length);

  // here we assume that the name of projects in the two directories are not duplicated
  const { appsDir, libsDir } = workspaceLayout();

  // glob packages in appsDir
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

  // glob packages in libsDir
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

  const matchedProjectNodeList = allProjects.filter((project) =>
    Array.from(
      new Set(precisePatterns.concat(globbedAppProjects, globbedLibProjects))
    ).includes(project.name)
  );

  console.log('matchedProjectNodeList: ', matchedProjectNodeList);

  return runnableForTarget(matchedProjectNodeList, nxArgs.target, true).filter(
    (proj) => !excludedProjects.has(proj.name)
  );
}

function checkForInvalidProjects(
  nxArgs: NxArgs,
  allProjects: ProjectGraphProjectNode[]
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
  projects: ProjectGraphProjectNode[],
  target: string,
  strict = false
): ProjectGraphProjectNode[] {
  const notRunnable = [] as ProjectGraphProjectNode[];
  const runnable = [] as ProjectGraphProjectNode[];

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

/**
 * Only support wildcard `*` in the start or in the end
 * @param pattern matching pattern
 * @returns
 */
function isValidWildcardMatchingPattern(pattern: string): boolean {
  return (
    pattern.endsWith('*') || pattern.startsWith('!') || pattern.startsWith('*')
  );
}

function groupPatterns(pattern: string): ProjectMatchingType {
  return isValidWildcardMatchingPattern(pattern)
    ? pattern.startsWith('!')
      ? 'excludePatterns'
      : 'globPatterns'
    : 'precisePatterns';
}
