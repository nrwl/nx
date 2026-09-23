import type { IoSnapshotDiagnostic, IoSnapshotReport } from '../native';

export interface IoSnapshotSummary {
  /** The heading, e.g. "I/O snapshots: 12 tasks hashed from snapshot, 3 fell back". */
  line: string;
  /** Per-reason detail under it. */
  bodyLines: string[];
}

/**
 * Formats the once-per-run verbose summary of a run that resolved a set:
 * `result` is what hashing used, `status` whether the set was fetched or
 * already stored.
 */
export function formatIoSnapshotSummary(
  result: IoSnapshotReport,
  status: 'fetched' | 'cached'
): IoSnapshotSummary {
  const used = result.used.length;
  // A task-level diagnostic used to mean the task was withheld. An
  // `unusable-output` does not: it reports a dropped write on a task that is
  // still hashed from its snapshot, and one task can raise several. So count
  // the tasks that actually fell back, and leave those out of the reasons.
  const usedTasks = new Set(result.used);
  const withheld = result.diagnostics.filter(
    (d) => d.taskId != null && !usedTasks.has(d.taskId)
  );
  const byReason = countByReason(withheld);
  const fellBack = new Set(withheld.map((d) => d.taskId)).size;
  const bundleLevel = result.diagnostics.find((d) => d.taskId == null);

  const withOutputs = result.tasksWithOutputs?.length ?? 0;
  const line = bundleLevel
    ? `I/O snapshots: none used (invalid bundle: ${bundleLevel.message})`
    : `I/O snapshots: ${plural(used, 'task')} hashed from snapshot${
        withOutputs ? ` (${withOutputs} with observed outputs)` : ''
      }, ${plural(fellBack, 'task')} fell back${
        fellBack ? ` (${summarizeReasons(byReason)})` : ''
      }`;

  const bodyLines: string[] = [`bundle: ${status}`];
  if (result.resolution) {
    bodyLines.push(
      `commit ${result.resolution.requestedCommit}, digest ${result.resolution.digest}, ${result.resolution.tasks} tasks in bundle`
    );
  }
  for (const d of result.diagnostics) {
    bodyLines.push(describeDiagnostic(d));
  }
  return { line, bodyLines };
}

function describeDiagnostic(d: IoSnapshotDiagnostic): string {
  switch (d.reason) {
    case 'invalid-bundle':
      return `invalid snapshot set: ${d.message}`;
    case 'disabled':
      return `${d.taskId}: sandbox.enabled is false`;
    case 'custom-hasher':
      return `${d.taskId}: uses a custom hasher`;
    case 'missing':
      return `${d.taskId}: no snapshot for this task`;
    case 'root-anchored-glob':
      return `${d.taskId}: snapshot glob "${d.glob}" is anchored at the workspace root`;
    case 'unknown-project':
      return `${d.taskId}: snapshot references unknown project "${d.project}"`;
    case 'producer-not-in-graph':
      return `${d.taskId}: reads outputs of "${d.producer}", which is not in this task graph`;
    case 'escapes-workspace':
      return `${d.taskId}: snapshot glob "${d.glob}" escapes the workspace`;
    case 'unusable-output':
      return `${d.taskId}: observed write "${d.glob}" is not usable as an output, so it is not cached`;
    default:
      return `${d.taskId ? `${d.taskId}: ` : ''}${d.reason}`;
  }
}

function countByReason(
  diagnostics: IoSnapshotDiagnostic[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of diagnostics) {
    if (d.taskId != null) {
      counts.set(d.reason, (counts.get(d.reason) ?? 0) + 1);
    }
  }
  return counts;
}

function summarizeReasons(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, n]) => `${n} ${reason}`)
    .join(', ');
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
