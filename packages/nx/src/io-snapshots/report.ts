import type { IoSnapshotFetchResult } from '../native';
import type {
  IoSnapshotDiagnostic,
  IoSnapshotOverridesResult,
} from './overrides';

export interface IoSnapshotSummary {
  /** One line for the default output, e.g. "I/O snapshots: 12 tasks hashed from snapshot, 3 fell back". */
  line: string;
  /** Per-reason detail for verbose output. */
  bodyLines: string[];
}

export interface IoSnapshotReportJson {
  fetch: {
    status: string;
    reason?: string;
    message?: string;
  } | null;
  resolution: IoSnapshotOverridesResult['resolution'];
  used: string[];
  diagnostics: IoSnapshotDiagnostic[];
}

/**
 * Formats the once-per-run summary. `result` is what hashing used; `fetch`
 * explains where the bundle came from (or why there is none). Returns null
 * when snapshots are disabled so callers print nothing.
 */
export function formatIoSnapshotSummary(
  result: IoSnapshotOverridesResult | null,
  fetch: IoSnapshotFetchResult | null
): IoSnapshotSummary | null {
  if (!result) {
    return null;
  }
  const used = Object.keys(result.overrides).length;
  const byReason = countByReason(result.diagnostics);
  const fellBack = result.diagnostics.filter((d) => 'taskId' in d).length;
  const bundleLevel = result.diagnostics.find((d) => !('taskId' in d));

  const line = bundleLevel
    ? `I/O snapshots: none used (${describeBundleLevel(bundleLevel, fetch)})`
    : `I/O snapshots: ${plural(used, 'task')} hashed from snapshot, ${plural(
        fellBack,
        'task'
      )} fell back${fellBack ? ` (${summarizeReasons(byReason)})` : ''}`;

  const bodyLines: string[] = [];
  if (fetch) {
    bodyLines.push(
      `bundle: ${fetch.status}${fetch.reason ? ` (${fetch.reason})` : ''}${
        fetch.directory ? ` at ${fetch.directory}` : ''
      }`
    );
  }
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

export function ioSnapshotReportToJson(
  result: IoSnapshotOverridesResult | null,
  fetch: IoSnapshotFetchResult | null
): IoSnapshotReportJson | null {
  if (!result) {
    return null;
  }
  return {
    fetch: fetch
      ? { status: fetch.status, reason: fetch.reason, message: fetch.message }
      : null,
    resolution: result.resolution,
    used: Object.keys(result.overrides).sort(),
    diagnostics: result.diagnostics,
  };
}

function describeDiagnostic(d: IoSnapshotDiagnostic): string {
  switch (d.reason) {
    case 'no-bundle':
      return 'no snapshot bundle for the current commit';
    case 'invalid-bundle':
      return `invalid snapshot bundle ${d.file}: ${d.message}`;
    case 'disabled':
      return `${d.taskId}: ioSnapshots is false`;
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
  }
}

function describeBundleLevel(
  d: IoSnapshotDiagnostic,
  fetch: IoSnapshotFetchResult | null
): string {
  if (d.reason === 'invalid-bundle') {
    return `invalid bundle: ${d.message}`;
  }
  return fetch?.reason ?? 'no bundle for this commit';
}

function countByReason(
  diagnostics: IoSnapshotDiagnostic[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of diagnostics) {
    if ('taskId' in d) {
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
