import { getTaskIOService, TaskPidUpdate } from './task-io-service';

describe('TaskIOService sandbox configuration', () => {
  it('notifies PID subscribers for tasks without a sandbox configuration', () => {
    const service = getTaskIOService();
    const updates: TaskPidUpdate[] = [];
    service.subscribeToTaskPids((update) => updates.push(update));

    service.notifyPidUpdate({ taskId: 'proj:tracked', pid: 100 });

    expect(updates).toEqual([{ taskId: 'proj:tracked', pid: 100 }]);
  });

  it('suppresses PID updates for tasks whose sandbox is disabled', () => {
    const service = getTaskIOService();
    const updates: TaskPidUpdate[] = [];
    service.subscribeToTaskPids((update) => updates.push(update));

    service.registerTaskSandboxConfiguration('proj:disabled', {
      enabled: false,
    });
    service.notifyPidUpdate({ taskId: 'proj:disabled', pid: 200 });
    service.notifyPidUpdate({ taskId: 'proj:other', pid: 201 });

    expect(updates).toEqual([{ taskId: 'proj:other', pid: 201 }]);
    expect(service.isTaskSandboxDisabled('proj:disabled')).toBe(true);
  });

  it('keeps PID updates for a sandbox configuration without enabled: false', () => {
    const service = getTaskIOService();
    const updates: TaskPidUpdate[] = [];
    service.subscribeToTaskPids((update) => updates.push(update));

    service.registerTaskSandboxConfiguration('proj:ignores-only', {
      ignoredReads: ['tmp/**'],
    });
    service.notifyPidUpdate({ taskId: 'proj:ignores-only', pid: 300 });

    expect(updates).toEqual([{ taskId: 'proj:ignores-only', pid: 300 }]);
    expect(service.isTaskSandboxDisabled('proj:ignores-only')).toBe(false);
  });

  it('re-enables PID updates when a task is re-registered as enabled', () => {
    const service = getTaskIOService();
    const updates: TaskPidUpdate[] = [];
    service.subscribeToTaskPids((update) => updates.push(update));

    service.registerTaskSandboxConfiguration('proj:reenabled', {
      enabled: false,
    });
    service.notifyPidUpdate({ taskId: 'proj:reenabled', pid: 400 });
    service.registerTaskSandboxConfiguration('proj:reenabled', {
      enabled: true,
    });
    service.notifyPidUpdate({ taskId: 'proj:reenabled', pid: 401 });

    expect(updates).toEqual([{ taskId: 'proj:reenabled', pid: 401 }]);
  });
});
