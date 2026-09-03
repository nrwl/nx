import { SharedRunningTask } from './shared-running-task';

describe('SharedRunningTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fire exit callbacks once when the owning process finishes the task', async () => {
    const service = { getRunningTasks: vi.fn(() => ['t1']) };
    const task = new SharedRunningTask(service as any, 't1');
    const exits: number[] = [];
    task.onExit((code) => exits.push(code));

    await vi.advanceTimersByTimeAsync(300);
    expect(exits).toEqual([]);

    service.getRunningTasks.mockReturnValue([]);
    await vi.advanceTimersByTimeAsync(200);
    expect(exits).toEqual([0]);
  });

  it('should stop watching the db and not re-fire exit callbacks after kill()', async () => {
    const service = { getRunningTasks: vi.fn(() => ['t1']) };
    const task = new SharedRunningTask(service as any, 't1');
    const exits: number[] = [];
    task.onExit((code) => exits.push(code));

    await vi.advanceTimersByTimeAsync(500);
    const pollsBeforeKill = service.getRunningTasks.mock.calls.length;
    expect(pollsBeforeKill).toBeGreaterThan(0);

    task.kill();
    expect(exits).toEqual([0]);

    // The watcher previously kept polling (and re-fired callbacks) until the
    // owning process finished, pinning the caller's object graph.
    await vi.advanceTimersByTimeAsync(1000);
    expect(service.getRunningTasks.mock.calls.length).toBe(pollsBeforeKill);
    expect(exits).toEqual([0]);

    task.kill();
    expect(exits).toEqual([0]);
  });
});
