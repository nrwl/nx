import * as minimatch from 'minimatch';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph, ProjectGraphDependency } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import {
  ExpandedDepsOutput,
  ExpandedInput,
  ExpandedSelfInput,
  expandNamedInput,
  expandSingleProjectInputs,
  extractPatternsFromFileSets,
  getInputs,
  getNamedInputs,
  isDepsOutput,
  isSelfInput,
} from '../hasher/task-hasher';
import { findMatchingProjects } from '../utils/find-matching-projects';
import { findAllProjectNodeDependencies } from '../utils/project-graph-utils';
import { workspaceRoot } from '../utils/workspace-root';
import { getOutputsForTargetAndConfiguration } from './utils';

export class TaskPlanner {
  constructor(
    private readonly nxJson: NxJsonConfiguration,
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly legacyRuntimeInputs: { runtime: string }[],
    private readonly legacyFilesetInputs: { fileset: string }[]
  ) {}

  getTaskPlans(tasks: Task[]): Record<string, string[]> {
    return tasks.reduce((acc, task) => {
      acc[task.id] = this.getTaskPlan(task, [task.target.project]);
      return acc;
    }, {});
  }

  getTaskPlan(task: Task, visited: string[]): string[] {
    const { selfInputs, depsInputs, depsOutputs, projectInputs } = getInputs(
      task,
      this.projectGraph,
      this.nxJson
    );

    const target = this.targetInput(
      task.target.project,
      task.target.target,
      selfInputs
    );

    const selfAndInputs = this.getSelfAndDepsInputs(
      task.target.project,
      task,
      { selfInputs, depsInputs, depsOutputs, projectInputs },
      visited,
      // TODO(cammisuli): put this back when the task hasher is replaced
      // target.includes('AllExternalDependencies')
      false
    );

    return selfAndInputs.concat(target);
  }

  private getNamedInputsForDependencies(
    projectName: string,
    task: Task,
    namedInput: string,
    visited: string[],
    skipExternalDeps
  ): string[] {
    const projectNode = this.projectGraph.nodes[projectName];
    const namedInputs = {
      default: [{ fileset: '{projectRoot}/**/*' }],
      ...this.nxJson.namedInputs,
      ...projectNode.data.namedInputs,
    };

    const expandedInputs = expandNamedInput(namedInput, namedInputs);
    const selfInputs = expandedInputs.filter(isSelfInput);
    const depsOutputs = expandedInputs.filter(isDepsOutput);
    const depsInputs = [{ input: namedInput, dependencies: true as true }]; // true is boolean by default
    return this.getSelfAndDepsInputs(
      projectName,
      task,
      { selfInputs, depsInputs, depsOutputs, projectInputs: [] },
      visited,
      skipExternalDeps
    );
  }

  private getSelfAndDepsInputs(
    projectName: string,
    task: Task,
    inputs: {
      selfInputs: ExpandedSelfInput[];
      depsInputs: { input: string; dependencies: true }[];
      depsOutputs: ExpandedDepsOutput[];
      projectInputs: { input: string; projects: string[] }[];
    },
    visited: string[],
    skipExternalDeps
  ): string[] {
    const projectGraphDeps = this.projectGraph.dependencies[projectName] ?? [];

    const self = this.singleProjectInputs(projectName, inputs.selfInputs);
    const deps = this.getDepsInputs(
      task,
      inputs.depsInputs,
      projectGraphDeps,
      visited,
      skipExternalDeps
    );

    const depsOut = this.getDepsOutputs(task, inputs.depsOutputs);
    const projects = this.getProjectInputs(inputs.projectInputs);

    return Array.from(new Set([...self, ...deps, ...depsOut, ...projects]));
  }

  private getDepsInputs(
    task: Task,
    inputs: { input: string }[],
    projectGraphDeps: ProjectGraphDependency[],
    visited: string[],
    skipExternalDeps
  ): string[] {
    return inputs
      .map((input) => {
        return projectGraphDeps
          .map((d) => {
            if (visited.indexOf(d.target) > -1) {
              return null;
            } else {
              visited.push(d.target);
              if (this.projectGraph.nodes[d.target]) {
                return this.getNamedInputsForDependencies(
                  d.target,
                  task,
                  input.input || 'default',
                  visited,
                  skipExternalDeps
                );
              } else {
                if (skipExternalDeps) {
                  return null;
                } else {
                  // external dependency
                  const deps = findAllProjectNodeDependencies(
                    d.target,
                    this.projectGraph,
                    true
                  );
                  return [d.target, ...deps];
                }
              }
            }
          })
          .flat();
      })
      .flat()
      .filter((r) => !!r);
  }

  private getDepsOutputs(
    task: Task,
    depsOutputs: ExpandedDepsOutput[]
  ): string[] {
    if (depsOutputs.length === 0) {
      return [];
    }
    const result: string[] = [];
    for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
      result.push(
        ...this.getDepOutput(task, dependentTasksOutputFiles, transitive)
      );
    }
    return result;
  }

  private getDepOutput(
    task: Task,
    dependentTasksOutputFiles: string,
    transitive?: boolean
  ): string[] {
    // task has no dependencies
    if (!this.taskGraph.dependencies[task.id]) {
      return [];
    }

    const inputs: string[] = [];
    for (const d of this.taskGraph.dependencies[task.id]) {
      const childTask = this.taskGraph.tasks[d];
      const outputs = getOutputsForTargetAndConfiguration(
        childTask,
        this.projectGraph.nodes[childTask.target.project]
      );
      const { getFilesForOutputs } =
        require('../native') as typeof import('../native');
      const outputFiles = getFilesForOutputs(workspaceRoot, outputs);
      const filteredFiles = outputFiles.filter(
        (p) =>
          p === dependentTasksOutputFiles ||
          minimatch(p, dependentTasksOutputFiles)
      );

      inputs.push(...filteredFiles);

      if (transitive) {
        inputs.push(
          ...this.getDepOutput(childTask, dependentTasksOutputFiles, transitive)
        );
      }
    }
    return inputs;
  }

  private targetInput(
    projectName: string,
    targetName: string,
    selfInputs: ExpandedSelfInput[]
  ): string[] | undefined {
    const projectNode = this.projectGraph.nodes[projectName];
    const target = projectNode.data.targets[targetName];

    if (!target) {
      return;
    }

    // we can only vouch for @nx packages's executor dependencies
    // if it's "run commands" or third-party we skip traversing since we have no info what this command depends on
    if (
      target.executor.startsWith(`@nrwl/`) ||
      target.executor.startsWith(`@nx/`)
    ) {
      const executorPackage = target.executor.split(':')[0];
      return [this.findExternalDependencyNodeName(executorPackage)];
    } else {
      // use command external dependencies if available to construct the hash
      const externalDeps: string[] = [];
      let hasCommandExternalDependencies = false;
      for (const input of selfInputs) {
        if (input['externalDependencies']) {
          // if we have externalDependencies with empty array we still want to override the default hash
          hasCommandExternalDependencies = true;
          const externalDependencies = input['externalDependencies'];
          for (let externalDependency of externalDependencies) {
            let externalNodeName =
              this.findExternalDependencyNodeName(externalDependency);

            if (!externalDependency) {
              throw new Error(
                `The externalDependency "${externalDependency}" for "${projectName}:${targetName}" could not be found`
              );
            }

            const deps = findAllProjectNodeDependencies(
              externalNodeName,
              this.projectGraph,
              true
            );

            externalDeps.push(externalDependency, ...deps);
          }
        }
      }
      if (hasCommandExternalDependencies) {
        return externalDeps;
      } else {
        return ['AllExternalDependencies'];
      }
    }
  }

  private findExternalDependencyNodeName(packageName: string): string {
    if (this.projectGraph.externalNodes?.[packageName]) {
      return packageName;
    }
    if (this.projectGraph.externalNodes?.[`npm:${packageName}`]) {
      return `npm:${packageName}`;
    }
    for (const node of Object.values(this.projectGraph.externalNodes ?? {})) {
      if (node.data.packageName === packageName) {
        return node.name;
      }
    }
    // not found, just return the package name
    return packageName;
  }

  private singleProjectInputs(
    projectName: string,
    inputs: ExpandedInput[]
  ): string[] {
    const filesets = extractPatternsFromFileSets(inputs);

    const projectFilesets = [];
    const workspaceFilesets = [];
    let invalidFilesetNoPrefix = null;

    for (let f of filesets) {
      if (f.startsWith('{projectRoot}/') || f.startsWith('!{projectRoot}/')) {
        projectFilesets.push(f);
      } else if (
        f.startsWith('{workspaceRoot}/') ||
        f.startsWith('!{workspaceRoot}/')
      ) {
        workspaceFilesets.push(f);
      } else {
        invalidFilesetNoPrefix = f;
      }
    }

    if (invalidFilesetNoPrefix) {
      throw new Error(
        [
          `"${invalidFilesetNoPrefix}" is an invalid fileset.`,
          'All filesets have to start with either {workspaceRoot} or {projectRoot}.',
          'For instance: "!{projectRoot}/**/*.spec.ts" or "{workspaceRoot}/package.json".',
          `If "${invalidFilesetNoPrefix}" is a named input, make sure it is defined in, for instance, nx.json.`,
        ].join('\n')
      );
    }

    const notFilesets = inputs.filter((r) => !r['fileset']);
    return [
      ...this.projectFileSetInputs(projectName, projectFilesets),
      ...[
        ...workspaceFilesets,
        ...this.legacyFilesetInputs.map((input) => input.fileset),
      ].map((fileset) => this.rootFilesetInput(fileset)),
      ...[...notFilesets, ...this.legacyRuntimeInputs].map((r) =>
        r['runtime'] ? this.runtimeInput(r['runtime']) : this.envInput(r['env'])
      ),
    ];
  }

  private getProjectInputs(
    projectInputs: { input: string; projects: string[] }[]
  ): string[] {
    const gatheredInputs: string[][] = [];
    for (const input of projectInputs) {
      const projects = findMatchingProjects(
        input.projects,
        this.projectGraph.nodes
      );
      for (const project of projects) {
        const namedInputs = getNamedInputs(
          this.nxJson,
          this.projectGraph.nodes[project]
        );
        const expandedInput = expandSingleProjectInputs(
          [{ input: input.input }],
          namedInputs
        );
        gatheredInputs.push(this.singleProjectInputs(project, expandedInput));
      }
    }
    return gatheredInputs.flat();
  }

  private rootFilesetInput(fileset: string): string {
    return fileset;
  }

  private projectFileSetInputs(
    projectName: string,
    filesetPatterns: string[]
  ): string[] {
    let projectInput = [];
    projectInput.push(`${projectName}:${filesetPatterns.join(',')}`);
    projectInput.push(`ProjectConfiguration`);
    projectInput.push(`TsConfig`);

    return projectInput;
  }

  private runtimeInput(runtime: string): string {
    return `runtime:${runtime}`;
  }

  private envInput(envVarName: string): string {
    return `env:${envVarName}`;
  }
}
