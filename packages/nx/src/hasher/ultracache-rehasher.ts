import type { Task, TaskGraph } from '../config/task-graph';
import type { UltracacheConfigurations } from '../native';
import type { NativeTaskHasherImpl } from './native-task-hasher-impl';
import type { Hash } from './task-hasher';
import { posix } from 'path';

export interface UltracacheRehashResult {
  hashes: Record<string, string>;
  skipped: Record<string, string>;
}

export interface UltracacheRehashEvidence {
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
  writtenFiles: string[];
}

/** An executing process's retained hashing context. Never serialize or send its env. */
export interface UltracacheRehasher {
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
}

/** Opt-in, bounded by a Cloud run. Source contents come from the native hasher's FileData. */
export class TaskRehasher implements UltracacheRehasher {
  private tasks = new Map<string, CapturedTask>();
  private graphs = new WeakMap<
    TaskGraph,
    { fingerprint: string; graph: TaskGraph }
  >();
  private disposed = false;

  constructor(
    private readonly native: NativeTaskHasherImpl,
    private readonly compose: (
      task: Task,
      hash: Awaited<ReturnType<NativeTaskHasherImpl['hashTask']>>
    ) => Hash,
    private readonly release: () => void
  ) {}

  capture(
    tasks: Task[],
    graph: TaskGraph,
    envs: Record<string, NodeJS.ProcessEnv>,
    cwd: string,
    configurations?: UltracacheConfigurations
  ): (hashes: Record<string, Hash>) => void {
    try {
      const fingerprint = JSON.stringify([
        Object.values(graph.tasks).map((task) => [
          task.id,
          task.target,
          task.outputs,
          task.ultracache,
          task.continuous,
        ]),
        graph.dependencies,
        graph.continuousDependencies,
      ]);
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
    if (
      !evidence ||
      !Array.isArray(evidence.writtenFiles) ||
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
      )
    ) {
      for (const id of this.tasks.keys())
        result.skipped[id] = 'missing-write-evidence';
      return result;
    }
    const groups: CapturedTask[][] = [];
    for (const entry of this.tasks.values()) {
      let group = groups.find(
        (group) =>
          group[0].graph === entry.graph &&
          group[0].configurations === entry.configurations &&
          group[0].cwd === entry.cwd
      );
      if (!group) {
        group = [];
        groups.push(group);
      }
      group.push(entry);
    }
    for (const entries of groups) {
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
        // Validate BOTH plans: nothing with live execution state may be used
        // to establish the original hash or to calculate its replacement.
        Object.assign(
          result.skipped,
          this.native.validateRehash(
            tasks,
            graph,
            candidatePlans,
            evidence.writtenFiles
          ),
          this.native.validateRehash(
            tasks,
            graph,
            originalPlans,
            evidence.writtenFiles
          )
        );
        const eligible = tasks.filter((task) => !result.skipped[task.id]);
        if (!eligible.length) continue;
        const original = this.native.hashTasksForRehash(
          originalPlans,
          graph,
          envs,
          cwd,
          evidence.writtenFiles
        );
        const hashes = this.native.hashTasksForRehash(
          candidatePlans,
          graph,
          envs,
          cwd,
          evidence.writtenFiles
        );
        Object.assign(
          result.skipped,
          this.native.validateRehash(
            eligible,
            graph,
            candidatePlans,
            evidence.writtenFiles
          ),
          this.native.validateRehash(
            eligible,
            graph,
            originalPlans,
            evidence.writtenFiles
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
    this.release();
  }
}
