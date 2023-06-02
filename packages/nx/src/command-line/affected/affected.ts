import { calculateFileChanges } from '../../project-graph/file-utils';
import { runCommand } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';
import { printAffected } from './print-affected';
import { connectToNxCloudIfExplicitlyAsked } from '../connect/connect-to-nx-cloud';
import type { NxArgs } from '../../utils/command-line-utils';
import {
  parseFiles,
  readGraphFileFromGraphArg,
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
import { generateGraph } from '../graph/graph';
import { allFileData } from '../../utils/all-file-data';
import { NX_PREFIX, logger } from '../../utils/logger';
import { affectedGraphDeprecationMessage } from './command-object';

export async function affected(
  command: 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {}
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
  workspaceConfigurationCheck();

  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings:
        command !== 'print-affected' && !args.plain && args.graph !== 'stdout',
    },
    nxJson
  );

  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = await getAffectedGraphNodes(nxArgs, projectGraph);

  try {
    switch (command) {
      case 'graph':
        logger.warn([NX_PREFIX, affectedGraphDeprecationMessage].join(' '));
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
          const file = readGraphFileFromGraphArg(nxArgs);

          return await generateGraph(
            {
              watch: false,
              open: true,
              view: 'tasks',
              targets: nxArgs.targets,
              projects: projectNames,
              file,
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

export async function getAffectedGraphNodes(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): Promise<ProjectGraphProjectNode[]> {
  let affectedGraph = nxArgs.all
    ? projectGraph
    : await filterAffected(
        projectGraph,
        calculateFileChanges(
          parseFiles(nxArgs).files,
          await allFileData(),
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
