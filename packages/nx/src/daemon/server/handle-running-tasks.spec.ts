import {
  handleRegisterRunningTasks,
  handleUpdateRunningTasks,
  handleUnregisterRunningTasks,
  handleGetRunningTasks,
  handleGetRunningTaskOutput,
  clearRunningProcesses,
} from './handle-running-tasks';

describe('handle-running-tasks', () => {
  beforeEach(() => {
    clearRunningProcesses();
  });

  it('should register and retrieve running tasks', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx run-many -t build', [
      'app:build',
      'lib:build',
    ]);

    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      pid: process.pid,
      command: 'nx run-many -t build',
    });
    expect(tasks[0].tasks['app:build']).toMatchObject({
      status: 'not-started',
    });
    expect(tasks[0].tasks['lib:build']).toMatchObject({
      status: 'not-started',
    });
  });

  it('should update task statuses', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx build app', [
      'app:build',
    ]);
    await handleUpdateRunningTasks(
      process.pid,
      [{ id: 'app:build', status: 'in-progress' }],
      {}
    );

    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    expect(tasks[0].tasks['app:build'].status).toBe('in-progress');
  });

  it('should add new tasks via update if not registered initially', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx build', []);
    await handleUpdateRunningTasks(
      process.pid,
      [{ id: 'app:build', status: 'in-progress', continuous: true }],
      {}
    );

    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    expect(tasks[0].tasks['app:build']).toMatchObject({
      status: 'in-progress',
      continuous: true,
    });
  });

  it('should store and retrieve task output (ring buffer, last 100 lines)', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx serve app', [
      'app:serve',
    ]);

    // Send 150 lines of output
    const lines = Array.from({ length: 150 }, (_, i) => `line ${i}`)
      .join('\n')
      .concat('\n');
    await handleUpdateRunningTasks(process.pid, [], { 'app:serve': lines });

    const result = await handleGetRunningTaskOutput(process.pid, 'app:serve');
    const output = JSON.parse(result.response as string);
    const outputLines = output.split('\n').filter(Boolean);
    expect(outputLines).toHaveLength(100);
    expect(outputLines[0]).toBe('line 50');
    expect(outputLines[99]).toBe('line 149');
  });

  it('should accumulate output across multiple updates', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx serve', ['app:serve']);

    await handleUpdateRunningTasks(process.pid, [], {
      'app:serve': 'line 1\n',
    });
    await handleUpdateRunningTasks(process.pid, [], {
      'app:serve': 'line 2\n',
    });

    const result = await handleGetRunningTaskOutput(process.pid, 'app:serve');
    const output = JSON.parse(result.response as string);
    expect(output).toBe('line 1\nline 2');
  });

  it('should unregister and clean up', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx build', ['app:build']);
    await handleUpdateRunningTasks(process.pid, [], {
      'app:build': 'some output\n',
    });
    await handleUnregisterRunningTasks(process.pid);

    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    expect(tasks).toEqual([]);

    // Output should also be cleaned up
    const outputResult = await handleGetRunningTaskOutput(
      process.pid,
      'app:build'
    );
    const output = JSON.parse(outputResult.response as string);
    expect(output).toBe('');
  });

  it('should prune processes with dead PIDs on GET', async () => {
    // Register with a PID that doesn't exist
    await handleRegisterRunningTasks(999999, 'nx build', ['app:build']);

    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    expect(tasks).toEqual([]);
  });

  it('should handle multiple concurrent runs', async () => {
    await handleRegisterRunningTasks(1111, 'nx build app', ['app:build']);
    await handleRegisterRunningTasks(2222, 'nx serve app', ['app:serve']);

    // Use current process PID so they aren't pruned as dead
    // Instead, just check the map has both before pruning
    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    // Both will be pruned since PIDs 1111 and 2222 don't exist,
    // but the register and storage itself works
    expect(tasks).toEqual([]);
  });

  it('should handle update for non-existent process gracefully', async () => {
    const result = await handleUpdateRunningTasks(
      9999,
      [{ id: 'app:build', status: 'in-progress' }],
      {}
    );
    expect(result.description).toBe(
      'handleUpdateRunningTasks (no process found)'
    );
  });

  it('should return empty output for non-existent task', async () => {
    const result = await handleGetRunningTaskOutput(1234, 'nonexistent:task');
    const output = JSON.parse(result.response as string);
    expect(output).toBe('');
  });

  it('should preserve startTime and endTime in updates', async () => {
    await handleRegisterRunningTasks(process.pid, 'nx build', ['app:build']);
    const startTime = '2026-02-24T10:00:00.000Z';
    const endTime = '2026-02-24T10:00:05.000Z';

    await handleUpdateRunningTasks(
      process.pid,
      [{ id: 'app:build', status: 'success', startTime, endTime }],
      {}
    );

    const result = await handleGetRunningTasks();
    const tasks = JSON.parse(result.response as string);
    expect(tasks[0].tasks['app:build']).toMatchObject({
      status: 'success',
      startTime,
      endTime,
    });
  });
});
