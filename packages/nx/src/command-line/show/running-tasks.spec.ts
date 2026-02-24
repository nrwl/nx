import { showRunningTasksHandler } from './running-tasks';

function createMockDaemonClient(
  runningTasks: any[] = [],
  taskOutput: string = ''
) {
  return {
    getRunningTasks: jest.fn().mockResolvedValue(runningTasks),
    getRunningTaskOutput: jest.fn().mockResolvedValue(taskOutput),
  } as any;
}

describe('showRunningTasksHandler', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('should output JSON of all running tasks', async () => {
    const client = createMockDaemonClient([
      {
        pid: 1234,
        command: 'nx serve app',
        startTime: '2026-02-24T10:00:00.000Z',
        tasks: {
          'app:serve': { status: 'in-progress', continuous: true },
        },
      },
    ]);

    await showRunningTasksHandler({}, client);

    const output = stdoutSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].tasks['app:serve'].status).toBe('in-progress');
  });

  it('should output task log when --task is provided', async () => {
    const client = createMockDaemonClient(
      [
        {
          pid: 1234,
          command: 'nx serve',
          tasks: { 'app:serve': { status: 'in-progress' } },
        },
      ],
      'Server running on http://localhost:4200\n'
    );

    await showRunningTasksHandler({ task: 'app:serve' }, client);

    expect(client.getRunningTaskOutput).toHaveBeenCalledWith(1234, 'app:serve');
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('localhost:4200')
    );
  });

  it('should return empty array when no tasks running', async () => {
    const client = createMockDaemonClient([]);

    await showRunningTasksHandler({}, client);

    const output = stdoutSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([]);
  });

  it('should error when --task specifies non-existent task', async () => {
    const client = createMockDaemonClient([
      {
        pid: 1234,
        command: 'nx serve',
        tasks: { 'app:serve': { status: 'in-progress' } },
      },
    ]);

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    await showRunningTasksHandler({ task: 'nonexistent:task' }, client);

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('should handle multiple runs and find task in correct one', async () => {
    const client = createMockDaemonClient(
      [
        {
          pid: 1111,
          command: 'nx build app',
          tasks: { 'app:build': { status: 'success' } },
        },
        {
          pid: 2222,
          command: 'nx serve app',
          tasks: { 'app:serve': { status: 'in-progress' } },
        },
      ],
      'Server started'
    );

    await showRunningTasksHandler({ task: 'app:serve' }, client);

    expect(client.getRunningTaskOutput).toHaveBeenCalledWith(2222, 'app:serve');
  });
});
