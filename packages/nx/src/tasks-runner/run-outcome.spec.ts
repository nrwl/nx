import type { Task } from '../config/task-graph';
import type { TaskResult, TaskResults } from './life-cycle';
import type { TaskStatus } from './tasks-runner';
import { didCommandComplete, getRunExitCode } from './run-outcome';

function task(id: string, continuous = false): Task {
  return { id, continuous } as Task;
}

function results(statuses: Record<string, TaskStatus>): TaskResults {
  return Object.fromEntries(
    Object.entries(statuses).map(([id, status]) => [
      id,
      {
        task: task(id),
        status,
        code: status === 'success' ? 0 : 1,
      } as TaskResult,
    ])
  );
}

describe('didCommandComplete', () => {
  it('is complete when every discrete task has a result', () => {
    expect(
      didCommandComplete(
        [task('a'), task('b')],
        results({ a: 'success', b: 'local-cache' })
      )
    ).toBe(true);
  });

  it('treats a discrete task the runner never settled as interrupted', () => {
    expect(
      didCommandComplete([task('a'), task('b')], results({ a: 'success' }), {
        a: 'success',
      })
    ).toBe(false);
  });

  it('counts tasks skipped because a dependency failed as settled', () => {
    expect(
      didCommandComplete(
        [task('upstream'), task('downstream')],
        results({ upstream: 'failure' }),
        { upstream: 'failure', downstream: 'skipped' }
      )
    ).toBe(true);
  });

  it('counts a batch whose tasks were all skipped as settled', () => {
    expect(
      didCommandComplete(
        [task('a'), task('b')],
        {},
        {
          a: 'skipped',
          b: 'skipped',
        }
      )
    ).toBe(true);
  });

  it('does not require results for continuous tasks', () => {
    expect(
      didCommandComplete(
        [task('build'), task('serve', true)],
        results({ build: 'success' })
      )
    ).toBe(true);
  });

  it('treats a stopped task as interrupted', () => {
    expect(
      didCommandComplete([task('a'), task('b')], results({ a: 'stopped' }), {
        a: 'stopped',
        b: 'skipped',
      })
    ).toBe(false);
    expect(didCommandComplete([task('a')], {}, { a: 'stopped' })).toBe(false);
  });
});

describe('getRunExitCode', () => {
  it('exits 130 when the run was interrupted', () => {
    expect(getRunExitCode(false, results({ a: 'failure' }))).toBe(130);
  });

  it('exits 0 when every task succeeded', () => {
    expect(
      getRunExitCode(true, results({ a: 'success', b: 'remote-cache' }), {
        a: 'success',
        b: 'remote-cache',
      })
    ).toBe(0);
  });

  it('exits 1 when a task failed and its dependents were skipped', () => {
    expect(
      getRunExitCode(true, results({ upstream: 'failure' }), {
        upstream: 'failure',
        downstream: 'skipped',
      })
    ).toBe(1);
  });

  it('exits 1 when tasks were skipped without any failed result', () => {
    expect(getRunExitCode(true, {}, { a: 'skipped', b: 'skipped' })).toBe(1);
  });
});
