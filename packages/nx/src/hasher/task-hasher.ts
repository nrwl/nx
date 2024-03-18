import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { DaemonClient } from '../daemon/client/client';
import { hashArray } from './file-hasher';
import { NodeTaskHasherImpl } from './node-task-hasher-impl';
import { InputDefinition } from '../config/workspace-json-project-json';
import { minimatch } from 'minimatch';
import { NativeTaskHasherImpl } from './native-task-hasher-impl';
import { workspaceRoot } from '../utils/workspace-root';
import { NxWorkspaceFilesExternals } from '../native';

/**
 * A data structure returned by the default hasher.
 */
export interface PartialHash {
  value: string;
  details: {
    [name: string]: string;
  };
}

/**
 * A data structure returned by the default hasher.
 */
export interface Hash {
  value: string;
  details: {
    command: string;
    nodes: { [name: string]: string };
    implicitDeps?: { [fileName: string]: string };
    runtime?: { [input: string]: string };
  };
}

export interface TaskHasher {
  /**
   * @deprecated use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v19
   * @param task
   */
  hashTask(task: Task): Promise<Hash>;

  /**
   * @deprecated use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v19
   */
  hashTask(task: Task, taskGraph: TaskGraph): Promise<Hash>;

  hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<Hash>;

  /**
   *  @deprecated use hashTasks(tasks:Task[], taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v19
   * @param tasks
   */
  hashTasks(tasks: Task[]): Promise<Hash[]>;

  /**
   * @deprecated use hashTasks(tasks:Task[], taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v19
   */
  hashTasks(tasks: Task[], taskGraph: TaskGraph): Promise<Hash[]>;

  hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<Hash[]>;
}

export interface TaskHasherImpl {
  hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<PartialHash[]>;

  hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    visited?: string[]
  ): Promise<PartialHash>;
}

export type Hasher = TaskHasher;

export class DaemonBasedTaskHasher implements TaskHasher {
  constructor(
    private readonly daemonClient: DaemonClient,
    private readonly runnerOptions: any
  ) {}

  async hashTasks(
    tasks: Task[],
    taskGraph?: TaskGraph,
    env?: NodeJS.ProcessEnv
  ): Promise<Hash[]> {
    return this.daemonClient.hashTasks(
      this.runnerOptions,
      tasks,
      taskGraph,
      env ?? process.env
    );
  }

  async hashTask(
    task: Task,
    taskGraph?: TaskGraph,
    env?: NodeJS.ProcessEnv
  ): Promise<Hash> {
    return (
      await this.daemonClient.hashTasks(
        this.runnerOptions,
        [task],
        taskGraph,
        env ?? process.env
      )
    )[0];
  }
}

export class InProcessTaskHasher implements TaskHasher {
  static version = '3.0';
  private taskHasher: TaskHasherImpl;

  private useNativeTaskHasher = process.env.NX_NATIVE_TASK_HASHER !== 'false';

  constructor(
    private readonly projectFileMap: ProjectFileMap,
    private readonly allWorkspaceFiles: FileData[],
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly externalRustReferences: NxWorkspaceFilesExternals | null,
    private readonly options: any
  ) {
    const legacyRuntimeInputs = (
      this.options && this.options.runtimeCacheInputs
        ? this.options.runtimeCacheInputs
        : []
    ).map((r) => ({ runtime: r }));

    if (process.env.NX_CLOUD_ENCRYPTION_KEY) {
      legacyRuntimeInputs.push({ env: 'NX_CLOUD_ENCRYPTION_KEY' });
    }

    const legacyFilesetInputs = [
      'nx.json',

      // ignore files will change the set of inputs to the hasher
      '.gitignore',
      '.nxignore',
    ].map((d) => ({ fileset: `{workspaceRoot}/${d}` }));

    this.taskHasher = !this.useNativeTaskHasher
      ? new NodeTaskHasherImpl(
          nxJson,
          legacyRuntimeInputs,
          legacyFilesetInputs,
          this.projectFileMap,
          this.allWorkspaceFiles,
          this.projectGraph,
          {
            selectivelyHashTsConfig:
              this.options?.selectivelyHashTsConfig ?? false,
          }
        )
      : new NativeTaskHasherImpl(
          workspaceRoot,
          nxJson,
          this.projectGraph,
          this.externalRustReferences,
          {
            selectivelyHashTsConfig:
              this.options?.selectivelyHashTsConfig ?? false,
          }
        );
  }

  async hashTasks(
    tasks: Task[],
    taskGraph?: TaskGraph,
    env?: NodeJS.ProcessEnv
  ): Promise<Hash[]> {
    if (this.useNativeTaskHasher) {
      const hashes = await this.taskHasher.hashTasks(
        tasks,
        taskGraph,
        env ?? process.env
      );
      return tasks.map((task, index) =>
        this.createHashDetails(task, hashes[index])
      );
    } else {
      return await Promise.all(
        tasks.map((t) => this.hashTask(t, taskGraph, env))
      );
    }
  }

  async hashTask(
    task: Task,
    taskGraph?: TaskGraph,
    env?: NodeJS.ProcessEnv
  ): Promise<Hash> {
    const res = await this.taskHasher.hashTask(
      task,
      taskGraph,
      env ?? process.env
    );
    return this.createHashDetails(task, res);
  }

  private createHashDetails(task: Task, res: PartialHash) {
    const command = this.hashCommand(task);
    return {
      value: hashArray([res.value, command]),
      details: {
        command,
        nodes: res.details,
        implicitDeps: {},
        runtime: {},
      },
    };
  }

  private hashCommand(task: Task): string {
    const overrides = { ...task.overrides };
    delete overrides['__overrides_unparsed__'];
    const sortedOverrides = {};
    for (let k of Object.keys(overrides).sort()) {
      sortedOverrides[k] = overrides[k];
    }

    return hashArray([
      task.target.project ?? '',
      task.target.target ?? '',
      task.target.configuration ?? '',
      JSON.stringify(sortedOverrides),
    ]);
  }
}

export type ExpandedSelfInput =
  | { fileset: string }
  | { runtime: string }
  | { env: string }
  | { externalDependencies: string[] };
export type ExpandedDepsOutput = {
  dependentTasksOutputFiles: string;
  transitive?: boolean;
};
export type ExpandedInput = ExpandedSelfInput | ExpandedDepsOutput;
const DEFAULT_INPUTS: ReadonlyArray<InputDefinition> = [
  {
    fileset: '{projectRoot}/**/*',
  },
  {
    dependencies: true,
    input: 'default',
  },
];

export function getNamedInputs(
  nxJson: NxJsonConfiguration,
  project: ProjectGraphProjectNode
) {
  return {
    default: [{ fileset: '{projectRoot}/**/*' }],
    ...nxJson.namedInputs,
    ...project.data.namedInputs,
  };
}

export function getTargetInputs(
  nxJson: NxJsonConfiguration,
  projectNode: ProjectGraphProjectNode,
  target: string
) {
  const namedInputs = getNamedInputs(nxJson, projectNode);

  const targetData = projectNode.data.targets[target];
  const targetDefaults = (nxJson.targetDefaults || {})[target];

  const inputs = splitInputsIntoSelfAndDependencies(
    targetData.inputs || targetDefaults?.inputs || DEFAULT_INPUTS,
    namedInputs
  );

  const selfInputs = extractPatternsFromFileSets(inputs.selfInputs);

  const dependencyInputs = extractPatternsFromFileSets(
    inputs.depsInputs.map((s) => expandNamedInput(s.input, namedInputs)).flat()
  );

  return { selfInputs, dependencyInputs };
}

export function extractPatternsFromFileSets(
  inputs: readonly ExpandedInput[]
): string[] {
  return inputs
    .filter((c): c is { fileset: string } => !!c['fileset'])
    .map((c) => c['fileset']);
}

export function getInputs(
  task: Task,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
) {
  const projectNode = projectGraph.nodes[task.target.project];
  const namedInputs = getNamedInputs(nxJson, projectNode);
  const targetData = projectNode.data.targets[task.target.target];
  const targetDefaults = (nxJson.targetDefaults || {})[task.target.target];
  const { selfInputs, depsInputs, depsOutputs, projectInputs } =
    splitInputsIntoSelfAndDependencies(
      targetData.inputs || targetDefaults?.inputs || (DEFAULT_INPUTS as any),
      namedInputs
    );
  return { selfInputs, depsInputs, depsOutputs, projectInputs };
}

function splitInputsIntoSelfAndDependencies(
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): {
  depsInputs: { input: string; dependencies: true }[];
  projectInputs: { input: string; projects: string[] }[];
  selfInputs: ExpandedSelfInput[];
  depsOutputs: ExpandedDepsOutput[];
} {
  const depsInputs: { input: string; dependencies: true }[] = [];
  const projectInputs: { input: string; projects: string[] }[] = [];
  const selfInputs = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^')) {
        depsInputs.push({ input: d.substring(1), dependencies: true });
      } else {
        selfInputs.push(d);
      }
    } else {
      if (
        ('dependencies' in d && d.dependencies) ||
        // Todo(@AgentEnder): Remove check in v17
        ('projects' in d &&
          typeof d.projects === 'string' &&
          d.projects === 'dependencies')
      ) {
        depsInputs.push({
          input: d.input,
          dependencies: true,
        });
      } else if (
        'projects' in d &&
        d.projects &&
        // Todo(@AgentEnder): Remove check in v17
        !(d.projects === 'self')
      ) {
        projectInputs.push({
          input: d.input,
          projects: Array.isArray(d.projects) ? d.projects : [d.projects],
        });
      } else {
        selfInputs.push(d);
      }
    }
  }
  const expandedInputs = expandSingleProjectInputs(selfInputs, namedInputs);
  return {
    depsInputs,
    projectInputs,
    selfInputs: expandedInputs.filter(isSelfInput),
    depsOutputs: expandedInputs.filter(isDepsOutput),
  };
}

export function isSelfInput(input: ExpandedInput): input is ExpandedSelfInput {
  return !('dependentTasksOutputFiles' in input);
}

export function isDepsOutput(
  input: ExpandedInput
): input is ExpandedDepsOutput {
  return 'dependentTasksOutputFiles' in input;
}

export function expandSingleProjectInputs(
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): ExpandedInput[] {
  const expanded = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^'))
        throw new Error(`namedInputs definitions cannot start with ^`);

      if (namedInputs[d]) {
        expanded.push(...expandNamedInput(d, namedInputs));
      } else {
        expanded.push({ fileset: d });
      }
    } else {
      if ((d as any).projects || (d as any).dependencies) {
        throw new Error(
          `namedInputs definitions can only refer to other namedInputs definitions within the same project.`
        );
      }
      if (
        (d as any).fileset ||
        (d as any).env ||
        (d as any).runtime ||
        (d as any).externalDependencies ||
        (d as any).dependentTasksOutputFiles
      ) {
        expanded.push(d);
      } else {
        expanded.push(...expandNamedInput((d as any).input, namedInputs));
      }
    }
  }
  return expanded;
}

export function expandNamedInput(
  input: string,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): ExpandedInput[] {
  namedInputs ||= {};
  if (!namedInputs[input]) throw new Error(`Input '${input}' is not defined`);
  return expandSingleProjectInputs(namedInputs[input], namedInputs);
}

export function filterUsingGlobPatterns(
  root: string,
  files: FileData[],
  patterns: string[]
): FileData[] {
  const filesetWithExpandedProjectRoot = patterns
    .map((f) => f.replace('{projectRoot}', root))
    .map((r) => {
      // handling root level projects that create './' pattern that doesn't work with minimatch
      if (r.startsWith('./')) return r.substring(2);
      if (r.startsWith('!./')) return '!' + r.substring(3);
      return r;
    });

  const positive = [];
  const negative = [];
  for (const p of filesetWithExpandedProjectRoot) {
    if (p.startsWith('!')) {
      negative.push(p);
    } else {
      positive.push(p);
    }
  }

  if (positive.length === 0 && negative.length === 0) {
    return files;
  }

  return files.filter((f) => {
    let matchedPositive = false;
    if (
      positive.length === 0 ||
      (positive.length === 1 && positive[0] === `${root}/**/*`)
    ) {
      matchedPositive = true;
    } else {
      matchedPositive = positive.some((pattern) => minimatch(f.file, pattern));
    }

    if (!matchedPositive) return false;

    return negative.every((pattern) => minimatch(f.file, pattern));
  });
}
