import {
  getTaskIOService,
  registerTaskProcessStart,
  TaskPidUpdate,
} from './task-io-service';
import { getProcessMetricsService } from './process-metrics-service';

describe('registerTaskProcessStart', () => {
  // The service is a singleton with no unsubscribe, so one subscription for
  // the file; re-subscribing per test would multiply every notification.
  const updates: TaskPidUpdate[] = [];
  let registerTaskProcess: ReturnType<typeof vi.spyOn>;

  beforeAll(() =>
    getTaskIOService().subscribeToTaskPids((update) => updates.push(update))
  );

  beforeEach(() => {
    updates.length = 0;
    registerTaskProcess = vi
      .spyOn(getProcessMetricsService(), 'registerTaskProcess')
      .mockImplementation(() => {});
  });

  afterEach(() => registerTaskProcess.mockRestore());

  it('notifies PID subscribers for a task without a ultracache configuration', () => {
    registerTaskProcessStart({ id: 'proj:tracked' }, 100);

    expect(updates).toEqual([{ taskId: 'proj:tracked', pid: 100 }]);
  });

  // Every mode but `off` records, so an on-only gate would pass the no-mode
  // case and still suppress `warn` and `error`.
  it.each(['on', 'warn', 'error'] as const)(
    'notifies PID subscribers for mode %s',
    (mode) => {
      registerTaskProcessStart(
        { id: `proj:${mode}`, ultracache: { mode } },
        300
      );

      expect(updates).toEqual([{ taskId: `proj:${mode}`, pid: 300 }]);
    }
  );

  it('notifies PID subscribers for an ultracache configuration with no mode', () => {
    registerTaskProcessStart(
      { id: 'proj:ignores-only', ultracache: { ignoredReads: ['tmp/**'] } },
      300
    );

    expect(updates).toEqual([{ taskId: 'proj:ignores-only', pid: 300 }]);
  });

  it('suppresses PID updates for a task whose ultracache mode is off', () => {
    registerTaskProcessStart(
      { id: 'proj:disabled', ultracache: { mode: 'off' } },
      200
    );
    registerTaskProcessStart({ id: 'proj:other' }, 201);

    expect(updates).toEqual([{ taskId: 'proj:other', pid: 201 }]);
  });

  // The opt-out covers reporting only. Cleanup, kill-on-exit and orphan reaping
  // all run off the metrics service, so it must see every process.
  it('registers metrics for a task whose ultracache is disabled', () => {
    registerTaskProcessStart(
      { id: 'proj:disabled', ultracache: { mode: 'off' } },
      200
    );

    expect(registerTaskProcess).toHaveBeenCalledWith('proj:disabled', 200);
  });

  // The decision travels with the task, so one run's opt-out cannot leak into
  // another task that happens to reuse the id.
  it('decides per call rather than remembering a task id', () => {
    registerTaskProcessStart(
      { id: 'proj:same', ultracache: { mode: 'off' } },
      400
    );
    registerTaskProcessStart({ id: 'proj:same' }, 401);

    expect(updates).toEqual([{ taskId: 'proj:same', pid: 401 }]);
  });
});
