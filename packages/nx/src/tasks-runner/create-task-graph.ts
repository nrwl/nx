import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { getDependencyConfigs, interpolate } from './utils';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utils/project-graph-utils';
import { Task, TaskGraph } from '../config/task-graph';
import { TargetDependencies } from '../config/nx-json';

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
    overrides: Object
  ) {
    for (const projectName of projectNames) {
      for (const target of targets) {
        const resolvedConfiguration = this.resolveConfiguration(
          this.projectGraph.nodes[projectName],
          target,
          configuration
        );
        const id = this.getId(projectName, target, resolvedConfiguration);
        const task = this.createTask(
          id,
          this.projectGraph.nodes[projectName],
          target,
          resolvedConfiguration,
          overrides
        );
        this.tasks[task.id] = task;
        this.dependencies[task.id] = [];
      }
    }
    for (const taskId of Object.keys(this.tasks)) {
      const task = this.tasks[taskId];
      this.processTask(task, task.target.project, configuration);
    }
    return Object.keys(this.dependencies).filter(
      (d) => this.dependencies[d].length === 0
    );
  }

  processTask(
    task: Task,
    projectUsedToDeriveDependencies: string,
    configuration: string
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
      if (dependencyConfig.projects === 'dependencies') {
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
                { __overrides_unparsed__: [] }
              );
              this.tasks[depTargetId] = newTask;
              this.dependencies[depTargetId] = [];

              this.processTask(newTask, newTask.target.project, configuration);
            }
          } else {
            this.processTask(task, depProject.name, configuration);
          }
        }
      } else {
        const selfProject = this.projectGraph.nodes[
          task.target.project
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
              { __overrides_unparsed__: [] }
            );
            this.tasks[selfTaskId] = newTask;
            this.dependencies[selfTaskId] = [];
            this.processTask(newTask, newTask.target.project, configuration);
          }
        }
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
    configuration ??= project.data.targets?.[target]?.defaultConfiguration;
    return projectHasTargetAndConfiguration(project, target, configuration)
      ? configuration
      : undefined;
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
  overrides: Object
): TaskGraph {
  const p = new ProcessTasks(defaultDependencyConfigs, projectGraph);
  const roots = p.processTasks(projectNames, targets, configuration, overrides);
  return {
    roots,
    tasks: p.tasks,
    dependencies: p.dependencies,
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
