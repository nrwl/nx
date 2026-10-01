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
  const withheld = result.diagnostics.filter((d) => d.taskId != null);
  const byReason = countByReason(withheld);
  const fellBack = withheld.length;
  const setLevel = result.diagnostics.find((d) => d.taskId == null);

  const line = setLevel
    ? `I/O snapshots: none used (unreadable set: ${setLevel.message})`
    : `I/O snapshots: ${plural(used, 'task')} hashed from snapshot, ${plural(
        fellBack,
        'task'
      )} fell back${fellBack ? ` (${summarizeReasons(byReason)})` : ''}`;

  const bodyLines: string[] = [`set: ${status}`];
  bodyLines.push(
    `commit ${result.resolution.requestedCommit}, ${result.resolution.tasks} tasks in set`
  );
  for (const d of result.diagnostics) {
    bodyLines.push(describeDiagnostic(d));
  }
  return { line, bodyLines };
}

function describeDiagnostic(d: IoSnapshotDiagnostic): string {
  switch (d.reason) {
    case 'unreadable-set':
      return `unreadable snapshot set: ${d.message}`;
    case 'disabled':
      return `${d.taskId}: ultracache.mode is off`;
    case 'autofix-disabled':
      return `${d.taskId}: ultracache.mode is not on`;
    case 'custom-hasher':
      return `${d.taskId}: uses a custom hasher`;
    case 'missing':
      return `${d.taskId}: no snapshot for this task`;
    case 'invalid-glob':
      return `${d.taskId}: snapshot glob "${d.glob}" is not a valid files glob`;
    case 'escapes-workspace':
      return `${d.taskId}: snapshot glob "${d.glob}" escapes the workspace`;
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
