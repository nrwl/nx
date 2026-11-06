import type { Task, TaskGraph } from '../config/task-graph';
import type { UltracacheConfigurations } from '../native';
import type { NativeTaskHasherImpl } from './native-task-hasher-impl';
import type { Hash } from './task-hasher';
import { posix } from 'path';
import { isDeepStrictEqual } from 'node:util';
import type {
  RehashSourceObservation,
  RehashSourceState,
} from './rehash-source-state';
import type { RehashPlanInputs } from '../native';
import { hashArray } from '../native';

export interface UltracacheRehashResult {
  hashes: Record<string, string>;
  skipped: Record<string, string>;
}

export interface UltracacheRehashEvidence {
  executionStates?: UltracacheExecutionState[];
  /**
   * ALL affected source paths since the file snapshot, across every producer:
   * writes/deletes, both rename endpoints, link operations and their aliases.
   * Paths must be normalized workspace-relative paths. Resolve symlink writes
   * to the affected source and include every affected hardlink alias, including
   * temporary aliases/writes removed or restored before finalization. This is
   * mutation evidence, NOT a list of raw syscall pathnames or declared outputs.
   * Omit evidence if any producer or alias was unobserved; [] asserts complete
   * observation with no affected paths. Incomplete reports must never mean [].
   */
  writtenFiles?: string[];
}

/** Persist with the selected agent's successful results; contains no env values. */
export interface UltracacheExecutionState {
  version: 1;
  baseline: string;
  taskHashes: Record<string, string>;
  taskContexts: Record<string, string>;
  source: RehashSourceObservation;
}

/** An executing process's retained hashing context. Never serialize or send its env. */
export interface UltracacheRehasher {
  /** Invoke on the executing owner AFTER its tasks finish and BEFORE it exits. */
  exportExecutionState(
    executedTaskHashes: Record<string, string>
  ): UltracacheExecutionState;
  /** Complete replacement configurations. Execution hashes and outputs are untouched. */
  rehash(
    configurations: UltracacheConfigurations,
    evidence: UltracacheRehashEvidence
  ): Promise<UltracacheRehashResult>;
  dispose(): void;
}

interface CapturedTask {
  task: Task;
  graph: TaskGraph;
  env: NodeJS.ProcessEnv;
  cwd: string;
  configurations?: UltracacheConfigurations;
  hash?: string;
  context: string;
}

interface ObservedSource {
  files: Set<string>;
  directories: Set<string>;
  observed: Set<string>;
}

/** Opt-in, bounded by a Cloud run. Source contents come from the native hasher's FileData. */
export class TaskRehasher implements UltracacheRehasher {
  private tasks = new Map<string, CapturedTask>();
  private graphs = new WeakMap<
    TaskGraph,
    { fingerprint: string; graph: TaskGraph }
  >();
  private disposed = false;
  private readonly source: ReturnType<
    NativeTaskHasherImpl['captureRehashSourceState']
  >;

  constructor(
    private readonly native: NativeTaskHasherImpl,
    private readonly compose: (
      task: Task,
      hash: Awaited<ReturnType<NativeTaskHasherImpl['hashTask']>>
    ) => Hash,
    private readonly release: () => void
  ) {
    this.source = native.captureRehashSourceState();
  }

  exportExecutionState(
    executedTaskHashes: Record<string, string>,
    observations = new Map<RehashSourceState, RehashSourceObservation>()
  ): UltracacheExecutionState {
    const taskHashes: Record<string, string> = {};
    const taskContexts: Record<string, string> = {};
    if (!this.disposed)
      for (const selected of this.groups(Object.keys(executedTaskHashes))) {
        const entries = selected.filter(
          (entry) => entry.hash === executedTaskHashes[entry.task.id]
        );
        if (!entries.length) continue;
        try {
          const plan = this.native.createRehashPlans(
            entries.map((entry) => entry.task),
            entries[0].graph,
            entries[0].configurations
          );
          const requirements = this.native.rehashRequirements(plan);
          // The owner metadata observation below proves source stability.
          // Main checks both complete plans for generated/unsupported inputs.
          // Do not reread source contents here once per completed task.
          for (const entry of entries)
            if (requirements[entry.task.id]?.sourceOnly) {
              taskHashes[entry.task.id] = entry.hash!;
              taskContexts[entry.task.id] = entry.context;
            }
        } catch {
          /* No source proof for this task. */
        }
      }
    if (!observations.has(this.source.state))
      observations.set(this.source.state, this.source.state.export());
    return {
      version: 1,
      baseline: this.source.baseline,
      taskHashes,
      taskContexts,
      source: observations.get(this.source.state)!,
    };
  }

  private observationReason(
    entry: CapturedTask,
    inputs: RehashPlanInputs | undefined,
    evidence: UltracacheRehashEvidence,
    cache: Map<RehashSourceObservation, ObservedSource>
  ): string | undefined {
    if (!inputs) return 'missing-plan';
    if (!evidence.executionStates)
      return inputs.directories.length
        ? 'missing-source-observation'
        : undefined;
    if (!inputs.sourceOnly) return 'non-source-plan';
    const owners = evidence.executionStates.filter(
      (owner) =>
        owner.version === 1 &&
        owner.baseline === this.source.baseline &&
        // The planner's built-in encryption-key input is always on; H0
        // equality pins it without exporting any environment values.
        owner.taskHashes[entry.task.id] === entry.hash &&
        owner.taskContexts?.[entry.task.id] === entry.context
    );
    if (!owners.length) return 'owner-baseline-mismatch';
    if (
      owners.some(
        ({ source }) =>
          !source ||
          !Array.isArray(source.invalidFiles) ||
          !Array.isArray(source.invalidDirectories) ||
          !Array.isArray(source.observedDirectories) ||
          !Array.isArray(source.unobserved)
      )
    )
      return 'missing-source-observation';
    const observed = owners.map(({ source }) => {
      if (!cache.has(source))
        cache.set(source, {
          files: new Set(source.invalidFiles),
          directories: new Set(source.invalidDirectories),
          observed: new Set(source.observedDirectories),
        });
      return cache.get(source)!;
    });
    if (
      inputs.files.some((file) =>
        observed.some((state) => state.files.has(file))
      )
    )
      return 'source-state-changed';
    const required = new Set(inputs.directories);
    // Ancestor swaps can temporarily redirect an otherwise unchanged source.
    // Root membership changes are conservatively unsupported too.
    required.add('');
    for (const file of inputs.files) {
      let dir = posix.dirname(file);
      while (dir !== '.') {
        required.add(dir);
        dir = posix.dirname(dir);
      }
    }
    if (
      [...required].some((dir) =>
        observed.some(
          (state) => !state.observed.has(dir) || state.directories.has(dir)
        )
      )
    )
      return 'directory-state-changed';
    const overlaps = (a: string, b: string) =>
      !a || !b || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
    if (
      inputs.directories.some((dir) =>
        owners.some(
          ({ source }) =>
            source.invalidDirectories.some(
              (bad) => bad && bad.startsWith(`${dir}/`)
            ) || source.unobserved.some((unknown) => overlaps(dir, unknown))
        )
      )
    )
      return 'unobserved-membership';
  }

  hasMatchingCapture(
    task: Task,
    graph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd: string,
    configurations?: UltracacheConfigurations
  ): boolean {
    const entry = this.tasks.get(task.id);
    return (
      !!entry &&
      !this.disposed &&
      entry.hash === task.hash &&
      entry.cwd === cwd &&
      entry.configurations === configurations &&
      entry.context === hashArray([this.graphFingerprint(graph)]) &&
      isDeepStrictEqual(entry.task.target, task.target) &&
      isDeepStrictEqual(entry.task.overrides, task.overrides) &&
      isDeepStrictEqual(entry.env, env)
    );
  }

  private graphFingerprint(graph: TaskGraph): string {
    return JSON.stringify([
      Object.values(graph.tasks)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((task) => [
          task.id,
          [task.target.project, task.target.target, task.target.configuration],
          task.outputs,
          [
            task.ultracache?.mode,
            task.ultracache?.collectStats,
            task.ultracache?.ignoreReads,
            task.ultracache?.ignoreWrites,
          ],
          task.continuous,
          task.cache,
        ]),
      Object.keys(graph.dependencies)
        .sort()
        .map((id) => [
          id,
          graph.dependencies[id].map((edge) => edge.id).sort(),
        ]),
      Object.keys(graph.continuousDependencies ?? {})
        .sort()
        .map((id) => [
          id,
          graph.continuousDependencies[id]
            .map((edge) => [edge.id, edge.inputs !== false])
            .sort(),
        ]),
    ]);
  }

  capture(
    tasks: Task[],
    graph: TaskGraph,
    envs: Record<string, NodeJS.ProcessEnv>,
    cwd: string,
    configurations?: UltracacheConfigurations
  ): (hashes: Record<string, Hash>) => void {
    try {
      const fingerprint = this.graphFingerprint(graph);
      let snapshot = this.graphs.get(graph);
      if (!snapshot || snapshot.fingerprint !== fingerprint) {
        snapshot = { fingerprint, graph: structuredClone(graph) };
        this.graphs.set(graph, snapshot);
      }
      const captured = tasks.map((task): CapturedTask => ({
        task: structuredClone(task),
        graph: snapshot.graph,
        env: { ...envs[task.id] },
        cwd,
        configurations,
        context: hashArray([fingerprint]),
      }));
      return (hashes) => {
        if (this.disposed) return;
        for (const entry of captured) {
          if (hashes[entry.task.id]) {
            entry.hash = hashes[entry.task.id].value;
            this.tasks.set(entry.task.id, entry);
          }
        }
      };
    } catch {
      // Executors/plugins may attach non-cloneable metadata. Retention is
      // optional and must not prevent the normal hasher from running.
      for (const task of tasks) this.tasks.delete(task.id);
      return () => {};
    }
  }

  async rehash(
    configurations: UltracacheConfigurations,
    evidence: UltracacheRehashEvidence
  ): Promise<UltracacheRehashResult> {
    const result: UltracacheRehashResult = { hashes: {}, skipped: {} };
    const observations = new Map<RehashSourceObservation, ObservedSource>();
    if (
      !evidence ||
      (!Array.isArray(evidence.executionStates) &&
        (!Array.isArray(evidence.writtenFiles) ||
          !evidence.writtenFiles.every(
            (file) =>
              typeof file === 'string' &&
              file.length > 0 &&
              !file.includes('\\') &&
              !file.endsWith('/') &&
              !/^[a-zA-Z]:/.test(file) &&
              !posix.isAbsolute(file) &&
              posix.normalize(file) === file &&
              file !== '..' &&
              !file.startsWith('../') &&
              file !== '.'
          )))
    ) {
      for (const id of this.tasks.keys())
        result.skipped[id] = 'missing-write-evidence';
      return result;
    }
    for (const entries of this.groups()) {
      const { graph, cwd, configurations: originalConfigurations } = entries[0];
      const tasks = entries.map((entry) => entry.task);
      const envs = Object.fromEntries(
        entries.map((entry) => [entry.task.id, entry.env])
      );
      try {
        const originalPlans = this.native.createRehashPlans(
          tasks,
          graph,
          originalConfigurations
        );
        const candidatePlans = this.native.createRehashPlans(
          tasks,
          graph,
          configurations
        );
        const originalInputs = this.native.rehashRequirements(originalPlans);
        const candidateInputs = this.native.rehashRequirements(candidatePlans);
        for (const entry of entries) {
          const reason =
            this.observationReason(
              entry,
              originalInputs[entry.task.id],
              evidence,
              observations
            ) ??
            this.observationReason(
              entry,
              candidateInputs[entry.task.id],
              evidence,
              observations
            );
          if (reason) result.skipped[entry.task.id] = reason;
        }
        // Validate BOTH plans: nothing with live execution state may be used
        // to establish the original hash or to calculate its replacement.
        Object.assign(
          result.skipped,
          this.native.validateRehash(
            tasks,
            graph,
            candidatePlans,
            evidence.writtenFiles ?? []
          ),
          this.native.validateRehash(
            tasks,
            graph,
            originalPlans,
            evidence.writtenFiles ?? []
          )
        );
        const eligible = tasks.filter((task) => !result.skipped[task.id]);
        if (!eligible.length) continue;
        const original = this.native.hashTasksForRehash(
          originalPlans,
          graph,
          envs,
          cwd,
          evidence.writtenFiles ?? []
        );
        const hashes = this.native.hashTasksForRehash(
          candidatePlans,
          graph,
          envs,
          cwd,
          evidence.writtenFiles ?? []
        );
        Object.assign(
          result.skipped,
          this.native.validateRehash(
            eligible,
            graph,
            candidatePlans,
            evidence.writtenFiles ?? []
          ),
          this.native.validateRehash(
            eligible,
            graph,
            originalPlans,
            evidence.writtenFiles ?? []
          )
        );
        for (const entry of entries) {
          const { task } = entry;
          if (result.skipped[task.id]) continue;
          if (!original[task.id] || !hashes[task.id]) {
            result.skipped[task.id] = 'source-changed';
          } else if (
            this.compose(task, original[task.id]).value !== entry.hash
          ) {
            result.skipped[task.id] = 'execution-context-changed';
          } else {
            result.hashes[task.id] = this.compose(task, hashes[task.id]).value;
          }
        }
      } catch {
        // Cache priming must never fail a completed task.
        for (const { task } of entries)
          result.skipped[task.id] = 'rehash-unavailable';
      }
    }
    return result;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.tasks.clear();
    this.graphs = new WeakMap();
    this.source.release();
    this.release();
  }

  private groups(ids?: string[]): CapturedTask[][] {
    const groups: CapturedTask[][] = [];
    for (const entry of ids
      ? ids
          .map((id) => this.tasks.get(id))
          .filter((entry): entry is CapturedTask => !!entry)
      : this.tasks.values()) {
      let group = groups.find(
        (g) =>
          g[0].graph === entry.graph &&
          g[0].configurations === entry.configurations &&
          g[0].cwd === entry.cwd
      );
      if (!group) {
        group = [];
        groups.push(group);
      }
      group.push(entry);
    }
    return groups;
  }
}
