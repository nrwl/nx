import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import {
  getDependencyConfigs,
  getOutputs,
  interpolate,
  createTaskId,
  removeTasksFromTaskGraph,
} from './utils';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utils/project-graph-utils';
import { Task, TaskGraph, TaskGraphEdge } from '../config/task-graph';
import { TargetDependencies } from '../config/nx-json';
import { output } from '../utils/output';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { findCycles } from './task-graph-utils';
import {
  getExecutorInformation,
  parseExecutor,
} from '../command-line/run/executor-utils';
import { camelCase, Schema, schemaAcceptsOption } from '../utils/params';
import { workspaceRoot } from '../utils/workspace-root';

const DUMMY_TASK_TARGET = '__nx_dummy_task__';

/**
 * For each task, the overrides every `dependsOn` edge into it would give it,
 * whether or not that edge created the task. `from` is the task the edge
 * leaves; an edge crossing a project without the target is recorded against
 * the task it started from.
 */
export type DependencyOverrides = Record<
  string,
  Array<{
    from: string;
    overrides: Record<string, unknown>;
    delivery: OverrideDelivery;
  }>
>;

/** The CLI override names that reached a task, split by whether its executor accepts them. */
export interface OverrideDelivery {
  sent: string[];
  unsent: string[];
}

export type OverrideDeliveries = Record<string, OverrideDelivery>;

/** Per task, the CLI override names its executor does not accept, so it did not get them. */
export type UnsentOverrides = Record<string, string[]>;

export class ProcessTasks {
  private readonly seen = new Set<string>();
  readonly tasks: { [id: string]: Task } = {};
  readonly dependencies: { [k: string]: TaskGraphEdge[] } = {};
  readonly continuousDependencies: { [k: string]: TaskGraphEdge[] } = {};
  readonly dependencyOverrides: DependencyOverrides = {};
  private readonly allTargetNames: string[];
  private readonly schemas = new Map<string, Schema | null>();
  readonly overrideDeliveries: OverrideDeliveries = {};

  constructor(
    private readonly extraTargetDependencies: TargetDependencies,
    private readonly projectGraph: ProjectGraph,
    private readonly recordDependencyOverrides = false,
    /** The CLI overrides, which only reach tasks whose executor accepts them. */
    private readonly cliOverrideNames: string[] = []
  ) {
    const allTargetNames = new Set<string>();
    for (const projectName in projectGraph.nodes) {
      const project = projectGraph.nodes[projectName];
      for (const targetName in project.data.targets ?? {}) {
        allTargetNames.add(targetName);
      }
    }
    this.allTargetNames = Array.from(allTargetNames);
  }

  processTasks(
    projectNames: string[],
    targets: string[],
    configuration: string,
    overrides: Record<string, unknown>,
    excludeTaskDependencies: boolean
  ): string[] {
    for (const projectName of projectNames) {
      for (const target of targets) {
        const project = this.projectGraph.nodes[projectName];
        if (targets.length === 1 || project.data.targets[target]) {
          const resolvedConfiguration = this.resolveConfiguration(
            project,
            target,
            configuration
          );
          const id = createTaskId(projectName, target, resolvedConfiguration);
          const task = this.createTask(
            id,
            project,
            target,
            resolvedConfiguration,
            overrides
          );
          this.tasks[task.id] = task;
          this.dependencies[task.id] = [];
          this.continuousDependencies[task.id] = [];
        }
      }
    }

    // used when excluding tasks
    const initialTasks = { ...this.tasks };

    for (const taskId of Object.keys(this.tasks)) {
      const task = this.tasks[taskId];
      this.processTask(task, task.target.project, configuration, overrides);
    }

    if (excludeTaskDependencies) {
      for (let t of Object.keys(this.tasks)) {
        if (!initialTasks[t]) {
          delete this.tasks[t];
          delete this.dependencies[t];
          delete this.continuousDependencies[t];
        }
      }
      for (let d of Object.keys(this.dependencies)) {
        this.dependencies[d] = this.dependencies[d].filter(
          (dd) => !!initialTasks[dd.id]
        );
      }
      for (let d of Object.keys(this.continuousDependencies)) {
        this.continuousDependencies[d] = this.continuousDependencies[d].filter(
          (dd) => !!initialTasks[dd.id]
        );
      }
    }

    filterDummyTasks(this.dependencies);
    filterDummyTasks(this.continuousDependencies);

    return Object.keys(this.tasks).filter(
      (d) =>
        this.dependencies[d].length === 0 &&
        this.continuousDependencies[d].length === 0
    );
  }

  processTask(
    task: Task,
    projectUsedToDeriveDependencies: string,
    configuration: string,
    overrides: Record<string, unknown>
  ): void {
    const seenKey = `${task.id}-${projectUsedToDeriveDependencies}`;
    if (this.seen.has(seenKey)) {
      return;
    }
    this.seen.add(seenKey);

    const dependencyConfigs = getDependencyConfigs(
      { project: task.target.project, target: task.target.target },
      this.extraTargetDependencies,
      this.projectGraph,
      this.allTargetNames
    );
    for (const dependencyConfig of dependencyConfigs) {
      const taskOverrides = createTaskOverrides(
        dependencyConfig,
        overrides,
        task,
        this.projectGraph
      );
      if (dependencyConfig.projects) {
        this.processTasksForMultipleProjects(
          dependencyConfig,
          configuration,
          task,
          taskOverrides,
          overrides
        );
      } else if (dependencyConfig.dependencies) {
        this.processTasksForDependencies(
          projectUsedToDeriveDependencies,
          dependencyConfig,
          configuration,
          task,
          taskOverrides,
          overrides
        );
      } else {
        this.processTasksForSingleProject(
          task,
          task.target.project,
          dependencyConfig,
          configuration,
          taskOverrides,
          overrides
        );
      }
    }
  }

  private processTasksForMultipleProjects(
    dependencyConfig: TargetDependencyConfig,
    configuration: string,
    task: Task,
    taskOverrides:
      | Record<string, unknown>
      | { __overrides_unparsed__: string[] },
    overrides: Record<string, unknown>
  ) {
    if (dependencyConfig.projects.length === 0) {
      output.warn({
        title: `\`dependsOn\` is misconfigured for ${task.target.project}:${task.target.target}`,
        bodyLines: [
          `Project patterns "${dependencyConfig.projects}" does not match any projects.`,
        ],
      });
    }
    for (const projectName of dependencyConfig.projects) {
      this.processTasksForSingleProject(
        task,
        projectName,
        dependencyConfig,
        configuration,
        taskOverrides,
        overrides
      );
    }
  }

  private processTasksForSingleProject(
    task: Task,
    projectName: string,
    dependencyConfig: TargetDependencyConfig,
    configuration: string,
    taskOverrides:
      | Record<string, unknown>
      | { __overrides_unparsed__: string[] },
    overrides: Record<string, unknown>
  ) {
    const selfProject = this.projectGraph.nodes[
      projectName
    ] as ProjectGraphProjectNode;

    if (projectHasTarget(selfProject, dependencyConfig.target)) {
      const resolvedConfiguration = this.resolveConfiguration(
        selfProject,
        dependencyConfig.target,
        configuration
      );
      const selfTaskId = createTaskId(
        selfProject.name,
        dependencyConfig.target,
        resolvedConfiguration
      );
      if (!this.tasks[selfTaskId]) {
        const newTask = this.createTask(
          selfTaskId,
          selfProject,
          dependencyConfig.target,
          resolvedConfiguration,
          taskOverrides
        );
        this.tasks[selfTaskId] = newTask;
        this.dependencies[selfTaskId] = [];
        this.continuousDependencies[selfTaskId] = [];
        this.processTask(
          newTask,
          newTask.target.project,
          configuration,
          overrides
        );
      }
      if (task.id !== selfTaskId) {
        this.recordEdge(
          task,
          selfTaskId,
          this.routeOverrides(
            selfProject,
            dependencyConfig.target,
            taskOverrides
          )
        );
        if (this.tasks[selfTaskId].continuous) {
          this.addContinuousEdge(task, selfTaskId, dependencyConfig);
        } else {
          this.dependencies[task.id].push({ id: selfTaskId });
        }
      }
    }
  }

  private processTasksForDependencies(
    projectUsedToDeriveDependencies: string,
    dependencyConfig: TargetDependencyConfig,
    configuration: string,
    task: Task,
    taskOverrides:
      | Record<string, unknown>
      | { __overrides_unparsed__: string[] },
    overrides: Record<string, unknown>
  ): void {
    if (
      !this.projectGraph.dependencies.hasOwnProperty(
        projectUsedToDeriveDependencies
      )
    ) {
      return;
    }

    for (const dep of this.projectGraph.dependencies[
      projectUsedToDeriveDependencies
    ]) {
      const depProject = this.projectGraph.nodes[
        dep.target
      ] as ProjectGraphProjectNode;

      // this is to handle external dependencies
      if (!depProject) continue;

      if (projectHasTarget(depProject, dependencyConfig.target)) {
        const resolvedConfiguration = this.resolveConfiguration(
          depProject,
          dependencyConfig.target,
          configuration
        );
        const depTargetId = createTaskId(
          depProject.name,
          dependencyConfig.target,
          resolvedConfiguration
        );

        const depTargetConfiguration =
          this.projectGraph.nodes[depProject.name].data.targets[
            dependencyConfig.target
          ];

        if (task.id !== depTargetId) {
          this.recordEdge(
            task,
            depTargetId,
            this.routeOverrides(
              depProject,
              dependencyConfig.target,
              taskOverrides
            )
          );
          if (depTargetConfiguration.continuous) {
            this.addContinuousEdge(task, depTargetId, dependencyConfig);
          } else {
            this.dependencies[task.id].push({ id: depTargetId });
          }
        }
        if (!this.tasks[depTargetId]) {
          const newTask = this.createTask(
            depTargetId,
            depProject,
            dependencyConfig.target,
            resolvedConfiguration,
            taskOverrides
          );
          this.tasks[depTargetId] = newTask;
          this.dependencies[depTargetId] = [];
          this.continuousDependencies[depTargetId] = [];

          this.processTask(
            newTask,
            newTask.target.project,
            configuration,
            overrides
          );
        }
      } else {
        // Create a dummy task for task.target.project... which simulates if depProject had dependencyConfig.target
        const dummyId = createTaskId(
          depProject.name,
          task.target.project +
            task.target.target +
            '__' +
            dependencyConfig.target +
            DUMMY_TASK_TARGET,
          undefined
        );
        this.dependencies[task.id].push({ id: dummyId });
        this.continuousDependencies[task.id].push({ id: dummyId });
        this.dependencies[dummyId] ??= [];
        this.continuousDependencies[dummyId] ??= [];
        const noopTask = this.createDummyTask(dummyId, task);
        this.processTask(noopTask, depProject.name, configuration, overrides);
      }
    }
  }

  private addContinuousEdge(
    task: Task,
    dependencyId: string,
    dependencyConfig: TargetDependencyConfig
  ) {
    this.continuousDependencies[task.id].push(
      continuousEdge(dependencyId, dependencyConfig)
    );
  }

  private recordEdge(
    task: Task,
    dependencyId: string,
    { overrides, delivery }: RoutedOverrides
  ) {
    if (!this.recordDependencyOverrides) {
      return;
    }
    // A dummy task keeps its creator's target, so `from` is the real task the edge started from.
    const from = createTaskId(
      task.target.project,
      task.target.target,
      task.target.configuration
    );
    (this.dependencyOverrides[dependencyId] ??= []).push({
      from,
      overrides,
      delivery,
    });
  }

  private createDummyTask(id: string, task: Task): Task {
    return {
      ...task,
      id,
    };
  }

  createTask(
    id: string,
    project: ProjectGraphProjectNode,
    target: string,
    resolvedConfiguration: string | undefined,
    overrides: Record<string, unknown>
  ): Task {
    if (!project.data.targets[target]) {
      throw new Error(
        `Cannot find configuration for task ${project.name}:${target}`
      );
    }

    if (!project.data.targets[target].executor) {
      throw new Error(
        `Target "${project.name}:${target}" does not have an executor configured`
      );
    }

    const qualifiedTarget = {
      project: project.name,
      target,
      configuration: resolvedConfiguration,
    };

    const routed = this.routeOverrides(project, target, overrides);
    this.overrideDeliveries[id] = routed.delivery;
    const interpolatedOverrides = interpolateOverrides(
      routed.overrides,
      project.name,
      project.data
    );

    return {
      id,
      target: qualifiedTarget,
      projectRoot: project.data.root,
      overrides: interpolatedOverrides,
      outputs: getOutputs(
        this.projectGraph.nodes,
        qualifiedTarget,
        interpolatedOverrides
      ),
      cache: project.data.targets[target].cache ?? false,
      parallelism: project.data.targets[target].parallelism ?? true,
      continuous: project.data.targets[target].continuous ?? false,
      ultracache: project.data.targets[target].ultracache,
    };
  }

  private routeOverrides(
    project: ProjectGraphProjectNode,
    target: string,
    overrides: Record<string, unknown>
  ): RoutedOverrides {
    const delivery: OverrideDelivery = { sent: [], unsent: [] };
    for (const name of this.cliOverrideNames) {
      if (Object.hasOwn(overrides, name)) {
        (this.accepts(project, target, name)
          ? delivery.sent
          : delivery.unsent
        ).push(name);
      }
    }
    if (!delivery.unsent.length) {
      return { overrides, delivery };
    }
    const routed = { ...overrides };
    for (const name of delivery.unsent) {
      delete routed[name];
    }
    if (Array.isArray(routed.__overrides_unparsed__)) {
      routed.__overrides_unparsed__ = removeUnparsedOverrides(
        routed.__overrides_unparsed__,
        delivery.unsent,
        overrides
      );
    }
    return { overrides: routed, delivery };
  }

  private accepts(
    project: ProjectGraphProjectNode,
    target: string,
    name: string
  ): boolean {
    const schema = this.readSchema(project.data.targets[target].executor);
    return !schema || schemaAcceptsOption(name, schema);
  }

  private readSchema(executor: string): Schema | null {
    if (!this.schemas.has(executor)) {
      this.schemas.set(executor, this.loadSchema(executor));
    }
    return this.schemas.get(executor);
  }

  // A run that cannot resolve an executor fails later with its own error;
  // treating the schema as accept-all keeps that error.
  private loadSchema(executor: string): Schema | null {
    try {
      const [nodeModule, executorName] = parseExecutor(executor);
      const projects = Object.fromEntries(
        Object.entries(this.projectGraph.nodes).map(([name, node]) => [
          name,
          node.data,
        ])
      );
      return getExecutorInformation(
        nodeModule,
        executorName,
        workspaceRoot,
        projects
      ).schema;
    } catch {
      return null;
    }
  }

  resolveConfiguration(
    project: ProjectGraphProjectNode,
    target: string,
    configuration: string | undefined
  ) {
    const defaultConfiguration =
      project.data.targets?.[target]?.defaultConfiguration;
    configuration ??= defaultConfiguration;
    const resolved = projectHasTargetAndConfiguration(
      project,
      target,
      configuration
    )
      ? configuration
      : defaultConfiguration;
    // `createTaskId` drops an empty configuration, so the target must too.
    return resolved || undefined;
  }
}

export function createTaskGraph(
  projectGraph: ProjectGraph,
  extraTargetDependencies: TargetDependencies,
  projectNames: string[],
  targets: string[],
  configuration: string | undefined,
  overrides: Record<string, unknown>,
  excludeTaskDependencies: boolean = false
): TaskGraph {
  return routeTaskGraph(
    projectGraph,
    extraTargetDependencies,
    projectNames,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies,
    false
  ).taskGraph;
}

/** `createTaskGraph`, plus which CLI overrides reached each task and the overrides each dependency edge would give. */
export function createTaskGraphWithDependencyOverrides(
  projectGraph: ProjectGraph,
  extraTargetDependencies: TargetDependencies,
  projectNames: string[],
  targets: string[],
  configuration: string | undefined,
  overrides: Record<string, unknown>,
  excludeTaskDependencies: boolean = false
) {
  return routeTaskGraph(
    projectGraph,
    extraTargetDependencies,
    projectNames,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies,
    true
  );
}

function routeTaskGraph(
  projectGraph: ProjectGraph,
  extraTargetDependencies: TargetDependencies,
  projectNames: string[],
  targets: string[],
  configuration: string | undefined,
  overrides: Record<string, unknown>,
  excludeTaskDependencies: boolean,
  recordDependencyOverrides: boolean
): {
  taskGraph: TaskGraph;
  overrideDeliveries: OverrideDeliveries;
  dependencyOverrides: DependencyOverrides;
} {
  const p = new ProcessTasks(
    extraTargetDependencies,
    projectGraph,
    recordDependencyOverrides,
    Object.keys(overrides).filter(
      (name) => name !== '_' && name !== '__overrides_unparsed__'
    )
  );
  const roots = p.processTasks(
    projectNames,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies
  );
  return {
    taskGraph: {
      roots,
      tasks: p.tasks,
      dependencies: p.dependencies,
      continuousDependencies: p.continuousDependencies,
    },
    overrideDeliveries: p.overrideDeliveries,
    dependencyOverrides: p.dependencyOverrides,
  };
}

/** Fails when a CLI override reached tasks in `taskGraph` but none of them accepts it. */
export function assertOverridesAccepted(
  overrideDeliveries: OverrideDeliveries,
  taskGraph: TaskGraph
): void {
  const recipients = new Map<string, { taskIds: string[]; sent: boolean }>();
  for (const taskId of Object.keys(taskGraph.tasks)) {
    const { sent = [], unsent = [] } = overrideDeliveries[taskId] ?? {};
    for (const name of [...sent, ...unsent]) {
      const recipient = recipients.get(name) ?? { taskIds: [], sent: false };
      recipient.taskIds.push(taskId);
      recipient.sent ||= sent.includes(name);
      recipients.set(name, recipient);
    }
  }
  const rejected = [...recipients]
    .filter(([, { sent }]) => !sent)
    .map(
      ([name, { taskIds }]) =>
        `'${name}' is not in the schema of any task in this run (${taskIds.join(', ')})`
    );
  if (rejected.length) {
    throw new Error(rejected.join('\n'));
  }
}

export function unsentOverrides(
  overrideDeliveries: OverrideDeliveries,
  taskGraph: TaskGraph
): UnsentOverrides {
  const unsent: UnsentOverrides = {};
  for (const taskId of Object.keys(taskGraph.tasks)) {
    if (overrideDeliveries[taskId]?.unsent.length) {
      unsent[taskId] = overrideDeliveries[taskId].unsent;
    }
  }
  return unsent;
}

/**
 * `taskGraph` pruned to `keep`, as if built from `initial` alone: a kept dependency
 * takes the overrides its edges give it. Undefined when those edges disagree or are missing.
 */
export function filterTaskGraphToSelection(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  overrideDeliveries: OverrideDeliveries,
  dependencyOverrides: DependencyOverrides,
  initial: Set<string>,
  keep: Set<string>
):
  | { taskGraph: TaskGraph; overrideDeliveries: OverrideDeliveries }
  | undefined {
  const tasks: Record<string, Task> = {};
  const deliveries: OverrideDeliveries = {};
  for (const id of keep) {
    const task = taskGraph.tasks[id];
    if (initial.has(id)) {
      tasks[id] = { ...task };
      deliveries[id] = overrideDeliveries[id];
      continue;
    }
    const edges = dependencyOverrides[id] ?? [];
    if (!edges.length) {
      return undefined;
    }
    const first = JSON.stringify(edges[0].overrides);
    if (edges.some((e) => JSON.stringify(e.overrides) !== first)) {
      return undefined;
    }
    const project = projectGraph.nodes[task.target.project];
    const overrides = interpolateOverrides(
      edges[0].overrides,
      project.name,
      project.data
    );
    tasks[id] = {
      ...task,
      overrides,
      outputs: getOutputs(projectGraph.nodes, task.target, overrides),
    };
    deliveries[id] = edges[0].delivery;
  }
  const pruned = removeTasksFromTaskGraph(
    taskGraph,
    Object.keys(taskGraph.tasks).filter((id) => !keep.has(id))
  );
  return { taskGraph: { ...pruned, tasks }, overrideDeliveries: deliveries };
}

/**
 * `raw` without the arguments that set `names`. `parsed` tells a flag that
 * takes the next argument as its value from a boolean one.
 */
function removeUnparsedOverrides(
  raw: string[],
  names: string[],
  parsed: Record<string, unknown>
): string[] {
  const removed = new Map(names.map((name) => [camelCase(name), name]));
  const kept: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (arg === '--') {
      kept.push(...raw.slice(i));
      break;
    }
    const flag = /^--?([^=]+)(=.*)?$/.exec(arg);
    if (!flag || (arg[1] !== '-' && flag[1].length !== 1)) {
      kept.push(arg);
      continue;
    }
    const key = flag[1].split('.')[0];
    const negated =
      key.startsWith('no-') && removed.has(camelCase(key.slice(3)));
    const name = negated
      ? removed.get(camelCase(key.slice(3)))
      : removed.get(camelCase(key));
    if (name === undefined) {
      kept.push(arg);
      continue;
    }
    const takesNext =
      !negated &&
      flag[2] === undefined &&
      typeof parsed[name] !== 'boolean' &&
      i + 1 < raw.length &&
      !raw[i + 1].startsWith('-');
    if (takesNext) {
      i++;
    }
  }
  return kept;
}

type RoutedOverrides = {
  overrides: Record<string, unknown>;
  delivery: OverrideDelivery;
};

function interpolateOverrides<T = any>(
  args: T,
  projectName: string,
  project: any
): T {
  const interpolatedArgs: T = { ...args };
  Object.entries(interpolatedArgs).forEach(([name, value]) => {
    interpolatedArgs[name] =
      typeof value === 'string'
        ? interpolate(value, {
            workspaceRoot: '',
            projectRoot: project.root,
            projectName: project.name,
            project: { ...project, name: projectName }, // this is legacy
          })
        : value;
  });
  return interpolatedArgs;
}

function continuousEdge(
  id: string,
  dependencyConfig: TargetDependencyConfig
): TaskGraphEdge {
  const edge: TaskGraphEdge = { id };
  if (dependencyConfig.waitFor === 'ready') {
    edge.waitFor = 'ready';
  }
  if (dependencyConfig.inputs === false) {
    edge.inputs = false;
  }
  return edge;
}

// A task reached by several edges waits for ready when any of them does, and
// keeps its inputs unless all of them opt out
function mergeEdges(edges: TaskGraphEdge[]): TaskGraphEdge[] {
  const byId = new Map<string, TaskGraphEdge>();
  for (const edge of edges) {
    const seen = byId.get(edge.id);
    if (!seen) {
      byId.set(edge.id, edge);
      continue;
    }
    const merged: TaskGraphEdge = { id: edge.id };
    if (seen.waitFor === 'ready' || edge.waitFor === 'ready') {
      merged.waitFor = 'ready';
    }
    if (seen.inputs === false && edge.inputs === false) {
      merged.inputs = false;
    }
    byId.set(edge.id, merged);
  }
  return [...byId.values()];
}

/**
 * This function is used to filter out the dummy tasks from the dependencies
 * It will manipulate the dependencies object in place
 */
export function filterDummyTasks(dependencies: {
  [k: string]: TaskGraphEdge[];
}) {
  const cycles = findCycles({ dependencies });
  for (const [key, deps] of Object.entries(dependencies)) {
    if (!key.endsWith(DUMMY_TASK_TARGET)) {
      const normalizedDeps = [];
      for (const dep of deps) {
        normalizedDeps.push(
          ...getNonDummyDeps(dep, dependencies, cycles, new Set([key]))
        );
      }

      dependencies[key] = mergeEdges(normalizedDeps);
    }
  }

  for (const key of Object.keys(dependencies)) {
    if (key.endsWith(DUMMY_TASK_TARGET)) {
      delete dependencies[key];
    }
  }
}

/**
 * this function is used to get the non dummy dependencies of a task recursively
 */
export function getNonDummyDeps(
  currentEdge: TaskGraphEdge,
  dependencies: { [k: string]: TaskGraphEdge[] },
  cycles?: Set<string>,
  seen: Set<string> = new Set()
): TaskGraphEdge[] {
  const currentTask = currentEdge.id;
  if (seen.has(currentTask)) {
    return [];
  }
  if (currentTask.endsWith(DUMMY_TASK_TARGET)) {
    seen.add(currentTask);
    if (cycles?.has(currentTask)) {
      return [];
    }
    const deps = dependencies[currentTask] ?? [];
    if (!Array.isArray(deps)) {
      throw new Error(
        `Expected dependencies of task ${currentTask} to be an array, but got ${typeof deps}`
      );
    }
    // if not a cycle, recursively get the non dummy dependencies
    return deps.flatMap((dep) =>
      getNonDummyDeps(dep, dependencies, cycles, seen)
    );
  } else {
    return [currentEdge];
  }
}

function createTaskOverrides(
  dependencyConfig: TargetDependencyConfig,
  cliOverrides: any,
  sourceTask: Task,
  projectGraph: ProjectGraph
): any {
  const optionsToForward: any = {};

  if (dependencyConfig.options === 'forward') {
    const sourceTargetConfig =
      projectGraph.nodes[sourceTask.target.project].data.targets?.[
        sourceTask.target.target
      ];
    if (sourceTargetConfig?.options) {
      Object.assign(optionsToForward, sourceTargetConfig.options);
    }

    if (
      sourceTask.target.configuration &&
      sourceTargetConfig?.configurations?.[sourceTask.target.configuration]
    ) {
      Object.assign(
        optionsToForward,
        sourceTargetConfig.configurations[sourceTask.target.configuration]
      );
    }
  }

  return dependencyConfig.params === 'forward'
    ? { ...optionsToForward, ...cliOverrides }
    : { ...optionsToForward, __overrides_unparsed__: [] };
}
