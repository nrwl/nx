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
import { Task, TaskGraph } from '../config/task-graph';
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
  readonly dependencies: { [k: string]: string[] } = {};
  readonly continuousDependencies: { [k: string]: string[] } = {};
  readonly dependencyOverrides: DependencyOverrides = {};
  private readonly allTargetNames: string[];

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
          (dd) => !!initialTasks[dd]
        );
      }
      for (let d of Object.keys(this.continuousDependencies)) {
        this.continuousDependencies[d] = this.continuousDependencies[d].filter(
          (dd) => !!initialTasks[dd]
        );
      }
    }

    filterDummyTasks(this.dependencies);

    for (const taskId of Object.keys(this.dependencies)) {
      if (this.dependencies[taskId].length > 0) {
        this.dependencies[taskId] = [
          ...new Set(
            this.dependencies[taskId].filter((d) => d !== taskId)
          ).values(),
        ];
      }
    }

    filterDummyTasks(this.continuousDependencies);

    for (const taskId of Object.keys(this.continuousDependencies)) {
      if (this.continuousDependencies[taskId].length > 0) {
        this.continuousDependencies[taskId] = [
          ...new Set(
            this.continuousDependencies[taskId].filter((d) => d !== taskId)
          ).values(),
        ];
      }
    }

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
        this.recordEdge(task, selfTaskId, taskOverrides);
        if (this.tasks[selfTaskId].continuous) {
          this.continuousDependencies[task.id].push(selfTaskId);
        } else {
          this.dependencies[task.id].push(selfTaskId);
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
            this.continuousDependencies[task.id].push(depTargetId);
          } else {
            this.dependencies[task.id].push(depTargetId);
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
        this.dependencies[task.id].push(dummyId);
        this.continuousDependencies[task.id].push(dummyId);
        this.dependencies[dummyId] ??= [];
        this.continuousDependencies[dummyId] ??= [];
        const noopTask = this.createDummyTask(dummyId, task);
        this.processTask(noopTask, depProject.name, configuration, overrides);
      }
    }
  }

  private recordEdge(
    task: Task,
    dependencyId: string,
    overrides: Record<string, unknown>
  ) {
    if (!this.recordDependencyOverrides) {
      return;
    }
    // A dummy task copies the target of the task it stands in for.
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
    return projectHasTargetAndConfiguration(project, target, configuration)
      ? configuration
      : defaultConfiguration;
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
 * `taskGraph` pruned to `keep`, as if built from `initial` alone: a kept task
 * that build reaches only as a dependency gets the overrides its edges from
 * `built` give it. Undefined when those edges disagree, since which one wins
 * depends on the order `createTaskGraph` visits them.
 */
export function narrowTaskGraph(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  dependencyOverrides: DependencyOverrides,
  initial: Set<string>,
  built: Set<string>,
  keep: Set<string>
): TaskGraph | undefined {
  const tasks: Record<string, Task> = {};
  for (const id of keep) {
    const task = taskGraph.tasks[id];
    if (initial.has(id)) {
      tasks[id] = { ...task };
      continue;
    }
    const edges = (dependencyOverrides[id] ?? []).filter((e) =>
      built.has(e.from)
    );
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

/**
 * This function is used to filter out the dummy tasks from the dependencies
 * It will manipulate the dependencies object in place
 */
export function filterDummyTasks(dependencies: { [k: string]: string[] }) {
  const cycles = findCycles({ dependencies });
  for (const [key, deps] of Object.entries(dependencies)) {
    if (!key.endsWith(DUMMY_TASK_TARGET)) {
      const normalizedDeps = [];
      for (const dep of deps) {
        normalizedDeps.push(
          ...getNonDummyDeps(dep, dependencies, cycles, new Set([key]))
        );
      }

      dependencies[key] = normalizedDeps;
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
  currentTask: string,
  dependencies: { [k: string]: string[] },
  cycles?: Set<string>,
  seen: Set<string> = new Set()
): string[] {
  if (seen.has(currentTask)) {
    return [];
  }
  seen.add(currentTask);
  if (currentTask.endsWith(DUMMY_TASK_TARGET)) {
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
    return [currentTask];
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
