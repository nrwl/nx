import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { getDependencyConfigs, getOutputs, interpolate } from './utils';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utils/project-graph-utils';
import { Task, TaskGraph } from '../config/task-graph';
import { TargetDefaults, TargetDependencies } from '../config/nx-json';
import { output } from '../utils/output';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { findCycles } from './task-graph-utils';

const DUMMY_TASK_TARGET = '__nx_dummy_task__';

export class ProcessTasks {
  private readonly seen = new Set<string>();
  readonly tasks: { [id: string]: Task } = {};
  readonly dependencies: { [k: string]: string[] } = {};
  readonly continuousDependencies: { [k: string]: string[] } = {};
  private readonly allTargetNames: string[];

  constructor(
    private readonly extraTargetDependencies: TargetDependencies,
    private readonly projectGraph: ProjectGraph
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
    overrides: Object,
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
    overrides: Object
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
      const taskOverrides =
        dependencyConfig.params === 'forward'
          ? overrides
          : { __overrides_unparsed__: [] };
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
    taskOverrides: Object | { __overrides_unparsed__: any[] },
    overrides: Object
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
    taskOverrides: Object | { __overrides_unparsed__: any[] },
    overrides: Object
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
    taskOverrides: Object | { __overrides_unparsed__: any[] },
    overrides: Object
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
            '__' +
            dependencyConfig.target +
            DUMMY_TASK_TARGET,
          undefined
        );
        this.dependencies[task.id].push(dummyId);
        this.dependencies[dummyId] ??= [];
        this.continuousDependencies[dummyId] ??= [];
        const noopTask = this.createDummyTask(dummyId, task);
        this.processTask(noopTask, depProject.name, configuration, overrides);
      }
    }
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
    overrides: Object
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
      cache: project.data.targets[target].cache,
      parallelism: project.data.targets[target].parallelism ?? true,
      continuous: project.data.targets[target].continuous ?? false,
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
  overrides: Object,
  excludeTaskDependencies: boolean = false
): TaskGraph {
  const p = new ProcessTasks(extraTargetDependencies, projectGraph);
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

export function mapTargetDefaultsToDependencies(
  defaults: TargetDefaults | undefined
): TargetDependencies {
  const res = {};
  Object.keys(defaults ?? {}).forEach((k) => {
    res[k] = defaults[k].dependsOn;
  });

  return res;
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
    // if not a cycle, recursively get the non dummy dependencies
    return (
      dependencies[currentTask]?.flatMap((dep) =>
        getNonDummyDeps(dep, dependencies, cycles, seen)
      ) ?? []
    );
  } else {
    return [currentTask];
  }
}

export function createTaskId(
  project: string,
  target: string,
  configuration: string | undefined
): string {
  let id = `${project}:${target}`;
  if (configuration) {
    id += `:${configuration}`;
  }
  return id;
}
