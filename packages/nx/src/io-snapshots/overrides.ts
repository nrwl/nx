import type { NxJsonConfiguration } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import {
  ioSnapshotReport,
  type IoSnapshotDiagnostic,
  type IoSnapshotReport,
  type IoSnapshotResolution,
  type IoSnapshots,
} from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getExecutorForTask } from '../tasks-runner/utils';
import { ioSnapshotCommitForHead, isIoSnapshotFetchEnabled } from './config';
import { getIoSnapshotStore } from './store';

export type {
  IoSnapshotDiagnostic,
  IoSnapshotReport,
  IoSnapshotResolution,
  IoSnapshots,
} from '../native';

const customHasherMemo = new WeakMap<
  ProjectGraph,
  WeakMap<TaskGraph, string[]>
>();

/**
 * Tasks whose executor ships a custom hasher; they are never hashed from a
 * snapshot. Detected here because executors are resolved in JS, by the
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

/** Tasks whose target sets `sandbox.enabled: false`. */
export function optedOutTaskIds(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
): string[] {
  return Object.values(taskGraph.tasks)
    .filter(
      (task) =>
        (
          projectGraph.nodes[task.target.project]?.data.targets?.[
            task.target.target
          ] as { sandbox?: { enabled?: boolean } } | undefined
        )?.sandbox?.enabled === false
    )
    .map((task) => task.id);
}

/** Project name → root, for flattening bundles that bucket reads by project. */
export function projectRoots(
  projectGraph: ProjectGraph
): Record<string, string> {
  return Object.fromEntries(
    Object.values(projectGraph.nodes).map((node) => [node.name, node.data.root])
  );
}

/**
 * Reports which tasks in `taskGraph` hash from the snapshot bundle and why
 * the rest do not, with the same eligibility walk the planner uses, without
 * building a planner (no project-graph transfer). `snapshots` is this run's
 * set, a commit to read from the database, or omitted to read HEAD's.
 * Returns `null` when snapshots are off. Never fetches, never throws.
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
  const report = (set: IoSnapshots) =>
    ioSnapshotReport(
      set,
      taskGraph,
      optedOutTaskIds(projectGraph, taskGraph),
      customHasherTaskIds(projectGraph, taskGraph),
      projectRoots(projectGraph)
    );
  if (typeof snapshots === 'object') {
    return report(snapshots);
  }
  const commit =
    snapshots ??
    (isIoSnapshotFetchEnabled(nxJson) ? ioSnapshotCommitForHead() : null);
  if (!commit) {
    return null;
  }
  const set = getIoSnapshotStore().get(commit);
  return set
    ? report(set)
    : {
        used: [],
        tasksWithOutputs: [],
        diagnostics: [
          {
            reason: 'no-bundle',
            message: `no I/O snapshot set is stored for ${commit}`,
          },
        ],
      };
}
