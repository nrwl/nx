import { formatIoSnapshotSummary, ioSnapshotReportToJson } from './report';
import type { IoSnapshotReport, IoSnapshots } from '../native';
import type { IoSnapshotOutcome } from './outcome';

function resolved(
  status: 'fetched' | 'cached',
  commit = 'abc123'
): IoSnapshotOutcome {
  return { status, snapshots: { commit } as IoSnapshots };
}

const resolution = {
  requestedCommit: 'abc123',
  commits: ['abc123'],
  sourceCommits: ['abc123'],
  digest: 'deadbeef',
  fetchedAt: 0,
  clientVersion: '1',
  tasks: 3,
};

describe('formatIoSnapshotSummary', () => {
  it('prints nothing when snapshots are disabled', () => {
    expect(formatIoSnapshotSummary(null, null)).toBeNull();
    expect(ioSnapshotReportToJson(null, null)).toBeNull();
  });

  // `unusable-output` reports a dropped write on a task that IS hashed from
  // its snapshot, and one task can raise several. Counting diagnostics would
  // put that task in both totals and let them exceed the task count.
  it('does not count a used task with a rejected write as a fallback', () => {
    const summary = formatIoSnapshotSummary(
      {
        used: ['a:build', 'b:build'],
        tasksWithOutputs: ['a:build', 'b:build'],
        diagnostics: [
          {
            reason: 'unusable-output',
            taskId: 'a:build',
            glob: '../outside/y',
          },
          {
            reason: 'unusable-output',
            taskId: 'a:build',
            glob: 'node_modules/.cache/x',
          },
          { reason: 'missing', taskId: 'c:test' },
        ],
        resolution,
      } as IoSnapshotReport,
      null
    );
    expect(summary.line).toBe(
      'I/O snapshots: 2 tasks hashed from snapshot (2 with observed outputs), 1 task fell back (1 missing)'
    );
    expect(summary.bodyLines).toContain(
      'a:build: observed write "../outside/y" is not usable as an output, so it is not cached'
    );
  });

  it('counts used tasks and groups fallbacks by reason', () => {
    const result: IoSnapshotReport = {
      used: ['a:build', 'b:build'],
      tasksWithOutputs: ['a:build'],
      diagnostics: [
        { reason: 'disabled', taskId: 'c:e2e' },
        { reason: 'missing', taskId: 'd:test' },
        { reason: 'missing', taskId: 'e:test' },
        { reason: 'root-anchored-glob', taskId: 'f:lint', glob: '**/*.ts' },
        { reason: 'escapes-workspace', taskId: 'g:build', glob: '../x/**' },
      ],
      resolution,
    };
    const summary = formatIoSnapshotSummary(result, resolved('cached'));
    expect(summary.line).toBe(
      'I/O snapshots: 2 tasks hashed from snapshot (1 with observed outputs), 5 tasks fell back (2 missing, 1 disabled, 1 escapes-workspace, 1 root-anchored-glob)'
    );
    expect(summary.bodyLines).toEqual([
      'bundle: cached for abc123',
      'commit abc123, digest deadbeef, 3 tasks in bundle',
      'c:e2e: sandbox.enabled is false',
      'd:test: no snapshot for this task',
      'e:test: no snapshot for this task',
      'f:lint: snapshot glob "**/*.ts" is anchored at the workspace root',
      'g:build: snapshot glob "../x/**" escapes the workspace',
    ]);
  });

  it('explains a bundle-level failure with the fetch reason', () => {
    const result: IoSnapshotReport = {
      used: [],
      tasksWithOutputs: [],
      diagnostics: [{ reason: 'no-bundle' }],
    };
    expect(
      formatIoSnapshotSummary(result, {
        status: 'skipped',
        reason: 'offline',
        message: 'ENOTFOUND',
      }).line
    ).toBe('I/O snapshots: none used (offline)');
    expect(
      formatIoSnapshotSummary(
        {
          ...result,
          diagnostics: [
            {
              reason: 'invalid-bundle',
              message: 'bad',
            },
          ],
        },
        null
      ).line
    ).toBe('I/O snapshots: none used (invalid bundle: bad)');
  });

  it('serializes the report for --json consumers', () => {
    const result: IoSnapshotReport = {
      used: ['b:build', 'a:build'],
      tasksWithOutputs: [],
      diagnostics: [{ reason: 'disabled', taskId: 'c:e2e' }],
      resolution,
    };
    expect(ioSnapshotReportToJson(result, resolved('fetched'))).toEqual({
      fetch: { status: 'fetched' },
      resolution,
      used: ['a:build', 'b:build'],
      diagnostics: [{ reason: 'disabled', taskId: 'c:e2e' }],
    });
  });
});
