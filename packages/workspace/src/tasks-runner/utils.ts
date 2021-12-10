import {
  getPackageManagerCommand,
  ProjectGraph,
  ProjectGraphNode,
  TargetDependencyConfig,
  Task,
  TaskGraph,
} from '@nrwl/devkit';
import { flatten } from 'flat';
import { output } from '../utilities/output';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { mergeNpmScriptsWithTargets } from '../utilities/project-graph-utils';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  loadNxPlugins,
  mergePluginTargetsWithNxTargets,
} from '@nrwl/tao/src/shared/nx-plugin';

export function getCommandAsString(task: Task) {
  const execCommand = getPackageManagerCommand().exec;
  const args = getCommandArgsForTask(task);
  return [execCommand, 'nx', ...args].join(' ').trim();
}

export function getDependencyConfigs(
  { project, target }: { project: string; target: string },
  defaultDependencyConfigs: Record<string, TargetDependencyConfig[]>,
  projectGraph: ProjectGraph
): TargetDependencyConfig[] | undefined {
  // DependencyConfigs configured in workspace.json override configurations at the root.
  const dependencyConfigs =
    projectGraph.nodes[project].data?.targets[target]?.dependsOn ??
    defaultDependencyConfigs[target] ??
    [];

  for (const dependencyConfig of dependencyConfigs) {
    if (
      dependencyConfig.projects !== 'dependencies' &&
      dependencyConfig.projects !== 'self'
    ) {
      output.error({
        title: `dependsOn is improperly configured for ${project}:${target}`,
        bodyLines: [
          `dependsOn.projects is ${dependencyConfig.projects} but should be "self" or "dependencies"`,
        ],
      });
      process.exit(1);
    }
  }
  return dependencyConfigs;
}

export function getOutputs(p: Record<string, ProjectGraphNode>, task: Task) {
  return getOutputsForTargetAndConfiguration(task, p[task.target.project]);
}

export function getOutputsForTargetAndConfiguration(
  task: Pick<Task, 'target' | 'overrides'>,
  node: ProjectGraphNode
) {
  const { target, configuration } = task.target;

  const targets = node.data.targets[target];

  const options = {
    ...targets.options,
    ...targets?.configurations?.[configuration],
    ...task.overrides,
  };

  if (targets?.outputs) {
    return targets.outputs
      .map((output: string) => interpolateOutputs(output, options))
      .filter((output) => !!output);
  }

  // Keep backwards compatibility in case `outputs` doesn't exist
  if (options.outputPath) {
    return Array.isArray(options.outputPath)
      ? options.outputPath
      : [options.outputPath];
  } else if (target === 'build' || target === 'prepare') {
    return [
      `dist/${node.data.root}`,
      `${node.data.root}/dist`,
      `${node.data.root}/build`,
      `${node.data.root}/public`,
    ];
  } else {
    return [];
  }
}

export function unparse(options: Object): string[] {
  const unparsed = [];
  for (const key of Object.keys(options)) {
    const value = options[key];
    unparseOption(key, value, unparsed);
  }

  return unparsed;
}

function unparseOption(key: string, value: any, unparsed: string[]) {
  if (value === true) {
    unparsed.push(`--${key}`);
  } else if (value === false) {
    unparsed.push(`--no-${key}`);
  } else if (Array.isArray(value)) {
    value.forEach((item) => unparseOption(key, item, unparsed));
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    const flattened = flatten<any, any>(value, { safe: true });
    for (const flattenedKey in flattened) {
      unparseOption(
        `${key}.${flattenedKey}`,
        flattened[flattenedKey],
        unparsed
      );
    }
  } else if (
    typeof value === 'string' &&
    stringShouldBeWrappedIntoQuotes(value)
  ) {
    const sanitized = value.replace(/"/g, String.raw`\"`);
    unparsed.push(`--${key}="${sanitized}"`);
  } else if (value != null) {
    unparsed.push(`--${key}=${value}`);
  }
}

function stringShouldBeWrappedIntoQuotes(str: string) {
  return str.includes(' ') || str.includes('{') || str.includes('"');
}

function interpolateOutputs(template: string, data: any): string {
  return template.replace(/{([\s\S]+?)}/g, (match: string) => {
    let value = data;
    let path = match.slice(1, -1).trim().split('.').slice(1);
    for (let idx = 0; idx < path.length; idx++) {
      if (!value[path[idx]]) {
        return;
      }
      value = value[path[idx]];
    }

    return value;
  });
}

export function getExecutorNameForTask(task: Task, workspace: Workspaces) {
  const workspaceConfiguration = workspace.readWorkspaceConfiguration();
  const project = workspaceConfiguration.projects[task.target.project];

  if (existsSync(join(project.root, 'package.json'))) {
    project.targets = mergeNpmScriptsWithTargets(project.root, project.targets);
  }
  project.targets = mergePluginTargetsWithNxTargets(
    project.root,
    project.targets,
    loadNxPlugins(workspaceConfiguration.plugins)
  );

  if (!project.targets[task.target.target]) {
    throw new Error(
      `Cannot find configuration for task ${task.target.project}:${task.target.target}`
    );
  }

  return project.targets[task.target.target].executor;
}

export function getExecutorForTask(task: Task, workspace: Workspaces) {
  const executor = getExecutorNameForTask(task, workspace);
  const [nodeModule, executorName] = executor.split(':');

  return workspace.readExecutor(nodeModule, executorName);
}

export function getCustomHasher(task: Task, workspace: Workspaces) {
  try {
    const factory = getExecutorForTask(task, workspace).hasherFactory;
    return factory ? factory() : null;
  } catch (e) {
    console.error(e);
    throw new Error(`Unable to load hasher for task "${task.id}"`);
  }
}

export function removeTasksFromTaskGraph(
  graph: TaskGraph,
  ids: string[]
): TaskGraph {
  const tasks = {};
  const dependencies = {};
  const removedSet = new Set(ids);
  for (let taskId of Object.keys(graph.tasks)) {
    if (!removedSet.has(taskId)) {
      tasks[taskId] = graph.tasks[taskId];
      dependencies[taskId] = graph.dependencies[taskId].filter(
        (depTaskId) => !removedSet.has(depTaskId)
      );
    }
  }
  return {
    tasks,
    dependencies: dependencies,
    roots: Object.keys(dependencies).filter(
      (k) => dependencies[k].length === 0
    ),
  };
}

export function calculateReverseDeps(
  taskGraph: TaskGraph
): Record<string, string[]> {
  const reverseTaskDeps: Record<string, string[]> = {};
  Object.keys(taskGraph.tasks).forEach((t) => {
    reverseTaskDeps[t] = [];
  });

  Object.keys(taskGraph.dependencies).forEach((taskId) => {
    taskGraph.dependencies[taskId].forEach((d) => {
      reverseTaskDeps[d].push(taskId);
    });
  });

  return reverseTaskDeps;
}

export function getCliPath(workspaceRoot: string) {
  const cli = require.resolve(`@nrwl/cli/lib/run-cli.js`, {
    paths: [workspaceRoot],
  });
  return `${cli}`;
}

export function getCommandArgsForTask(task: Task) {
  const args: string[] = unparse(task.overrides || {});

  const target = task.target.target.includes(':')
    ? `"${task.target.target}"`
    : task.target.target;

  const config = task.target.configuration
    ? `:${task.target.configuration}`
    : '';

  return ['run', `${task.target.project}:${target}${config}`, ...args];
}
