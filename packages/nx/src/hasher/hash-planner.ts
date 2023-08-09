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
  LEGACY_FILESET_INPUTS,
} from './task-hasher';
import { findMatchingProjects } from '../utils/find-matching-projects';
import { findAllProjectNodeDependencies } from '../utils/project-graph-utils';
import { workspaceRoot } from '../utils/workspace-root';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';

export class HashPlanner {
  private legacyRuntimeInputs: ExpandedSelfInput[];
  private legacyFileSetInputs: string[] = [];
  private externalDeps = new Map<string, string[]>();
  private taskInputs = new Map<string, string[]>();

  constructor(
    private readonly nxJson: NxJsonConfiguration,
    private readonly projectGraph: ProjectGraph,
    private options: { runtimeCacheInputs?: string[] }
  ) {
    const legacyRuntimeInputs: ExpandedSelfInput[] = (
      this.options && this.options.runtimeCacheInputs
        ? this.options.runtimeCacheInputs
        : []
    ).map((r) => ({ runtime: r }));
    if (process.env.NX_CLOUD_ENCRYPTION_KEY) {
      legacyRuntimeInputs.push({ env: 'NX_CLOUD_ENCRYPTION_KEY' });
    }

    this.setupExternalDeps();
    this.legacyFileSetInputs = LEGACY_FILESET_INPUTS.map((f) => f.fileset);
    this.legacyRuntimeInputs = legacyRuntimeInputs;
  }

  getHashPlan(
    taskId: string,
    taskGraph: TaskGraph,
    visited: string[] = [taskId]
  ): string[] {
    const task = taskGraph.tasks[taskId];
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
      taskGraph,
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
    taskGraph: TaskGraph,
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
      taskGraph,
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
    taskGraph: TaskGraph,
    visited: string[],
    skipExternalDeps: boolean
  ): string[] {
    if (this.taskInputs.has(task.id)) {
      return this.taskInputs.get(task.id);
    }

    const projectGraphDeps = this.projectGraph.dependencies[projectName] ?? [];

    const self = this.singleProjectInputs(projectName, inputs.selfInputs);
    const deps = this.getDepsInputs(
      task,
      inputs.depsInputs,
      projectGraphDeps,
      taskGraph,
      visited,
      skipExternalDeps
    );

    const depsOut = this.getDepsOutputs(task, taskGraph, inputs.depsOutputs);
    const projects = this.getProjectInputs(inputs.projectInputs);

    let collectedInputs = Array.from(
      new Set(self.concat(deps, depsOut, projects))
    );

    this.taskInputs.set(task.id, collectedInputs);
    return collectedInputs;
  }

  private getDepsInputs(
    task: Task,
    inputs: { input: string }[],
    projectGraphDeps: ProjectGraphDependency[],
    taskGraph: TaskGraph,
    visited: string[],
    skipExternalDeps: boolean
  ): string[] {
    const depInputs = [];

    for (const { input } of inputs) {
      for (const dep of projectGraphDeps) {
        if (visited.includes(dep.target)) {
          continue;
        }
        visited.push(dep.target);
        if (this.projectGraph.nodes[dep.target]) {
          depInputs.push(
            ...this.getNamedInputsForDependencies(
              dep.target,
              task,
              input || 'default',
              taskGraph,
              visited,
              skipExternalDeps
            )
          );
        } else {
          if (skipExternalDeps) {
            continue;
          }
          const deps = this.externalDeps.get(dep.target);
          depInputs.push(dep.target, ...deps);
        }
      }
    }

    return depInputs;
  }

  private getDepsOutputs(
    task: Task,
    taskGraph: TaskGraph,
    depsOutputs: ExpandedDepsOutput[]
  ): string[] {
    if (depsOutputs.length === 0) {
      return [];
    }
    const result: string[] = [];
    for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
      result.push(
        ...this.getDepOutput(
          task,
          taskGraph,
          dependentTasksOutputFiles,
          transitive
        )
      );
    }
    return result;
  }

  private getDepOutput(
    task: Task,
    taskGraph: TaskGraph,
    dependentTasksOutputFiles: string,
    transitive?: boolean
  ): string[] {
    // task has no dependencies
    if (!taskGraph.dependencies[task.id]) {
      return [];
    }

    const inputs: string[] = [];
    for (const d of taskGraph.dependencies[task.id]) {
      const childTask = taskGraph.tasks[d];
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
          ...this.getDepOutput(
            childTask,
            taskGraph,
            dependentTasksOutputFiles,
            transitive
          )
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

            const deps = this.externalDeps.get(externalNodeName);

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

    const projectFileSetInputs = this.projectFileSetInputs(
      projectName,
      projectFilesets
    );
    const workspaceFileSets = workspaceFilesets.concat(
      this.legacyFileSetInputs
    );

    const runtimeAndEnvInputs = inputs
      .filter((r) => !r['fileset'])
      .concat(this.legacyRuntimeInputs)
      .map((r) =>
        r['runtime'] ? this.runtimeInput(r['runtime']) : this.envInput(r['env'])
      );

    return projectFileSetInputs.concat(workspaceFileSets, runtimeAndEnvInputs);
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

  private setupExternalDeps() {
    const keys = Object.keys(this.projectGraph.externalNodes ?? {});
    for (const externalNodeName of keys) {
      this.externalDeps.set(
        externalNodeName,
        findAllProjectNodeDependencies(
          externalNodeName,
          this.projectGraph,
          true
        )
      );
    }
  }
}
