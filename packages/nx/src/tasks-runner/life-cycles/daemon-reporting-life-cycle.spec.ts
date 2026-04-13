import { Task } from '../../config/task-graph';
import { TaskStatus as NativeTaskStatus } from '../../native';
import { TaskResult } from '../life-cycle';
import { DaemonReportingLifeCycle } from './daemon-reporting-life-cycle';

function createMockDaemonClient() {
  return {
    enabled: jest.fn().mockReturnValue(true),
    registerRunningTasks: jest.fn().mockResolvedValue(undefined),
    updateRunningTasks: jest.fn().mockResolvedValue(undefined),
    unregisterRunningTasks: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('DaemonReportingLifeCycle', () => {
  let mockDaemonClient: ReturnType<typeof createMockDaemonClient>;
  let lifecycle: DaemonReportingLifeCycle;

  beforeEach(() => {
    mockDaemonClient = createMockDaemonClient();
    lifecycle = new DaemonReportingLifeCycle(
      mockDaemonClient,
      'nx run-many -t build'
    );
  });

  afterEach(() => {
    // Ensure timer is cleaned up to avoid jest open handle warnings
    lifecycle.endCommand();
  });

  it('should register on startCommand and unregister on endCommand', async () => {
    lifecycle.startCommand();

    // Allow async send to complete
    await flushPromises();

    expect(mockDaemonClient.registerRunningTasks).toHaveBeenCalledWith(
      process.pid,
      'nx run-many -t build',
      []
    );

    lifecycle.endCommand();
    await flushPromises();

    expect(mockDaemonClient.unregisterRunningTasks).toHaveBeenCalledWith(
      process.pid
    );
  });

  it('should send task status updates on startTasks', async () => {
    const tasks = [
      { id: 'app:build', continuous: false },
      { id: 'lib:build', continuous: true },
    ] as Task[];

    lifecycle.startCommand();
    await flushPromises();

    lifecycle.startTasks(tasks);
    await flushPromises();

    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'app:build',
          status: 'in-progress',
          continuous: false,
        }),
        expect.objectContaining({
          id: 'lib:build',
          status: 'in-progress',
          continuous: true,
        }),
      ]),
      {}
    );
  });

  it('should send final statuses on endTasks', async () => {
    lifecycle.startCommand();
    await flushPromises();

    lifecycle.endTasks([
      {
        task: { id: 'app:build' } as Task,
        status: 'success',
        code: 0,
      },
      {
        task: { id: 'lib:build' } as Task,
        status: 'failure',
        code: 1,
      },
    ] as TaskResult[]);
    await flushPromises();

    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      expect.arrayContaining([
        expect.objectContaining({ id: 'app:build', status: 'success' }),
        expect.objectContaining({ id: 'lib:build', status: 'failure' }),
      ]),
      {}
    );
  });

  it('should forward setTaskStatus', async () => {
    lifecycle.startCommand();
    await flushPromises();

    lifecycle.setTaskStatus('app:serve', NativeTaskStatus.Stopped);
    await flushPromises();

    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      [expect.objectContaining({ id: 'app:serve', status: 'stopped' })],
      {}
    );
  });

  it('should no-op when daemon is disabled', async () => {
    mockDaemonClient.enabled.mockReturnValue(false);
    lifecycle = new DaemonReportingLifeCycle(mockDaemonClient, 'nx build app');

    lifecycle.startCommand();
    lifecycle.startTasks([{ id: 'app:build' }] as Task[]);
    lifecycle.appendTaskOutput('app:build', 'output');
    lifecycle.endCommand();
    await flushPromises();

    expect(mockDaemonClient.registerRunningTasks).not.toHaveBeenCalled();
    expect(mockDaemonClient.updateRunningTasks).not.toHaveBeenCalled();
    expect(mockDaemonClient.unregisterRunningTasks).not.toHaveBeenCalled();
  });

  it('should silently catch daemon errors without blocking', async () => {
    mockDaemonClient.registerRunningTasks.mockRejectedValue(
      new Error('daemon down')
    );

    // Should not throw
    lifecycle.startCommand();
    await flushPromises();

    lifecycle.startTasks([{ id: 'app:build' }] as Task[]);
    await flushPromises();
  });

  it('should batch appendTaskOutput and flush on endCommand', async () => {
    lifecycle.startCommand();
    await flushPromises();
    mockDaemonClient.updateRunningTasks.mockClear();

    lifecycle.appendTaskOutput('app:build', 'line 1\n');
    lifecycle.appendTaskOutput('app:build', 'line 2\n');

    // endCommand triggers flush
    lifecycle.endCommand();
    await flushPromises();

    // Should have sent the batched output
    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      [],
      { 'app:build': 'line 1\nline 2\n' }
    );
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
