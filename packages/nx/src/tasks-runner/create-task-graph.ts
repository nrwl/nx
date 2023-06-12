import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { getDependencyConfigs, interpolate } from './utils';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utils/project-graph-utils';
import { Task, TaskGraph } from '../config/task-graph';
import { TargetDefaults, TargetDependencies } from '../config/nx-json';
import { TargetDependencyConfig } from '../devkit-exports';
import { findMatchingProjects } from '../utils/find-matching-projects';
import { output } from '../utils/output';

export class ProcessTasks {
  private readonly seen = new Set<string>();
  readonly tasks: { [id: string]: Task } = {};
  readonly dependencies: { [k: string]: string[] } = {};

  constructor(
    private readonly defaultDependencyConfigs: TargetDependencies,
    private readonly projectGraph: ProjectGraph
  ) {}

  processTasks(
    projectNames: string[],
    targets: string[],
    configuration: string,
    overrides: Object,
    excludeTaskDependencies: boolean
  ) {
    for (const projectName of projectNames) {
      for (const target of targets) {
        const project = this.projectGraph.nodes[projectName];
        if (targets.length === 1 || project.data.targets[target]) {
          const resolvedConfiguration = this.resolveConfiguration(
            project,
            target,
            configuration
          );
          const id = this.getId(projectName, target, resolvedConfiguration);
          const task = this.createTask(
            id,
            project,
            target,
            resolvedConfiguration,
            overrides
          );
          this.tasks[task.id] = task;
          this.dependencies[task.id] = [];
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
        }
      }
      for (let d of Object.keys(this.dependencies)) {
        this.dependencies[d] = this.dependencies[d].filter(
          (dd) => !!initialTasks[dd]
        );
      }
    }

    for (const projectName of Object.keys(this.dependencies)) {
      if (this.dependencies[projectName].length > 1) {
        this.dependencies[projectName] = [
          ...new Set(this.dependencies[projectName]).values(),
        ];
      }
    }

    return Object.keys(this.dependencies).filter(
      (d) => this.dependencies[d].length === 0
    );
  }

  processTask(
    task: Task,
    projectUsedToDeriveDependencies: string,
    configuration: string,
    overrides: Object
  ) {
    const seenKey = `${task.id}-${projectUsedToDeriveDependencies}`;
    if (this.seen.has(seenKey)) {
      return;
    }
    this.seen.add(seenKey);

    const dependencyConfigs = getDependencyConfigs(
      { project: task.target.project, target: task.target.target },
      this.defaultDependencyConfigs,
      this.projectGraph
    );
    for (const dependencyConfig of dependencyConfigs) {
      const taskOverrides =
        dependencyConfig.params === 'forward'
          ? overrides
          : { __overrides_unparsed__: [] };
      if (dependencyConfig.projects) {
        this.processTasksForMatchingProjects(
          dependencyConfig,
          projectUsedToDeriveDependencies,
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

  private processTasksForMatchingProjects(
    dependencyConfig: TargetDependencyConfig,
    projectUsedToDeriveDependencies: string,
    configuration: string,
    task: Task,
    taskOverrides: Object | { __overrides_unparsed__: any[] },
    overrides: Object
  ) {
    const targetProjectSpecifiers =
      typeof dependencyConfig.projects === 'string'
        ? [dependencyConfig.projects]
        : dependencyConfig.projects;
    for (const projectSpecifier of targetProjectSpecifiers) {
      // Lerna uses `dependencies` in `prepNxOptions`, so we need to maintain
      // support for it until lerna can be updated to use the syntax.
      // TODO(@agentender): Remove this part in v17
      if (
        projectSpecifier === 'dependencies' &&
        !this.projectGraph.nodes[projectSpecifier]
      ) {
        this.processTasksForDependencies(
          projectUsedToDeriveDependencies,
          dependencyConfig,
          configuration,
          task,
          taskOverrides,
          overrides
        );
      } else {
        // Since we need to maintain support for dependencies, it is more coherent
        // that we also support self.
        // TODO(@agentender): Remove this part in v17
        const matchingProjects =
          /** LERNA SUPPORT START - Remove in v17 */
          projectSpecifier === 'self' &&
          !this.projectGraph.nodes[projectSpecifier]
            ? [task.target.project]
            : /** LERNA SUPPORT END */
              findMatchingProjects([projectSpecifier], this.projectGraph.nodes);

        if (matchingProjects.length === 0) {
          output.warn({
            title: `\`dependsOn\` is misconfigured for ${task.target.project}:${task.target.target}`,
            bodyLines: [
              `Project pattern "${projectSpecifier}" does not match any projects.`,
            ],
          });
        }

        for (const projectName of matchingProjects) {
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
      const selfTaskId = this.getId(
        selfProject.name,
        dependencyConfig.target,
        resolvedConfiguration
      );
      if (task.id !== selfTaskId) {
        this.dependencies[task.id].push(selfTaskId);
      }
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
        this.processTask(
          newTask,
          newTask.target.project,
          configuration,
          overrides
        );
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
  ) {
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
        const depTargetId = this.getId(
          depProject.name,
          dependencyConfig.target,
          resolvedConfiguration
        );

        if (task.id !== depTargetId) {
          this.dependencies[task.id].push(depTargetId);
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

          this.processTask(
            newTask,
            newTask.target.project,
            configuration,
            overrides
          );
        }
      } else {
        this.processTask(task, depProject.name, configuration, overrides);
      }
    }
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

    return {
      id,
      target: qualifiedTarget,
      projectRoot: project.data.root,
      overrides: interpolateOverrides(overrides, project.name, project.data),
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

  getId(
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
}

export function createTaskGraph(
  projectGraph: ProjectGraph,
  defaultDependencyConfigs: TargetDependencies,
  projectNames: string[],
  targets: string[],
  configuration: string | undefined,
  overrides: Object,
  excludeTaskDependencies: boolean = false
): TaskGraph {
  const p = new ProcessTasks(defaultDependencyConfigs, projectGraph);
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
  };
}

export function mapTargetDefaultsToDependencies(
  defaults: TargetDefaults
): TargetDependencies {
  const res = {};
  Object.keys(defaults).forEach((k) => {
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
