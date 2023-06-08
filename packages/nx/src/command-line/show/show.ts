import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import {
  calculateFileChanges,
  readNxJson,
} from '../../project-graph/file-utils';
import {
  NxArgs,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { NxJsonConfiguration } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { ShowProjectOptions, ShowProjectsOptions } from './command-object';
import { allFileData } from '../../utils/all-file-data';

export async function showProjectsHandler(
  args: ShowProjectsOptions
): Promise<void> {
  let graph = await createProjectGraphAsync();
  const nxJson = readNxJson();
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings: false,
    },
    nxJson
  );

  if (args.affected) {
    graph = await getAffectedGraph(nxArgs, nxJson, graph);
  }

  if (args.projects) {
    graph.nodes = getGraphNodesMatchingPatterns(graph, args.projects);
  }

  if (args.withTarget) {
    graph.nodes = Object.entries(graph.nodes).reduce((acc, [name, node]) => {
      if (node.data.targets?.[args.withTarget]) {
        acc[name] = node;
      }
      return acc;
    }, {} as ProjectGraph['nodes']);
  }

  const selectedProjects = new Set(Object.keys(graph.nodes));

  if (args.exclude) {
    const excludedProjects = findMatchingProjects(nxArgs.exclude, graph.nodes);
    for (const excludedProject of excludedProjects) {
      selectedProjects.delete(excludedProject);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(Array.from(selectedProjects), null, 2));
  } else {
    for (const project of selectedProjects) {
      console.log(project);
    }
  }
  process.exit(0);
}

export async function showProjectHandler(
  args: ShowProjectOptions
): Promise<void> {
  const graph = await createProjectGraphAsync();
  const node = graph.nodes[args.projectName];
  if (!node) {
    console.log(`Could not find project ${args.projectName}`);
    process.exit(1);
  }
  if (args.json) {
    console.log(JSON.stringify(node.data, null, 2));
  } else {
    const chalk = require('chalk') as typeof import('chalk');
    const logIfExists = (label, key: keyof typeof node['data']) => {
      if (node.data[key]) {
        console.log(`${chalk.bold(label)}: ${node.data[key]}`);
      }
    };

    logIfExists('Name', 'name');
    logIfExists('Root', 'root');
    logIfExists('Source Root', 'sourceRoot');
    logIfExists('Tags', 'tags');
    logIfExists('Implicit Dependencies', 'implicitDependencies');

    const targets = Object.entries(node.data.targets ?? {});
    const maxTargetNameLength = Math.max(...targets.map(([t]) => t.length));
    const maxExecutorNameLength = Math.max(
      ...targets.map(([, t]) => t?.executor?.length ?? 0)
    );

    if (targets.length > 0) {
      console.log(`${chalk.bold('Targets')}: `);
      for (const [target, targetConfig] of targets) {
        console.log(
          `- ${chalk.bold((target + ':').padEnd(maxTargetNameLength + 2))} ${(
            targetConfig?.executor ?? ''
          ).padEnd(maxExecutorNameLength + 2)} ${(() => {
            const configurations = Object.keys(
              targetConfig.configurations ?? {}
            );
            if (configurations.length) {
              return chalk.dim(configurations.join(', '));
            }
            return '';
          })()}`
        );
      }
    }
  }
  process.exit(0);
}

function getGraphNodesMatchingPatterns(
  graph: ProjectGraph,
  patterns: string[]
): ProjectGraph['nodes'] {
  const nodes: Record<string, ProjectGraphProjectNode> = {};
  const matches = findMatchingProjects(patterns, graph.nodes);
  for (const match of matches) {
    nodes[match] = graph.nodes[match];
  }
  return nodes;
}

async function getAffectedGraph(
  nxArgs: NxArgs,
  nxJson: NxJsonConfiguration<'*' | string[]>,
  graph: ProjectGraph
) {
  return filterAffected(
    graph,
    calculateFileChanges(parseFiles(nxArgs).files, await allFileData(), nxArgs),
    nxJson
  );
}
