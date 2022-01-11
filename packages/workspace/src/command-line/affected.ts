import * as yargs from 'yargs';
import { filterAffected } from '../core/affected-project-graph';
import { calculateFileChanges, readEnvironment } from '../core/file-utils';
import {
  createProjectGraphAsync,
  ProjectType,
  withDeps,
} from '../core/project-graph';
import {
  ProjectGraph,
  ProjectGraphNode,
  ProjectGraphProjectNode,
} from '@nrwl/devkit';
import { runCommand } from '../tasks-runner/run-command';
import { output } from '../utilities/output';
import { projectHasTarget } from '../utilities/project-graph-utils';
import { generateGraph } from './dep-graph';
import { printAffected } from './print-affected';
import { connectToNxCloudUsingScan } from './connect-to-nx-cloud';
import { parseFiles } from './shared';
import type { NxArgs, RawNxArgs } from './utils';
import { splitArgsIntoNxArgsAndOverrides } from './utils';
import { performance } from 'perf_hooks';
import type { Environment } from '../core/shared-interfaces';

export async function affected(
  command: 'apps' | 'libs' | 'dep-graph' | 'print-affected' | 'affected',
  parsedArgs: yargs.Arguments & RawNxArgs
): Promise<void> {
  performance.mark('command-execution-begins');
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    parsedArgs,
    'affected',
    {
      printWarnings: command !== 'print-affected' && !parsedArgs.plain,
    }
  );

  await connectToNxCloudUsingScan(nxArgs.scan);

  const projectGraph = await createProjectGraphAsync();
  const projects = projectsToRun(nxArgs, projectGraph);
  const projectsNotExcluded = applyExclude(projects, nxArgs);
  const env = readEnvironment();
  const filteredProjects = applyOnlyFailed(projectsNotExcluded, nxArgs, env);

  try {
    switch (command) {
      case 'apps':
        const apps = filteredProjects
          .filter((p) => p.type === ProjectType.app)
          .map((p) => p.name);
        if (parsedArgs.plain) {
          console.log(apps.join(' '));
        } else {
          if (apps.length) {
            output.log({
              title: 'Affected apps:',
              bodyLines: apps.map((app) => `${output.colors.gray('-')} ${app}`),
            });
          }
        }
        break;

      case 'libs':
        const libs = filteredProjects
          .filter((p) => p.type === ProjectType.lib)
          .map((p) => p.name);
        if (parsedArgs.plain) {
          console.log(libs.join(' '));
        } else {
          if (libs.length) {
            output.log({
              title: 'Affected libs:',
              bodyLines: libs.map((lib) => `${output.colors.gray('-')} ${lib}`),
            });
          }
        }
        break;

      case 'dep-graph':
        const projectNames = filteredProjects.map((p) => p.name);
        await generateGraph(parsedArgs as any, projectNames);
        break;

      case 'print-affected':
        if (nxArgs.target) {
          const projectsWithTarget = allProjectsWithTarget(
            filteredProjects,
            nxArgs
          );
          await printAffected(
            projectsWithTarget,
            filteredProjects,
            projectGraph,
            env,
            nxArgs,
            overrides
          );
        } else {
          await printAffected(
            [],
            filteredProjects,
            projectGraph,
            env,
            nxArgs,
            overrides
          );
        }
        break;

      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(
          filteredProjects,
          nxArgs
        );
        await runCommand(
          projectsWithTarget,
          projectGraph,
          env,
          nxArgs,
          overrides,
          nxArgs.hideCachedOutput ? 'hide-cached-output' : 'default',
          null
        );
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

function projectsToRun(nxArgs: NxArgs, projectGraph: ProjectGraph) {
  if (nxArgs.all) return projectGraph.nodes;

  let affectedGraph = nxArgs.all
    ? projectGraph
    : filterAffected(
        projectGraph,
        calculateFileChanges(parseFiles(nxArgs).files, nxArgs)
      );
  if (nxArgs.withDeps) {
    affectedGraph = withDeps(
      projectGraph,
      Object.values(affectedGraph.nodes) as ProjectGraphProjectNode[]
    );
  }
  return affectedGraph.nodes;
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

function allProjectsWithTarget(projects: ProjectGraphNode[], nxArgs: NxArgs) {
  return projects.filter((p) => projectHasTarget(p, nxArgs.target));
}

function printError(e: any, verbose?: boolean) {
  const bodyLines = [e.message];
  if (verbose && e.stack) {
    bodyLines.push('');
    bodyLines.push(e.stack);
  }
  output.error({
    title: 'There was a critical error when running your command',
    bodyLines,
  });
}
