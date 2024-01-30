import { NxJsonConfiguration } from '../config/nx-json';
import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphDependency,
} from '../config/project-graph';
import { createProjectRootMappings } from '../project-graph/utils/find-project-for-path';
import { Task, TaskGraph } from '../config/task-graph';
import { hashArray, hashObject } from './file-hasher';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
import { workspaceRoot } from '../utils/workspace-root';
import { minimatch } from 'minimatch';
import { join } from 'path';
import { hashFile } from '../native';
import { findAllProjectNodeDependencies } from '../utils/project-graph-utils';
import { findMatchingProjects } from '../utils/find-matching-projects';
import { exec } from 'child_process';
import {
  ExpandedDepsOutput,
  ExpandedInput,
  ExpandedSelfInput,
  expandNamedInput,
  expandSingleProjectInputs,
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
  getInputs,
  getNamedInputs,
  isDepsOutput,
  isSelfInput,
  PartialHash,
  TaskHasher,
  TaskHasherImpl,
} from './task-hasher';
import { hashTsConfig } from '../plugins/js/hasher/hasher';

export class NodeTaskHasherImpl implements TaskHasherImpl {
  private filesetHashes: {
    [taskId: string]: Promise<PartialHash>;
  } = {};
  private runtimeHashes: {
    [runtime: string]: Promise<PartialHash>;
  } = {};
  private externalDependencyHashes: Map<string, PartialHash[]> = new Map<
    string,
    PartialHash[]
  >();
  private allExternalDependenciesHash: PartialHash;
  private projectRootMappings = createProjectRootMappings(
    this.projectGraph.nodes
  );

  constructor(
    private readonly nxJson: NxJsonConfiguration,
    private readonly legacyRuntimeInputs: { runtime: string }[],
    private readonly legacyFilesetInputs: { fileset: string }[],
    private readonly projectFileMap: ProjectFileMap,
    private readonly allWorkspaceFiles: FileData[],
    private readonly projectGraph: ProjectGraph,
    private readonly options: { selectivelyHashTsConfig: boolean }
  ) {
    // External Dependencies are all calculated up front in a deterministic order
    this.calculateExternalDependencyHashes();
  }

  hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<PartialHash[]> {
    return Promise.all(tasks.map((t) => this.hashTask(t, taskGraph, env, [])));
  }

  async hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    visited: string[] = []
  ): Promise<PartialHash> {
    return Promise.resolve().then(async () => {
      const { selfInputs, depsInputs, depsOutputs, projectInputs } = getInputs(
        task,
        this.projectGraph,
        this.nxJson
      );

      const selfAndInputs = await this.hashSelfAndDepsInputs(
        task.target.project,
        task,
        selfInputs,
        depsInputs,
        depsOutputs,
        projectInputs,
        taskGraph,
        env,
        visited
      );

      const target = this.hashTarget(
        task.target.project,
        task.target.target,
        selfInputs
      );
      if (target) {
        return this.combinePartialHashes([selfAndInputs, target]);
      }
      return selfAndInputs;
    });
  }

  private async hashNamedInputForDependencies(
    projectName: string,
    task: Task,
    namedInput: string,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    visited: string[]
  ): Promise<PartialHash> {
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
    return this.hashSelfAndDepsInputs(
      projectName,
      task,
      selfInputs,
      depsInputs,
      depsOutputs,
      [],
      taskGraph,
      env,
      visited
    );
  }

  private async hashSelfAndDepsInputs(
    projectName: string,
    task: Task,
    selfInputs: ExpandedSelfInput[],
    depsInputs: { input: string; dependencies: true }[],
    depsOutputs: ExpandedDepsOutput[],
    projectInputs: { input: string; projects: string[] }[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    visited: string[]
  ) {
    const projectGraphDeps = this.projectGraph.dependencies[projectName] ?? [];
    // we don't want random order of dependencies to change the hash
    projectGraphDeps.sort((a, b) => a.target.localeCompare(b.target));

    const self = await this.hashSingleProjectInputs(
      projectName,
      selfInputs,
      env
    );
    const deps = await this.hashDepsInputs(
      task,
      depsInputs,
      projectGraphDeps,
      taskGraph,
      env,
      visited
    );
    const depsOut = await this.hashDepsOutputs(task, depsOutputs, taskGraph);
    const projects = await this.hashProjectInputs(projectInputs, env);

    return this.combinePartialHashes([
      ...self,
      ...deps,
      ...projects,
      ...depsOut,
    ]);
  }

  private combinePartialHashes(partialHashes: PartialHash[]): PartialHash {
    if (partialHashes.length === 1) {
      return partialHashes[0];
    }
    const details = {};
    const hashValues: string[] = [];
    for (const partial of partialHashes) {
      hashValues.push(partial.value);
      Object.assign(details, partial.details);
    }
    const value = hashArray(hashValues);

    return { value, details };
  }

  private async hashDepsInputs(
    task: Task,
    inputs: { input: string }[],
    projectGraphDeps: ProjectGraphDependency[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    visited: string[]
  ): Promise<PartialHash[]> {
    return (
      await Promise.all(
        inputs.map(async (input) => {
          return await Promise.all(
            projectGraphDeps.map(async (d) => {
              if (visited.indexOf(d.target) > -1) {
                return null;
              } else {
                visited.push(d.target);
                if (this.projectGraph.nodes[d.target]) {
                  return await this.hashNamedInputForDependencies(
                    d.target,
                    task,
                    input.input || 'default',
                    taskGraph,
                    env,
                    visited
                  );
                } else {
                  return this.getExternalDependencyHash(d.target);
                }
              }
            })
          );
        })
      )
    )
      .flat()
      .filter((r) => !!r);
  }

  private async hashDepsOutputs(
    task: Task,
    depsOutputs: ExpandedDepsOutput[],
    taskGraph: TaskGraph
  ): Promise<PartialHash[]> {
    if (depsOutputs.length === 0) {
      return [];
    }
    const result: PartialHash[] = [];
    for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
      result.push(
        ...(await this.hashDepOuputs(
          task,
          dependentTasksOutputFiles,
          taskGraph,
          transitive
        ))
      );
    }
    return result;
  }

  private async hashDepOuputs(
    task: Task,
    dependentTasksOutputFiles: string,
    taskGraph: TaskGraph,
    transitive?: boolean
  ): Promise<PartialHash[]> {
    // task has no dependencies
    if (!taskGraph.dependencies[task.id]) {
      return [];
    }

    const partialHashes: PartialHash[] = [];
    for (const d of taskGraph.dependencies[task.id]) {
      const childTask = taskGraph.tasks[d];
      const outputs = getOutputsForTargetAndConfiguration(
        childTask.target,
        childTask.overrides,
        this.projectGraph.nodes[childTask.target.project]
      );
      const { getFilesForOutputs } =
        require('../native') as typeof import('../native');
      const outputFiles = getFilesForOutputs(workspaceRoot, outputs);
      const filteredFiles = outputFiles.filter(
        (p) =>
          p === dependentTasksOutputFiles ||
          minimatch(p, dependentTasksOutputFiles, { dot: true })
      );
      const hashDetails = {};
      const hashes: string[] = [];
      for (const [file, hash] of this.hashFiles(
        filteredFiles.map((p) => join(workspaceRoot, p))
      )) {
        hashes.push(hash);
      }

      let hash = hashArray(hashes);
      partialHashes.push({
        value: hash,
        details: {
          [`${dependentTasksOutputFiles}:${outputs.join(',')}`]: hash,
        },
      });
      if (transitive) {
        partialHashes.push(
          ...(await this.hashDepOuputs(
            childTask,
            dependentTasksOutputFiles,
            taskGraph,
            transitive
          ))
        );
      }
    }
    return partialHashes;
  }

  private hashFiles(files: string[]): Map<string, string> {
    const r = new Map<string, string>();
    for (let f of files) {
      r.set(f, hashFile(f));
    }
    return r;
  }

  private getExternalDependencyHash(externalNodeName: string) {
    const combinedHash = this.combinePartialHashes(
      this.externalDependencyHashes.get(externalNodeName)
    );
    // Set the combined hash into the hashes so it's not recalculated next time
    this.externalDependencyHashes.set(externalNodeName, [combinedHash]);
    return combinedHash;
  }

  private hashSingleExternalDependency(externalNodeName: string): PartialHash {
    const node = this.projectGraph.externalNodes[externalNodeName];
    if (node.data.hash) {
      // we already know the hash of this dependency
      return {
        value: node.data.hash,
        details: {
          [externalNodeName]: node.data.hash,
        },
      };
    } else {
      // we take version as a hash
      return {
        value: node.data.version,
        details: {
          [externalNodeName]: node.data.version,
        },
      };
    }
  }

  private hashExternalDependency(externalNodeName: string) {
    const partialHashes: Set<PartialHash> = new Set<PartialHash>();
    partialHashes.add(this.hashSingleExternalDependency(externalNodeName));
    const deps = findAllProjectNodeDependencies(
      externalNodeName,
      this.projectGraph,
      true
    );
    for (const dep of deps) {
      partialHashes.add(this.hashSingleExternalDependency(dep));
    }
    return Array.from(partialHashes);
  }

  private hashTarget(
    projectName: string,
    targetName: string,
    selfInputs: ExpandedSelfInput[]
  ): PartialHash {
    const projectNode = this.projectGraph.nodes[projectName];
    const target = projectNode.data.targets[targetName];

    if (!target) {
      return;
    }

    let hash: string;
    // we can only vouch for @nx packages's executor dependencies
    // if it's "run commands" or third-party we skip traversing since we have no info what this command depends on
    if (
      target.executor.startsWith(`@nrwl/`) ||
      target.executor.startsWith(`@nx/`)
    ) {
      const executorPackage = target.executor.split(':')[0];
      const executorNodeName =
        this.findExternalDependencyNodeName(executorPackage);

      // This is either a local plugin or a non-existent executor
      if (!executorNodeName) {
        // TODO: This should not return null if it is a local plugin's executor
        return null;
      }

      return this.getExternalDependencyHash(executorNodeName);
    } else {
      // use command external dependencies if available to construct the hash
      const partialHashes: PartialHash[] = [];
      let hasCommandExternalDependencies = false;
      for (const input of selfInputs) {
        if (input['externalDependencies']) {
          // if we have externalDependencies with empty array we still want to override the default hash
          hasCommandExternalDependencies = true;
          const externalDependencies = input['externalDependencies'];
          for (let dep of externalDependencies) {
            dep = this.findExternalDependencyNodeName(dep);
            if (!dep) {
              throw new Error(
                `The externalDependency "${dep}" for "${projectName}:${targetName}" could not be found`
              );
            }

            partialHashes.push(this.getExternalDependencyHash(dep));
          }
        }
      }
      if (hasCommandExternalDependencies) {
        return this.combinePartialHashes(partialHashes);
      } else {
        // cache the hash of the entire external dependencies tree
        if (this.allExternalDependenciesHash) {
          return this.allExternalDependenciesHash;
        } else {
          hash = hashObject(this.projectGraph.externalNodes);
          this.allExternalDependenciesHash = {
            value: hash,
            details: {
              AllExternalDependencies: hash,
            },
          };
          return this.allExternalDependenciesHash;
        }
      }
    }
  }

  private findExternalDependencyNodeName(packageName: string): string | null {
    if (this.projectGraph.externalNodes[packageName]) {
      return packageName;
    }
    if (this.projectGraph.externalNodes[`npm:${packageName}`]) {
      return `npm:${packageName}`;
    }
    for (const node of Object.values(this.projectGraph.externalNodes)) {
      if (node.data.packageName === packageName) {
        return node.name;
      }
    }
    // not found
    return null;
  }

  private async hashSingleProjectInputs(
    projectName: string,
    inputs: ExpandedInput[],
    env: NodeJS.ProcessEnv
  ): Promise<PartialHash[]> {
    const filesets = extractPatternsFromFileSets(inputs);

    const projectFilesets = [];
    const workspaceFilesets = [];
    let invalidFilesetNoPrefix = null;
    let invalidFilesetWorkspaceRootNegative = null;

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
    if (invalidFilesetWorkspaceRootNegative) {
      throw new Error(
        [
          `"${invalidFilesetWorkspaceRootNegative}" is an invalid fileset.`,
          'It is not possible to negative filesets starting with {workspaceRoot}.',
        ].join('\n')
      );
    }

    const notFilesets = inputs.filter((r) => !r['fileset']);
    return Promise.all([
      this.hashProjectFileset(projectName, projectFilesets),
      this.hashProjectConfig(projectName),
      this.hashTsConfig(projectName),
      ...[
        ...workspaceFilesets,
        ...this.legacyFilesetInputs.map((r) => r.fileset),
      ].map((fileset) => this.hashRootFileset(fileset)),
      ...[...notFilesets, ...this.legacyRuntimeInputs].map((r) =>
        r['runtime']
          ? this.hashRuntime(env, r['runtime'])
          : this.hashEnv(env, r['env'])
      ),
    ]);
  }

  private async hashProjectInputs(
    projectInputs: { input: string; projects: string[] }[],
    env: NodeJS.ProcessEnv
  ): Promise<PartialHash[]> {
    const partialHashes: Promise<PartialHash[]>[] = [];
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
        partialHashes.push(
          this.hashSingleProjectInputs(project, expandedInput, env)
        );
      }
    }
    return Promise.all(partialHashes).then((hashes) => hashes.flat());
  }

  private async hashRootFileset(fileset: string): Promise<PartialHash> {
    const mapKey = fileset;
    const withoutWorkspaceRoot = fileset.substring(16);
    if (!this.filesetHashes[mapKey]) {
      this.filesetHashes[mapKey] = new Promise(async (res) => {
        const parts = [];
        const matchingFile = this.allWorkspaceFiles.find(
          (t) => t.file === withoutWorkspaceRoot
        );
        if (matchingFile) {
          parts.push(matchingFile.hash);
        } else {
          this.allWorkspaceFiles
            .filter((f) => minimatch(f.file, withoutWorkspaceRoot))
            .forEach((f) => {
              parts.push(f.hash);
            });
        }
        const value = hashArray(parts);
        res({
          value,
          details: { [mapKey]: value },
        });
      });
    }
    return this.filesetHashes[mapKey];
  }

  private hashProjectConfig(projectName: string): PartialHash {
    const p = this.projectGraph.nodes[projectName];
    const projectConfig = hashArray([
      JSON.stringify({ ...p.data, files: undefined }),
    ]);

    return {
      value: projectConfig,
      details: {
        [`${projectName}:ProjectConfiguration`]: projectConfig,
      },
    };
  }

  private hashTsConfig(projectName: string): PartialHash {
    const p = this.projectGraph.nodes[projectName];
    const tsConfig = hashArray([
      hashTsConfig(p, this.projectRootMappings, this.options),
    ]);
    return {
      value: tsConfig,
      details: {
        [`${projectName}:TsConfig`]: tsConfig,
      },
    };
  }

  private async hashProjectFileset(
    projectName: string,
    filesetPatterns: string[]
  ): Promise<PartialHash> {
    const mapKey = `${projectName}:${filesetPatterns.join(',')}`;
    if (!this.filesetHashes[mapKey]) {
      this.filesetHashes[mapKey] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[projectName];
        const filteredFiles = filterUsingGlobPatterns(
          p.data.root,
          this.projectFileMap[projectName] || [],
          filesetPatterns
        );
        const files: string[] = [];
        for (const { file, hash } of filteredFiles) {
          files.push(file, hash);
        }

        const value = hashArray(files);
        res({
          value,
          details: { [mapKey]: value },
        });
      });
    }
    return this.filesetHashes[mapKey];
  }

  private async hashRuntime(
    env: NodeJS.ProcessEnv,
    runtime: string
  ): Promise<PartialHash> {
    const env_key = JSON.stringify(env);
    const mapKey = `runtime:${runtime}-${env_key}`;
    if (!this.runtimeHashes[mapKey]) {
      this.runtimeHashes[mapKey] = new Promise((res, rej) => {
        exec(
          runtime,
          {
            windowsHide: true,
            cwd: workspaceRoot,
            env,
          },
          (err, stdout, stderr) => {
            if (err) {
              rej(
                new Error(
                  `Nx failed to execute {runtime: '${runtime}'}. ${err}.`
                )
              );
            } else {
              const value = hashArray([`${stdout}${stderr}`.trim()]);
              res({
                details: { [`runtime:${runtime}`]: value },
                value,
              });
            }
          }
        );
      });
    }
    return this.runtimeHashes[mapKey];
  }

  private async hashEnv(
    env: NodeJS.ProcessEnv,
    envVarName: string
  ): Promise<PartialHash> {
    const value = hashArray([env[envVarName] ?? '']);
    return {
      details: { [`env:${envVarName}`]: value },
      value,
    };
  }

  private calculateExternalDependencyHashes() {
    const keys = Object.keys(this.projectGraph.externalNodes);
    for (const externalNodeName of keys) {
      this.externalDependencyHashes.set(
        externalNodeName,
        this.hashExternalDependency(externalNodeName)
      );
    }
  }
}
