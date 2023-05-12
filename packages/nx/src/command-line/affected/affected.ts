import { calculateFileChanges } from '../../project-graph/file-utils';
import { runCommand } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';
import { generateGraph } from '../graph/graph';
import { printAffected } from './print-affected';
import { connectToNxCloudIfExplicitlyAsked } from '../connect/connect-to-nx-cloud';
import type { NxArgs } from '../../utils/command-line-utils';
import {
  getMergeBase,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { performance } from 'perf_hooks';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { readNxJson } from '../../config/configuration';
import { workspaceConfigurationCheck } from '../../utils/workspace-configuration-check';
import { findMatchingProjects } from '../../utils/find-matching-projects';

export async function affected(
  command: 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {}
): Promise<void> {
  performance.mark('command-execution-begins');
  workspaceConfigurationCheck();

  const nxJson = readNxJson();
  const isBaseOriginallySet = Boolean(args.base || process.env.NX_BASE);
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
      case 'graph':
        await generateGraph(
          { ...(args as any), isBaseOriginallySet },
          async (projectGraph, args) => {
            recalculateBaseAndHead(args);
            return (await projectsToRun(args, projectGraph)).map((p) => p.name);
          }
        );
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
        if (nxArgs.graph) {
          return await generateGraph(
            {
              watch: false,
              open: true,
              view: 'tasks',
              targets: nxArgs.targets,
            },
            async (projectGraph, args) => {
              const projects = await projectsToRun(args, projectGraph);
              return allProjectsWithTarget(projects, args).map((t) => t.name);
            }
          );
        } else {
          const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
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
    const excludedProjects = new Set(
      findMatchingProjects(nxArgs.exclude, affectedGraph.nodes)
    );

    return Object.entries(affectedGraph.nodes)
      .filter(([projectName]) => !excludedProjects.has(projectName))
      .map(([, project]) => project);
  }

  return Object.values(affectedGraph.nodes);
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

function recalculateBaseAndHead(options: {
  base?: string;
  head?: string;
  isBaseOriginallySet?: boolean;
}) {
  options.base = options.isBaseOriginallySet ? options.base : undefined;
  if (!options.base && process.env.NX_BASE) {
    options.base = process.env.NX_BASE;
  }
  if (!options.head && process.env.NX_HEAD) {
    options.head = process.env.NX_HEAD;
  }

  if (!options.base) {
    const nxJson = readNxJson();
    options.base = nxJson.affected?.defaultBase || 'main';
  }

  if (options.base) {
    options.base = getMergeBase(options.base, options.head);
  }
}
