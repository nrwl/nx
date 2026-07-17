import {
  FileData,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { DaemonClient } from '../daemon/client/client';
import { hashArray } from './file-hasher';
import { InputDefinition } from '../config/workspace-json-project-json';
import { minimatch } from 'minimatch';
import { NativeTaskHasherImpl } from './native-task-hasher-impl';
import { workspaceRoot } from '../utils/workspace-root';
import { HashInputs, NxWorkspaceFilesExternals } from '../native';
import { getTaskIOService } from '../tasks-runner/task-io-service';

// Re-export HashInputs from native module for public API
export { HashInputs };

/**
 * A data structure returned by the default hasher.
 */
export interface PartialHash {
  value: string;
  details: {
    [name: string]: string;
  };
  inputs: HashInputs;
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
  inputs?: HashInputs;
}

export interface TaskHasher {
  /**
   * @deprecated use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20
   * @param task
   */
  hashTask(task: Task): Promise<Hash>;

  /**
   * @deprecated use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20
   */
  hashTask(task: Task, taskGraph: TaskGraph): Promise<Hash>;

  hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd?: string
  ): Promise<Hash>;

  /**
   * @deprecated pass `perTaskEnvs` keyed by `task.id` instead — hashing
   * every task against one shared env produces the wrong cache key when
   * tasks have per-project/target `.env` files or custom hashers that
   * read env. Will be removed in v22.
   */
  hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd?: string
  ): Promise<Hash[]>;

  /**
   * Hash `tasks`. `perTaskEnvs` must contain an entry keyed by `task.id`
   * for every task in `tasks` — task-specific env (per-project/target
   * `.env` files, custom-hasher env reads) participates in the hash, so
   * a shared env across tasks would compute the wrong cache key when
   * tasks actually differ.
   */
  hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string
  ): Promise<Hash[]>;
}

export interface TaskHasherImpl {
  /**
   * Hash `tasks` where each task is keyed in `perTaskEnvs` by `task.id`.
   * Every task must have an entry — callers who want to hash against a
   * single shared env should construct `{ [task.id]: env }` for every
   * task.
   */
  hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean
  ): Promise<PartialHash[]>;

  hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd?: string,
    collectInputs?: boolean
  ): Promise<PartialHash>;
}

export type Hasher = TaskHasher;

/**
 * Normalize the legacy single-env `hashTasks(tasks, taskGraph, env)`
 * signature to the per-task-env shape. External plugins still call the
 * legacy shape, so `InProcessTaskHasher` and `DaemonBasedTaskHasher`
 * detect at runtime and broadcast the shared env across every task.
 *
 * Detection is by value shape: `NodeJS.ProcessEnv` values are strings
 * (or undefined), `perTaskEnvs` values are objects.
 */
function normalizePerTaskEnvs(
  tasks: Task[],
  arg: NodeJS.ProcessEnv | Record<string, NodeJS.ProcessEnv>
): Record<string, NodeJS.ProcessEnv> {
  for (const value of Object.values(arg)) {
    if (value === undefined) continue;
    if (typeof value === 'object') {
      return arg as Record<string, NodeJS.ProcessEnv>;
    }
    // First defined value is a string — legacy env; broadcast it.
    const env = arg as NodeJS.ProcessEnv;
    const perTaskEnvs: Record<string, NodeJS.ProcessEnv> = {};
    for (const task of tasks) perTaskEnvs[task.id] = env;
    return perTaskEnvs;
  }
  // Empty or all-undefined: treat as perTaskEnvs — safe because the
  // Rust-side check will surface a clear error if entries are missing.
  return arg as Record<string, NodeJS.ProcessEnv>;
}

export class DaemonBasedTaskHasher implements TaskHasher {
  constructor(
    private readonly daemonClient: DaemonClient,
    private readonly runnerOptions: any
  ) {}

  async hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    envOrPerTaskEnvs: NodeJS.ProcessEnv | Record<string, NodeJS.ProcessEnv>
  ): Promise<Hash[]> {
    const collectInputs = getTaskIOService().hasTaskInputSubscribers();
    return this.daemonClient.hashTasks(
      this.runnerOptions,
      tasks,
      taskGraph,
      normalizePerTaskEnvs(tasks, envOrPerTaskEnvs),
      process.cwd(),
      collectInputs
    );
  }

  async hashTask(
    task: Task,
    taskGraph?: TaskGraph,
    env?: NodeJS.ProcessEnv
  ): Promise<Hash> {
    return (
      await this.hashTasks([task], taskGraph!, {
        [task.id]: env ?? process.env,
      })
    )[0];
  }
}

export class InProcessTaskHasher implements TaskHasher {
  private taskHasher: TaskHasherImpl;

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly externalRustReferences: NxWorkspaceFilesExternals | null,
    private readonly options: any
  ) {
    this.taskHasher = new NativeTaskHasherImpl(
      workspaceRoot,
      this.nxJson,
      this.projectGraph,
      this.externalRustReferences,
      {
        selectivelyHashTsConfig: this.options?.selectivelyHashTsConfig ?? false,
      }
    );
  }

  async hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    envOrPerTaskEnvs: NodeJS.ProcessEnv | Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean
  ): Promise<Hash[]> {
    const hashes = await this.taskHasher.hashTasks(
      tasks,
      taskGraph,
      normalizePerTaskEnvs(tasks, envOrPerTaskEnvs),
      cwd ?? process.cwd(),
      collectInputs
    );
    return tasks.map((task, index) =>
      this.createHashDetails(task, hashes[index])
    );
  }

  async hashTask(
    task: Task,
    taskGraph?: TaskGraph,
    env?: NodeJS.ProcessEnv,
    cwd?: string,
    collectInputs?: boolean
  ): Promise<Hash> {
    const res = await this.taskHasher.hashTask(
      task,
      taskGraph!,
      env ?? process.env,
      cwd ?? process.cwd(),
      collectInputs
    );
    return this.createHashDetails(task, res);
  }

  private createHashDetails(task: Task, res: PartialHash): Hash {
    const command = this.hashCommand(task);
    return {
      value: hashArray([res.value, command]),
      details: {
        command,
        nodes: res.details,
        implicitDeps: {},
        runtime: {},
      },
      inputs: res.inputs,
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
    input: 'default',
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
  const inputs = splitInputsIntoSelfAndDependencies(
    targetData.inputs || DEFAULT_INPUTS,
    namedInputs
  );

  const selfInputs = extractPatternsFromFileSets(inputs.selfInputs);

  const dependencyInputs = [
    ...extractPatternsFromFileSets(
      inputs.depsInputs
        .map((s) => expandNamedInput(s.input, namedInputs))
        .flat()
    ),
    ...inputs.depsFilesets.map((d) => d.fileset),
  ];

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
  // See `getTargetInputs` — graph construction already merged any
  // matching target-default's `inputs` onto `targetData.inputs`, so a
  // separate `targetDefaults` lookup here would either repeat that
  // work or drift from it.
  const { selfInputs, depsInputs, depsOutputs, projectInputs, depsFilesets } =
    splitInputsIntoSelfAndDependencies(
      targetData.inputs || (DEFAULT_INPUTS as any),
      namedInputs
    );
  return { selfInputs, depsInputs, depsOutputs, projectInputs, depsFilesets };
}

export function splitInputsIntoSelfAndDependencies(
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): {
  depsInputs: { input: string; dependencies: true }[];
  projectInputs: { input: string; projects: string[] }[];
  selfInputs: ExpandedSelfInput[];
  depsOutputs: ExpandedDepsOutput[];
  depsFilesets: { fileset: string; dependencies: true }[];
} {
  const depsInputs: { input: string; dependencies: true }[] = [];
  const projectInputs: { input: string; projects: string[] }[] = [];
  const depsFilesets: { fileset: string; dependencies: true }[] = [];
  const selfInputs = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^')) {
        const rest = d.substring(1);
        if (
          rest.startsWith('{projectRoot}') ||
          rest.startsWith('{workspaceRoot}')
        ) {
          depsFilesets.push({ fileset: rest, dependencies: true });
        } else {
          depsInputs.push({ input: rest, dependencies: true });
        }
      } else {
        selfInputs.push(d);
      }
    } else {
      if ('fileset' in d && 'dependencies' in d && d.dependencies) {
        depsFilesets.push({
          fileset: (d as { fileset: string; dependencies: true }).fileset,
          dependencies: true,
        });
      } else if (
        'input' in d &&
        !('fileset' in d) &&
        (('dependencies' in d && d.dependencies) ||
          // Todo(@AgentEnder): Remove check in v17
          ('projects' in d &&
            typeof d.projects === 'string' &&
            d.projects === 'dependencies'))
      ) {
        depsInputs.push({
          input: d.input,
          dependencies: true,
        });
      } else if (
        'input' in d &&
        !('fileset' in d) &&
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
    depsFilesets,
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
        (d as any).dependentTasksOutputFiles ||
        (d as any).workingDirectory ||
        (d as any).json
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
