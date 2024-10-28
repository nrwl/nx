import { calculateFileChanges } from '../../project-graph/file-utils';
import { runCommand } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';
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
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { generateGraph } from '../graph/graph';
import { allFileData } from '../../utils/all-file-data';

export async function affected(
  command: 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = {
    excludeTaskDependencies: args.excludeTaskDependencies,
    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
  } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');

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

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = await getAffectedGraphNodes(nxArgs, projectGraph);

  try {
    switch (command) {
      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
        if (nxArgs.graph) {
          const projectNames = projectsWithTarget.map((t) => t.name);
          const file = readGraphFileFromGraphArg(nxArgs);

          return await generateGraph(
            {
              watch: true,
              open: true,
              view: 'tasks',
              targets: nxArgs.targets,
              projects: projectNames,
              file,
            },
            projectNames
          );
        } else {
          const status = await runCommand(
            projectsWithTarget,
            projectGraph,
            { nxJson },
            nxArgs,
            overrides,
            null,
            extraTargetDependencies,
            extraOptions
          );
          process.exit(status);
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
