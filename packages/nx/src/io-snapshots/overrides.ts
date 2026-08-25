import { join } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import {
  ioSnapshotReport,
  loadIoSnapshots,
  type IoSnapshotDiagnostic,
  type IoSnapshotReport,
  type IoSnapshotResolution,
  type IoSnapshots,
} from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getExecutorForTask } from '../tasks-runner/utils';
import { getLatestCommitSha } from '../utils/git-utils';
import { ioSnapshotsCacheDirectory, isIoSnapshotFetchEnabled } from './fetch';

export type {
  IoSnapshotDiagnostic,
  IoSnapshotReport,
  IoSnapshotResolution,
  IoSnapshots,
} from '../native';

export const IO_SNAPSHOT_BUNDLE_FILE = 'snapshots.json';

/** Where the fetch for this workspace's HEAD lands; `null` outside a git repo. */
export function ioSnapshotBundleDirForHead(): string | null {
  const head = getLatestCommitSha();
  return head ? join(ioSnapshotsCacheDirectory, head) : null;
}

/**
 * The bundle already fetched for HEAD, read from the cache only — never
 * fetched. `null` when snapshots are off for this workspace, so `nx show` and
 * `nx graph` resolve exactly what a run would.
 */
export function loadIoSnapshotsForHead(
  nxJson: NxJsonConfiguration
): IoSnapshots | null {
  if (!isIoSnapshotFetchEnabled(nxJson)) {
    return null;
  }
  const directory = ioSnapshotBundleDirForHead();
  return directory ? loadIoSnapshots(directory) : null;
}

const customHasherMemo = new WeakMap<
  ProjectGraph,
  WeakMap<TaskGraph, string[]>
>();

/**
 * Tasks whose executor ships a custom hasher; they are never hashed from a
 * snapshot. Detected in TS because executors are resolved here, by the
 * factory's presence only — invoking it would load user modules.
 */
export function customHasherTaskIds(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
): string[] {
  let byTaskGraph = customHasherMemo.get(projectGraph);
  if (!byTaskGraph) {
    byTaskGraph = new WeakMap();
    customHasherMemo.set(projectGraph, byTaskGraph);
  }
  const memoized = byTaskGraph.get(taskGraph);
  if (memoized) {
    return memoized;
  }
  const projects =
    readProjectsConfigurationFromProjectGraph(projectGraph).projects;
  const ids = Object.values(taskGraph.tasks)
    .filter((task) => {
      try {
        return !!getExecutorForTask(task, projects).hasherFactory;
      } catch {
        // An unresolvable executor fails later, at execution; it is not a
        // reason to withhold a snapshot here.
        return false;
      }
    })
    .map((task) => task.id);
  byTaskGraph.set(taskGraph, ids);
  return ids;
}

/** Tasks whose target sets `ioSnapshots: false`. */
export function optedOutTaskIds(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
): string[] {
  return Object.values(taskGraph.tasks)
    .filter(
      (task) =>
        projectGraph.nodes[task.target.project]?.data.targets?.[
          task.target.target
        ]?.ioSnapshots === false
    )
    .map((task) => task.id);
}

/**
 * Reports which tasks in `taskGraph` hash from the snapshot bundle and why
 * the rest do not, with the same eligibility walk the planner uses, without
 * building a planner (no project-graph transfer). `snapshots` is the fetch
 * result, a bundle directory, or omitted to read HEAD's cache. Returns `null`
 * when snapshots are off. Never fetches, never throws.
 *
 * The export name and module path are probed by the Nx Cloud client bundle
 * to decide whether core handles snapshots; keep both stable.
 */
export function buildIoSnapshotOverrides(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  snapshots?: IoSnapshots | string
): IoSnapshotReport | null {
  const resolved =
    typeof snapshots === 'string'
      ? loadIoSnapshots(snapshots)
      : (snapshots ?? loadIoSnapshotsForHead(nxJson));
  if (!resolved) {
    return null;
  }
  return ioSnapshotReport(
    resolved,
    taskGraph,
    optedOutTaskIds(projectGraph, taskGraph),
    customHasherTaskIds(projectGraph, taskGraph),
    Object.fromEntries(
      Object.values(projectGraph.nodes).map((node) => [
        node.name,
        node.data.root,
      ])
    )
  );
}
