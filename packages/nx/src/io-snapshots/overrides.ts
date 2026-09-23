import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import {
  getIoSnapshotReport,
  type IoSnapshotEligibilityOptions,
  type IoSnapshotReport,
  type IoSnapshots,
} from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getExecutorForTask } from '../tasks-runner/utils';

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
function projectRoots(projectGraph: ProjectGraph): Record<string, string> {
  return Object.fromEntries(
    Object.values(projectGraph.nodes).map((node) => [node.name, node.data.root])
  );
}

/** The eligibility walk's view of the run's tasks, as JS resolves it. */
export function ioSnapshotEligibilityOptions(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
): IoSnapshotEligibilityOptions {
  return {
    optedOutTaskIds: optedOutTaskIds(projectGraph, taskGraph),
    customHasherTaskIds: customHasherTaskIds(projectGraph, taskGraph),
    projectRoots: projectRoots(projectGraph),
  };
}

/**
 * Reports which tasks in `taskGraph` hash from `snapshots` and why the rest
 * do not, with the same eligibility walk the planner uses, without building a
 * planner (no project-graph transfer). Never fetches, never throws.
 *
 * The Nx Cloud client bundle probes this module path for the export's
 * presence to decide whether core handles snapshots; keep both stable.
 */
export function buildIoSnapshotOverrides(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  snapshots: IoSnapshots
): IoSnapshotReport {
  return getIoSnapshotReport(
    snapshots,
    taskGraph,
    ioSnapshotEligibilityOptions(projectGraph, taskGraph)
  );
}
