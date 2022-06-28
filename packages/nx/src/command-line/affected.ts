import * as yargs from 'yargs';
import { calculateFileChanges } from '../project-graph/file-utils';
import { runCommand } from '../tasks-runner/run-command';
import { output } from '../utils/output';
import { generateGraph } from './dep-graph';
import { printAffected } from './print-affected';
import { connectToNxCloudUsingScan } from './connect-to-nx-cloud';
import type { NxArgs, RawNxArgs } from '../utils/command-line-utils';
import {
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../utils/command-line-utils';
import { performance } from 'perf_hooks';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { projectHasTarget } from '../utils/project-graph-utils';
import { filterAffected } from '../project-graph/affected/affected-project-graph';
import { TargetDependencyConfig } from 'nx/src/config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';

export async function affected(
  command: 'apps' | 'libs' | 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {}
): Promise<void> {
  performance.mark('command-execution-begins');
  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings: command !== 'print-affected' && !args.plain,
    },
    nxJson
  );

  await connectToNxCloudUsingScan(nxArgs.scan);

  const projectGraph = await createProjectGraphAsync();
  const projects = projectsToRun(nxArgs, projectGraph);

  try {
    switch (command) {
      case 'apps':
        const apps = projects
          .filter((p) => p.type === 'app')
          .map((p) => p.name);
        if (args.plain) {
          console.log(apps.join(' '));
        } else {
          if (apps.length) {
            output.warn({
              title:
                'Deprecated: Use "nx print-affected --type=app --select=projects" instead. This command will be removed in v15.',
            });
            output.log({
              title: 'Affected apps:',
              bodyLines: apps.map((app) => `${output.dim('-')} ${app}`),
            });
          }
        }
        break;

      case 'libs':
        const libs = projects
          .filter((p) => p.type === 'lib')
          .map((p) => p.name);
        if (args.plain) {
          console.log(libs.join(' '));
        } else {
          if (libs.length) {
            output.warn({
              title:
                'Deprecated: Use "nx print-affected --type=lib --select=projects" instead. This command will be removed in v15.',
            });
            output.log({
              title: 'Affected libs:',
              bodyLines: libs.map((lib) => `${output.dim('-')} ${lib}`),
            });
          }
        }
        break;

      case 'graph':
        const projectNames = projects.map((p) => p.name);
        await generateGraph(args as any, projectNames);
        break;

      case 'print-affected':
        if (nxArgs.target) {
          const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
          await printAffected(
            projectsWithTarget,
            projects,
            projectGraph,
            { nxJson },
            nxArgs,
            overrides
          );
        } else {
          await printAffected(
            [],
            projects,
            projectGraph,
            { nxJson },
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
          { nxJson },
          nxArgs,
          overrides,
          null,
          extraTargetDependencies
        );
        break;
      }
    }
  } catch (e) {
    printError(e, args.verbose);
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

  if (nxArgs.exclude) {
    const excludedProjects = new Set(nxArgs.exclude);
    return Object.entries(affectedGraph.nodes)
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
