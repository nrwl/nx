import { formatIoSnapshotSummary } from './report';
import type { IoSnapshotReport } from '../native';

const resolution = {
  requestedCommit: 'abc123',
  fetchedAt: 0,
  tasks: 3,
};

describe('formatIoSnapshotSummary', () => {
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
      'fetched'
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
        { reason: 'invalid-glob', taskId: 'f:lint', glob: 'libs/./x.ts' },
        { reason: 'escapes-workspace', taskId: 'g:build', glob: '../x/**' },
      ],
      resolution,
    };
    const summary = formatIoSnapshotSummary(result, 'cached');
    expect(summary.line).toBe(
      'I/O snapshots: 2 tasks hashed from snapshot (1 with observed outputs), 5 tasks fell back (2 missing, 1 disabled, 1 escapes-workspace, 1 invalid-glob)'
    );
    expect(summary.bodyLines).toEqual([
      'set: cached',
      'commit abc123, 3 tasks in set',
      'c:e2e: sandbox.enabled is false',
      'd:test: no snapshot for this task',
      'e:test: no snapshot for this task',
      'f:lint: snapshot glob "libs/./x.ts" is not a valid files glob',
      'g:build: snapshot glob "../x/**" escapes the workspace',
    ]);
  });

  it('says none were used when the set could not be read', () => {
    expect(
      formatIoSnapshotSummary(
        {
          used: [],
          tasksWithOutputs: [],
          diagnostics: [{ reason: 'unreadable-set', message: 'bad' }],
          resolution,
        },
        'cached'
      ).line
    ).toBe('I/O snapshots: none used (unreadable set: bad)');
  });
});
