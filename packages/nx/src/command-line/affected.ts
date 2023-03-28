import { calculateFileChanges } from '../project-graph/file-utils';
import { runCommand } from '../tasks-runner/run-command';
import { output } from '../utils/output';
import { generateGraph } from './dep-graph';
import { printAffected } from './print-affected';
import { connectToNxCloudIfExplicitlyAsked } from './connect';
import type { NxArgs } from '../utils/command-line-utils';
import {
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../utils/command-line-utils';
import { performance } from 'perf_hooks';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { projectHasTarget } from '../utils/project-graph-utils';
import { filterAffected } from '../project-graph/affected/affected-project-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { workspaceConfigurationCheck } from '../utils/workspace-configuration-check';

export async function affected(
  command: 'apps' | 'libs' | 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {}
): Promise<void> {
  performance.mark('command-execution-begins');
  workspaceConfigurationCheck();

  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings: command !== 'print-affected' && !args.plain,
    },
    nxJson
  );

  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = await projectsToRun(nxArgs, projectGraph);

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
                'Deprecated: Use "nx print-affected --type=app --select=projects" instead. This command will be removed in v16.',
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
                'Deprecated: Use "nx print-affected --type=lib --select=projects" instead. This command will be removed in v16.',
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
        if (nxArgs.targets && nxArgs.targets.length > 0) {
          await printAffected(
            allProjectsWithTarget(projects, nxArgs),
            projectGraph,
            { nxJson },
            nxArgs,
            overrides
          );
        } else {
          await printAffected(
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
        if (nxArgs.graph) {
          const projectNames = projectsWithTarget.map((t) => t.name);

          return await generateGraph(
            {
              watch: false,
              open: true,
              view: 'tasks',
              targets: nxArgs.targets,
              projects: projectNames,
            },
            projectNames
          );
        } else {
          await runCommand(
            projectsWithTarget,
            projectGraph,
            { nxJson },
            nxArgs,
            overrides,
            null,
            extraTargetDependencies,
            { excludeTaskDependencies: false, loadDotEnvFiles: true }
          );
        }
        break;
      }
    }
    await output.drain();
  } catch (e) {
    printError(e, args.verbose);
    process.exit(1);
  }
}

async function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): Promise<ProjectGraphProjectNode[]> {
  let affectedGraph = nxArgs.all
    ? projectGraph
    : await filterAffected(
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
  return projects.filter((p) =>
    nxArgs.targets.find((target) => projectHasTarget(p, target))
  );
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
