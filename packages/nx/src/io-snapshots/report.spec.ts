import { formatIoSnapshotSummary, ioSnapshotReportToJson } from './report';
import type { IoSnapshotOverridesResult } from './overrides';

const resolution = {
  requestedCommit: 'abc123',
  commits: ['abc123'],
  sourceCommits: ['abc123'],
  digest: 'deadbeef',
  fetchedAt: 0,
  clientVersion: '1',
  tasks: 3,
};

const override = {
  files: [],
  taskOutputs: {},
  digest: 'deadbeef',
};

describe('formatIoSnapshotSummary', () => {
  it('prints nothing when snapshots are disabled', () => {
    expect(formatIoSnapshotSummary(null, null)).toBeNull();
    expect(ioSnapshotReportToJson(null, null)).toBeNull();
  });

  it('counts used tasks and groups fallbacks by reason', () => {
    const result: IoSnapshotOverridesResult = {
      overrides: { 'a:build': override, 'b:build': override },
      diagnostics: [
        { reason: 'disabled', taskId: 'c:e2e' },
        { reason: 'missing', taskId: 'd:test' },
        { reason: 'missing', taskId: 'e:test' },
        { reason: 'root-anchored-glob', taskId: 'f:lint', glob: '**/*.ts' },
      ],
      resolution,
    };
    const summary = formatIoSnapshotSummary(result, {
      status: 'cached',
      directory: '/w/.nx/cache/io-snapshots/abc123',
    });
    expect(summary.line).toBe(
      'I/O snapshots: 2 tasks hashed from snapshot, 4 tasks fell back (2 missing, 1 disabled, 1 root-anchored-glob)'
    );
    expect(summary.bodyLines).toEqual([
      'bundle: cached at /w/.nx/cache/io-snapshots/abc123',
      'commit abc123, digest deadbeef, 3 tasks in bundle',
      'c:e2e: ioSnapshots is false',
      'd:test: no snapshot for this task',
      'e:test: no snapshot for this task',
      'f:lint: snapshot glob "**/*.ts" is anchored at the workspace root',
    ]);
  });

  it('explains a bundle-level failure with the fetch reason', () => {
    const result: IoSnapshotOverridesResult = {
      overrides: {},
      diagnostics: [{ reason: 'no-bundle' }],
      resolution: null,
    };
    expect(
      formatIoSnapshotSummary(result, { status: 'skipped', reason: 'offline' })
        .line
    ).toBe('I/O snapshots: none used (offline)');
    expect(
      formatIoSnapshotSummary(
        {
          ...result,
          diagnostics: [
            {
              reason: 'invalid-bundle',
              file: 'snapshots.json',
              message: 'bad',
            },
          ],
        },
        null
      ).line
    ).toBe('I/O snapshots: none used (invalid bundle: bad)');
  });

  it('serializes the report for --json consumers', () => {
    const result: IoSnapshotOverridesResult = {
      overrides: { 'b:build': override, 'a:build': override },
      diagnostics: [{ reason: 'disabled', taskId: 'c:e2e' }],
      resolution,
    };
    expect(ioSnapshotReportToJson(result, { status: 'fetched' })).toEqual({
      fetch: { status: 'fetched', reason: undefined, message: undefined },
      resolution,
      used: ['a:build', 'b:build'],
      diagnostics: [{ reason: 'disabled', taskId: 'c:e2e' }],
    });
  });
});
