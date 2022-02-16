import * as yargs from 'yargs';
import { filterAffected } from '../core/affected-project-graph';
import { calculateFileChanges, readEnvironment } from '../core/file-utils';
import {
  createProjectGraphAsync,
  ProjectGraphNodeRecords,
  ProjectType,
  withDeps,
} from '../core/project-graph';
import { ProjectGraph, ProjectGraphProjectNode } from '@nrwl/devkit';
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

export async function affected(
  command: 'apps' | 'libs' | 'graph' | 'print-affected' | 'affected',
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
  const env = readEnvironment();

  try {
    switch (command) {
      case 'apps':
        const apps = projects
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
        const libs = projects
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

      case 'graph':
        const projectNames = projects.map((p) => p.name);
        await generateGraph(parsedArgs as any, projectNames);
        break;

      case 'print-affected':
        if (nxArgs.target) {
          const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
          await printAffected(
            projectsWithTarget,
            projects,
            projectGraph,
            env,
            nxArgs,
            overrides
          );
        } else {
          await printAffected(
            [],
            projects,
            projectGraph,
            env,
            nxArgs,
            overrides
          );
        }
        break;

      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
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

function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  let affectedGraph = nxArgs.all
    ? projectGraph
    : filterAffected(
        projectGraph,
        calculateFileChanges(
          parseFiles(nxArgs).files,
          projectGraph.allWorkspaceFiles,
          nxArgs
        )
      );
  if (!nxArgs.all && nxArgs.withDeps) {
    affectedGraph = withDeps(
      projectGraph,
      Object.values(affectedGraph.nodes) as ProjectGraphProjectNode[]
    );
  }

  if (nxArgs.exclude) {
    const excludedProjects = new Set(nxArgs.exclude);
    return Object.entries(affectedGraph.nodes as ProjectGraphNodeRecords)
      .filter(([projectName]) => !excludedProjects.has(projectName))
      .map(([, project]) => project);
  }

  return Object.values(affectedGraph.nodes) as ProjectGraphProjectNode[];
}

function allProjectsWithTarget(
  projects: ProjectGraphProjectNode[],
  nxArgs: NxArgs
) {
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
