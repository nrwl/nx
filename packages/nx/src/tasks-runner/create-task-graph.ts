import { isDeepStrictEqual } from 'node:util';
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

const DUMMY_TASK_TARGET = '__nx_dummy_task__';

/**
 * For each task, the overrides every `dependsOn` edge into it would give it,
 * whether or not that edge created the task. `from` is the task the edge
 * leaves; an edge crossing a project without the target is recorded against
 * the task it started from.
 */
export type DependencyOverrides = Record<
  string,
  Array<{ from: string; overrides: Record<string, unknown> }>
>;

export class ProcessTasks {
  private readonly seen = new Set<string>();
  readonly tasks: { [id: string]: Task } = {};
  readonly dependencies: { [k: string]: TaskGraphEdge[] } = {};
  readonly continuousDependencies: { [k: string]: TaskGraphEdge[] } = {};
  readonly dependencyOverrides: DependencyOverrides = {};
  private readonly allTargetNames: string[];
  private readonly dependencyConfigs = new Map<
    string,
    ReturnType<typeof getDependencyConfigs>
  >();
  private readonly reachableProjects = new Map<string, Set<string>>();
  private reverseDependencies: Map<string, string[]>;
  private readonly dummySignatures = new Map<
    string,
    Array<{ value: unknown; id: number }>
  >();
  private readonly taskSignatures = new WeakMap<
    Task['target'],
    {
      configuration: string;
      overrides: Record<string, unknown>;
      sourceOverrides: Task['overrides'];
      id: number;
    }
  >();
  private nextSignature = 0;
  private projectsReachingCycles: Set<string>;
  private changedDummyGraph = false;
  private optimizeDummyTasks = true;

  constructor(
    private readonly extraTargetDependencies: TargetDependencies,
    private readonly projectGraph: ProjectGraph,
    private readonly recordDependencyOverrides = false
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

    // findCycles is traversal-order sensitive. Sharing or pruning nodes in a
    // cyclic graph can change which dummies it excludes. Rebuild those graphs
    // with their original dummy identities and traversal before filtering.
    if (
      this.changedDummyGraph &&
      (findCycles({ dependencies: this.dependencies }) ||
        findCycles({ dependencies: this.continuousDependencies }))
    ) {
      const original = new ProcessTasks(
        this.extraTargetDependencies,
        this.projectGraph,
        this.recordDependencyOverrides
      );
      original.optimizeDummyTasks = false;
      const roots = original.processTasks(
        projectNames,
        targets,
        configuration,
        overrides,
        excludeTaskDependencies
      );
      for (const field of [
        'tasks',
        'dependencies',
        'continuousDependencies',
        'dependencyOverrides',
      ] as const) {
        for (const key of Object.keys(this[field])) delete this[field][key];
        Object.assign(this[field], original[field]);
      }
      return roots;
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

    const dependencyConfigs = this.getDependencyConfigs(task);
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

  private getDependencyConfigs(task: Task) {
    const key = JSON.stringify([task.target.project, task.target.target]);
    let configs = this.dependencyConfigs.get(key);
    if (!configs) {
      configs = getDependencyConfigs(
        { project: task.target.project, target: task.target.target },
        this.extraTargetDependencies,
        this.projectGraph,
        this.allTargetNames
      );
      this.dependencyConfigs.set(key, configs);
    }
    return configs;
  }

  /** Projects with a nonempty dependency path to this target, including cycles. */
  private projectsReachingTarget(target: string): Set<string> {
    let reachable = this.reachableProjects.get(target);
    if (reachable) return reachable;
    if (!this.reverseDependencies) {
      this.reverseDependencies = new Map();
      for (const [source, deps] of Object.entries(
        this.projectGraph.dependencies
      )) {
        if (!this.projectGraph.nodes[source]) continue;
        for (const dep of deps) {
          if (!this.projectGraph.nodes[dep.target]) continue;
          const parents = this.reverseDependencies.get(dep.target) ?? [];
          parents.push(source);
          this.reverseDependencies.set(dep.target, parents);
        }
      }
    }
    reachable = new Set<string>();
    const queue: string[] = [];
    for (const project of Object.values(this.projectGraph.nodes)) {
      if (projectHasTarget(project, target)) queue.push(project.name);
    }
    for (let i = 0; i < queue.length; i++) {
      for (const parent of this.reverseDependencies.get(queue[i]) ?? []) {
        if (!reachable.has(parent)) {
          reachable.add(parent);
          queue.push(parent);
        }
      }
    }
    this.reachableProjects.set(target, reachable);
    return reachable;
  }

  private canReachProjectCycle(project: string): boolean {
    if (!this.projectsReachingCycles) {
      // Remove sinks repeatedly. The remaining projects have a path to a
      // cycle, whose legacy dummy filtering must be preserved even when no
      // real dependency target is reachable.
      const remaining = new Set(Object.keys(this.projectGraph.nodes));
      const degree = new Map<string, number>();
      const queue: string[] = [];
      for (const name of remaining) {
        const count = (this.projectGraph.dependencies[name] ?? []).filter(
          (dep) => this.projectGraph.nodes[dep.target]
        ).length;
        degree.set(name, count);
        if (count === 0) queue.push(name);
      }
      for (let i = 0; i < queue.length; i++) {
        remaining.delete(queue[i]);
        for (const parent of this.reverseDependencies.get(queue[i]) ?? []) {
          const count = degree.get(parent) - 1;
          degree.set(parent, count);
          if (count === 0) queue.push(parent);
        }
      }
      this.projectsReachingCycles = remaining;
    }
    return this.projectsReachingCycles.has(project);
  }

  private dummySignature(
    task: Task,
    configuration: string,
    overrides: Record<string, unknown>
  ): number {
    // Dummies copy their origin's target and overrides by reference.
    const cached = this.taskSignatures.get(task.target);
    if (
      cached &&
      cached.configuration === configuration &&
      cached.overrides === overrides &&
      cached.sourceOverrides === task.overrides
    )
      return cached.id;
    // A normalized self glob names the origin project even when that project
    // has none of its targets. Such entries never add an edge or create a task;
    // omitting them from the signature lets those origins share the same walk.
    const configs = this.getDependencyConfigs(task).filter(
      (config) =>
        !config.projects ||
        config.projects.some((project) =>
          projectHasTarget(this.projectGraph.nodes[project], config.target)
        )
    );
    const value = [
      configs,
      configuration,
      task.target.configuration,
      task.overrides,
      configs.map((config) =>
        createTaskOverrides(config, overrides, task, this.projectGraph)
      ),
    ];
    let key: string;
    try {
      key = JSON.stringify(value);
    } catch {
      // Programmatic overrides need not be JSON serializable. Strict equality
      // within the bucket also handles undefined and other JSON collisions.
      key = '__non_json__';
    }
    const bucket = this.dummySignatures.get(key) ?? [];
    let signature = bucket.find((entry) =>
      isDeepStrictEqual(entry.value, value)
    );
    if (!signature) {
      signature = { value, id: this.nextSignature++ };
      bucket.push(signature);
      this.dummySignatures.set(key, bucket);
    }
    this.taskSignatures.set(task.target, {
      configuration,
      overrides,
      sourceOverrides: task.overrides,
      id: signature.id,
    });
    return signature.id;
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
        this.recordEdge(task, selfTaskId, taskOverrides);
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
          this.recordEdge(task, depTargetId, taskOverrides);
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
        const configs = this.getDependencyConfigs(task);
        // Inert self/project entries add no edges. Active ones can contribute
        // edges at the dummy's position, so retain those walks and their order.
        const dependencyTargets = configs.filter(
          (c) => c.dependencies && !c.projects
        );
        const cannotReachTarget =
          this.optimizeDummyTasks &&
          !dependencyTargets.some((c) =>
            this.projectsReachingTarget(c.target).has(depProject.name)
          );
        if (
          cannotReachTarget &&
          !configs.some((c) =>
            c.projects?.some((project) =>
              projectHasTarget(this.projectGraph.nodes[project], c.target)
            )
          ) &&
          !this.canReachProjectCycle(depProject.name)
        ) {
          this.changedDummyGraph = true;
          continue;
        }
        const shared =
          this.optimizeDummyTasks && !this.recordDependencyOverrides;
        // Every dummy evaluates all of its origin's configs, regardless of
        // which missing dependency target caused the walk.
        const dummyId = shared
          ? createTaskId(
              depProject.name,
              `__nx_shared_${this.dummySignature(task, configuration, overrides)}${DUMMY_TASK_TARGET}`,
              undefined
            )
          : createTaskId(
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
        if (shared) this.changedDummyGraph = true;
        if (!this.seen.has(`${dummyId}-${depProject.name}`)) {
          const noopTask = this.createDummyTask(dummyId, task);
          this.processTask(noopTask, depProject.name, configuration, overrides);
        }
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
    overrides: Record<string, unknown>
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
    (this.dependencyOverrides[dependencyId] ??= []).push({ from, overrides });
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

    const interpolatedOverrides = interpolateOverrides(
      overrides,
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
  return buildTaskGraph(
    new ProcessTasks(extraTargetDependencies, projectGraph),
    projectNames,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies
  );
}

/** `createTaskGraph`, plus the overrides each dependency edge would give. */
export function createTaskGraphWithDependencyOverrides(
  projectGraph: ProjectGraph,
  extraTargetDependencies: TargetDependencies,
  projectNames: string[],
  targets: string[],
  configuration: string | undefined,
  overrides: Record<string, unknown>,
  excludeTaskDependencies: boolean = false
): { taskGraph: TaskGraph; dependencyOverrides: DependencyOverrides } {
  const p = new ProcessTasks(extraTargetDependencies, projectGraph, true);
  const taskGraph = buildTaskGraph(
    p,
    projectNames,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies
  );
  return { taskGraph, dependencyOverrides: p.dependencyOverrides };
}

/**
 * `taskGraph` pruned to `keep`, as if built from `initial` alone: a kept dependency
 * takes the overrides its edges give it. Undefined when those edges disagree or are missing.
 */
export function filterTaskGraphToSelection(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  dependencyOverrides: DependencyOverrides,
  initial: Set<string>,
  keep: Set<string>
): TaskGraph | undefined {
  const tasks: Record<string, Task> = {};
  for (const id of keep) {
    const task = taskGraph.tasks[id];
    if (initial.has(id)) {
      tasks[id] = { ...task };
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
  }
  const pruned = removeTasksFromTaskGraph(
    taskGraph,
    Object.keys(taskGraph.tasks).filter((id) => !keep.has(id))
  );
  return { ...pruned, tasks };
}

function buildTaskGraph(
  p: ProcessTasks,
  projectNames: string[],
  targets: string[],
  configuration: string | undefined,
  overrides: Record<string, unknown>,
  excludeTaskDependencies: boolean
): TaskGraph {
  const roots = p.processTasks(
    projectNames,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies
  );

  return {
    roots,
    tasks: p.tasks,
    dependencies: p.dependencies,
    continuousDependencies: p.continuousDependencies,
  };
}

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
  const memo = new Map<string, TaskGraphEdge[]>();
  const resolve = (edge: TaskGraphEdge): TaskGraphEdge[] => {
    const id = edge.id;
    if (!id.endsWith(DUMMY_TASK_TARGET)) return [edge];
    if (memo.has(id)) return memo.get(id);
    const result = mergeEdges((dependencies[id] ?? []).flatMap(resolve));
    memo.set(id, result);
    return result;
  };
  for (const [key, deps] of Object.entries(dependencies)) {
    if (!key.endsWith(DUMMY_TASK_TARGET)) {
      const normalizedDeps = [];
      for (const dep of deps) {
        normalizedDeps.push(
          ...(cycles
            ? getNonDummyDeps(dep, dependencies, cycles, new Set([key]))
            : resolve(dep).filter((edge) => edge.id !== key))
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
