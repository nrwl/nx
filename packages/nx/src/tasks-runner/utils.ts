import { output } from '../utils/output';
import { relative } from 'path';
import { join } from 'path/posix';
import { Task, TaskGraph } from '../config/task-graph';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import {
  TargetConfiguration,
  TargetDependencyConfig,
} from '../config/workspace-json-project-json';
import { workspaceRoot } from '../utils/workspace-root';
import { joinPathFragments } from '../utils/path';
import { isRelativePath } from '../utils/fileutils';
import { serializeOverridesIntoCommandLine } from '../utils/serialize-overrides-into-command-line';
import { splitByColons } from '../utils/split-target';
import { getExecutorInformation } from '../command-line/run/executor-utils';
import { CustomHasher, ExecutorConfig } from '../config/misc-interfaces';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { findMatchingProjects } from '../utils/find-matching-projects';
import { minimatch } from 'minimatch';
import { isGlobPattern } from '../utils/globs';
import {
  getTransformableOutputs,
  validateOutputs as nativeValidateOutputs,
} from '../native';

export type NormalizedTargetDependencyConfig = TargetDependencyConfig & {
  projects: string[];
};

export function getDependencyConfigs(
  { project, target }: { project: string; target: string },
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>,
  projectGraph: ProjectGraph,
  allTargetNames: string[]
): NormalizedTargetDependencyConfig[] | undefined {
  const dependencyConfigs = (
    projectGraph.nodes[project].data?.targets[target]?.dependsOn ??
    // This is passed into `run-command` from programmatic invocations
    extraTargetDependencies[target] ??
    []
  ).flatMap((config) =>
    normalizeDependencyConfigDefinition(
      config,
      project,
      projectGraph,
      allTargetNames
    )
  );
  return dependencyConfigs;
}

export function normalizeDependencyConfigDefinition(
  definition: string | TargetDependencyConfig,
  currentProject: string,
  graph: ProjectGraph,
  allTargetNames: string[]
): NormalizedTargetDependencyConfig[] {
  return expandWildcardTargetConfiguration(
    normalizeDependencyConfigProjects(
      expandDependencyConfigSyntaxSugar(definition, graph),
      currentProject,
      graph
    ),
    allTargetNames
  );
}

export function normalizeDependencyConfigProjects(
  dependencyConfig: TargetDependencyConfig,
  currentProject: string,
  graph: ProjectGraph
): NormalizedTargetDependencyConfig {
  const noStringConfig =
    normalizeTargetDependencyWithStringProjects(dependencyConfig);

  if (noStringConfig.projects) {
    dependencyConfig.projects = findMatchingProjects(
      noStringConfig.projects,
      graph.nodes
    );
  } else if (!noStringConfig.dependencies) {
    dependencyConfig.projects = [currentProject];
  }
  return dependencyConfig as NormalizedTargetDependencyConfig;
}

export function expandDependencyConfigSyntaxSugar(
  dependencyConfigString: string | TargetDependencyConfig,
  graph: ProjectGraph
): TargetDependencyConfig {
  if (typeof dependencyConfigString !== 'string') {
    return dependencyConfigString;
  }

  const [dependencies, targetString] = dependencyConfigString.startsWith('^')
    ? [true, dependencyConfigString.substring(1)]
    : [false, dependencyConfigString];

  // Support for `project:target` syntax doesn't make sense for
  // dependencies, so we only support `target` syntax for dependencies.
  if (dependencies) {
    return {
      target: targetString,
      dependencies: true,
    };
  }

  const { projects, target } = readProjectAndTargetFromTargetString(
    targetString,
    graph.nodes
  );

  return projects ? { projects, target } : { target };
}

// Weakmap let's the cache get cleared by garbage collector if allTargetNames is no longer used
const patternResultCache = new WeakMap<
  string[],
  // Map< Pattern, Dependency Configs >
  Map<string, string[]>
>();

function findMatchingTargets(pattern: string, allTargetNames: string[]) {
  let cache = patternResultCache.get(allTargetNames);
  if (!cache) {
    cache = new Map();
    patternResultCache.set(allTargetNames, cache);
  }

  const cachedResult = cache.get(pattern);
  if (cachedResult) {
    return cachedResult;
  }

  const matcher = minimatch.filter(pattern);

  const matchingTargets = allTargetNames.filter((t) => matcher(t));
  cache.set(pattern, matchingTargets);
  return matchingTargets;
}

export function expandWildcardTargetConfiguration(
  dependencyConfig: NormalizedTargetDependencyConfig,
  allTargetNames: string[]
): NormalizedTargetDependencyConfig[] {
  if (!isGlobPattern(dependencyConfig.target)) {
    return [dependencyConfig];
  }

  const matchingTargets = findMatchingTargets(
    dependencyConfig.target,
    allTargetNames
  );

  return matchingTargets.map((t) => ({
    target: t,
    projects: dependencyConfig.projects,
    dependencies: dependencyConfig.dependencies,
  }));
}

export function readProjectAndTargetFromTargetString(
  targetString: string,
  projects: Record<string, ProjectGraphProjectNode>
): { projects?: string[]; target: string } {
  // Support for both `project:target` and `target:with:colons` syntax
  const [maybeProject, ...segments] = splitByColons(targetString);

  if (!segments.length) {
    // if no additional segments are provided, then the string references
    // a target of the same project
    return { target: maybeProject };
  } else if (maybeProject in projects) {
    // Only the first segment could be a project. If it is, the rest is a target.
    // If its not, then the whole targetString was a target with colons in its name.
    return { projects: [maybeProject], target: segments.join(':') };
  } else {
    // If the first segment is a project, then we have a specific project. Otherwise, we don't.
    return { target: targetString };
  }
}

export function getOutputs(
  p: Record<string, ProjectGraphProjectNode>,
  target: Task['target'],
  overrides: Task['overrides']
) {
  return getOutputsForTargetAndConfiguration(
    target,
    overrides,
    p[target.project]
  );
}

export function normalizeTargetDependencyWithStringProjects(
  dependencyConfig: TargetDependencyConfig
): Omit<TargetDependencyConfig, 'projects'> & { projects: string[] } {
  if (typeof dependencyConfig.projects === 'string') {
    /** LERNA SUPPORT START - Remove in v20 */
    // Lerna uses `dependencies` in `prepNxOptions`, so we need to maintain
    // support for it until lerna can be updated to use the syntax.
    //
    // This should have been removed in v17, but the updates to lerna had not
    // been made yet.
    //
    // TODO(@agentender): Remove this part in v20
    if (dependencyConfig.projects === 'self') {
      delete dependencyConfig.projects;
    } else if (dependencyConfig.projects === 'dependencies') {
      dependencyConfig.dependencies = true;
      delete dependencyConfig.projects;
      /** LERNA SUPPORT END - Remove in v20 */
    } else {
      dependencyConfig.projects = [dependencyConfig.projects];
    }
  }
  return dependencyConfig as Omit<TargetDependencyConfig, 'projects'> & {
    projects: string[];
  };
}

class InvalidOutputsError extends Error {
  constructor(public outputs: string[], public invalidOutputs: Set<string>) {
    super(InvalidOutputsError.createMessage(invalidOutputs));
  }

  private static createMessage(invalidOutputs: Set<string>) {
    const invalidOutputsList =
      '\n - ' + Array.from(invalidOutputs).join('\n - ');
    return `The following outputs are invalid:${invalidOutputsList}\nPlease run "nx repair" to repair your configuration`;
  }
}

function assertOutputsAreValidType(outputs: unknown) {
  if (!Array.isArray(outputs)) {
    throw new Error("The 'outputs' field must be an array");
  }

  const typesArray = [];
  let hasInvalidType = false;
  for (const output of outputs) {
    if (typeof output !== 'string') {
      hasInvalidType = true;
    }
    typesArray.push(typeof output);
  }

  if (hasInvalidType) {
    throw new Error(
      `The 'outputs' field must contain only strings, but received types: [${typesArray.join(
        ', '
      )}]`
    );
  }
}

export function validateOutputs(outputs: string[]) {
  assertOutputsAreValidType(outputs);

  nativeValidateOutputs(outputs);
}

export function transformLegacyOutputs(projectRoot: string, outputs: string[]) {
  const transformableOutputs = new Set(getTransformableOutputs(outputs));
  if (transformableOutputs.size === 0) {
    return outputs;
  }
  return outputs.map((output) => {
    if (!transformableOutputs.has(output)) {
      return output;
    }

    let [isNegated, outputPath] = output.startsWith('!')
      ? [true, output.substring(1)]
      : [false, output];

    const relativePath = isRelativePath(outputPath)
      ? output
      : relative(projectRoot, outputPath);

    const isWithinProject = !relativePath.startsWith('..');
    return (
      (isNegated ? '!' : '') +
      joinPathFragments(
        isWithinProject ? '{projectRoot}' : '{workspaceRoot}',
        isWithinProject ? relativePath : outputPath
      )
    );
  });
}

/**
 * @deprecated Pass the target and overrides instead. This will be removed in v20.
 */
export function getOutputsForTargetAndConfiguration(
  task: Task,
  node: ProjectGraphProjectNode
): string[];
export function getOutputsForTargetAndConfiguration(
  target: Task['target'] | Task,
  overrides: Task['overrides'] | ProjectGraphProjectNode,
  node: ProjectGraphProjectNode
): string[];
/**
 * Returns the list of outputs that will be cached.
 */
export function getOutputsForTargetAndConfiguration(
  taskTargetOrTask: Task['target'] | Task,
  overridesOrNode: Task['overrides'] | ProjectGraphProjectNode,
  node?: ProjectGraphProjectNode
): string[] {
  const taskTarget =
    'id' in taskTargetOrTask ? taskTargetOrTask.target : taskTargetOrTask;
  const overrides =
    'id' in taskTargetOrTask ? taskTargetOrTask.overrides : overridesOrNode;
  node = 'id' in taskTargetOrTask ? overridesOrNode : node;

  const { target, configuration } = taskTarget;

  const targetConfiguration = node.data.targets[target];

  const options = {
    ...targetConfiguration?.options,
    ...targetConfiguration?.configurations?.[configuration],
    ...overrides,
  };

  if (targetConfiguration?.outputs) {
    validateOutputs(targetConfiguration.outputs);

    const result = new Set<string>();
    for (const output of targetConfiguration.outputs) {
      const interpolatedOutput = interpolate(output, {
        projectRoot: node.data.root,
        projectName: node.name,
        project: { ...node.data, name: node.name }, // this is legacy
        options,
      });
      if (
        !!interpolatedOutput &&
        !interpolatedOutput.match(/{(projectRoot|workspaceRoot|(options.*))}/)
      ) {
        result.add(interpolatedOutput);
      }
    }
    return Array.from(result);
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

/**
 * Matches portions of a string which need to be interpolated.
 * Matches anything within curly braces, excluding the braces.
 */
const replacementRegex = /{([\s\S]+?)}/g;

export function interpolate(template: string, data: any): string {
  // Path is absolute or doesn't need interpolation
  if (template.startsWith('/') || !replacementRegex.test(template)) {
    return template;
  }

  if (template.includes('{workspaceRoot}', 1)) {
    throw new Error(
      `Output '${template}' is invalid. {workspaceRoot} can only be used at the beginning of the expression.`
    );
  }

  if (data.projectRoot == '.' && template.includes('{projectRoot}', 1)) {
    throw new Error(
      `Output '${template}' is invalid. When {projectRoot} is '.', it can only be used at the beginning of the expression.`
    );
  }

  const parts = template.split('/').map((s) => _interpolate(s, data));

  return join(...parts).replace('{workspaceRoot}/', '');
}

function _interpolate(template: string, data: any): string {
  let res = template;

  if (data.projectRoot == '.') {
    res = res.replace('{projectRoot}', '');
  }

  return res.replace(replacementRegex, (match: string) => {
    let value = data;
    let path = match.slice(1, -1).trim().split('.');
    for (let idx = 0; idx < path.length; idx++) {
      if (!value[path[idx]]) {
        return match;
      }
      value = value[path[idx]];
    }
    return value;
  });
}

export function getTargetConfigurationForTask(
  task: Task,
  projectGraph: ProjectGraph
): TargetConfiguration | undefined {
  const project = projectGraph.nodes[task.target.project].data;
  return project.targets[task.target.target];
}

export function getExecutorNameForTask(task: Task, projectGraph: ProjectGraph) {
  return getTargetConfigurationForTask(task, projectGraph)?.executor;
}

export function getExecutorForTask(
  task: Task,
  projectGraph: ProjectGraph
): ExecutorConfig & { isNgCompat: boolean; isNxExecutor: boolean } {
  const executor = getExecutorNameForTask(task, projectGraph);
  const [nodeModule, executorName] = executor.split(':');

  return getExecutorInformation(
    nodeModule,
    executorName,
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(projectGraph).projects
  );
}

export function getCustomHasher(
  task: Task,
  projectGraph: ProjectGraph
): CustomHasher | null {
  const factory = getExecutorForTask(task, projectGraph).hasherFactory;
  return factory ? factory() : null;
}

export function removeTasksFromTaskGraph(
  graph: TaskGraph,
  ids: string[]
): TaskGraph {
  const newGraph = removeIdsFromGraph<Task>(graph, ids, graph.tasks);
  return {
    dependencies: newGraph.dependencies,
    roots: newGraph.roots,
    tasks: newGraph.mapWithIds,
  };
}

export function removeIdsFromGraph<T>(
  graph: {
    roots: string[];
    dependencies: Record<string, string[]>;
  },
  ids: string[],
  mapWithIds: Record<string, T>
): {
  mapWithIds: Record<string, T>;
  roots: string[];
  dependencies: Record<string, string[]>;
} {
  const filteredMapWithIds = {};
  const dependencies = {};
  const removedSet = new Set(ids);
  for (let id of Object.keys(mapWithIds)) {
    if (!removedSet.has(id)) {
      filteredMapWithIds[id] = mapWithIds[id];
      dependencies[id] = graph.dependencies[id].filter(
        (depId) => !removedSet.has(depId)
      );
    }
  }
  return {
    mapWithIds: filteredMapWithIds,
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

export function getCliPath() {
  return require.resolve(`../../bin/run-executor.js`);
}

export function getPrintableCommandArgsForTask(task: Task) {
  const args: string[] = task.overrides['__overrides_unparsed__'];

  const target = task.target.target.includes(':')
    ? `"${task.target.target}"`
    : task.target.target;

  const config = task.target.configuration
    ? `:${task.target.configuration}`
    : '';

  return ['run', `${task.target.project}:${target}${config}`, ...args];
}

export function getSerializedArgsForTask(task: Task, isVerbose: boolean) {
  return [
    JSON.stringify({
      targetDescription: task.target,
      overrides: task.overrides,
      isVerbose: isVerbose,
    }),
  ];
}

export function shouldStreamOutput(
  task: Task,
  initiatingProject: string | null
): boolean {
  if (process.env.NX_STREAM_OUTPUT === 'true') return true;
  if (longRunningTask(task)) return true;
  if (task.target.project === initiatingProject) return true;
  return false;
}

export function isCacheableTask(
  task: Task,
  options: {
    cacheableOperations?: string[] | null;
    cacheableTargets?: string[] | null;
  }
): boolean {
  if (task.cache !== undefined && !longRunningTask(task)) {
    return task.cache;
  }

  const cacheable = options.cacheableOperations || options.cacheableTargets;
  return (
    cacheable &&
    cacheable.indexOf(task.target.target) > -1 &&
    !longRunningTask(task)
  );
}

function longRunningTask(task: Task) {
  const t = task.target.target;
  return (
    (!!task.overrides['watch'] && task.overrides['watch'] !== 'false') ||
    t.endsWith(':watch') ||
    t.endsWith('-watch') ||
    t === 'serve' ||
    t === 'dev' ||
    t === 'start'
  );
}

// TODO: vsavkin remove when nx-cloud doesn't depend on it
export function unparse(options: Object): string[] {
  return serializeOverridesIntoCommandLine(options);
}
