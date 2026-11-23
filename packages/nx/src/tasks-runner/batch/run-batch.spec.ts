import { BatchMessageType } from './batch-messages';

const batchImplementation = vi.hoisted(() =>
  vi.fn(async (taskGraph: any) =>
    Object.fromEntries(
      Object.keys(taskGraph.tasks).map((id) => [
        id,
        { success: true, terminalOutput: '' },
      ])
    )
  )
);
vi.mock('../../command-line/run/executor-utils', () => ({
  parseExecutor: (executor: string) => executor.split(':'),
  getExecutorInformation: () => ({
    schema: {
      additionalProperties: false,
      properties: { fix: { type: 'boolean' } },
    },
    batchImplementationFactory: () => batchImplementation,
  }),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));

describe('run-batch', () => {
  let onMessage: (message: unknown) => Promise<void>;
  let send: ReturnType<typeof vi.fn>;
  let exit: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const on = vi.spyOn(process, 'on').mockImplementation(((
      event: string,
      listener: any
    ) => {
      if (event === 'message') onMessage = listener;
      return process;
    }) as any);
    await import('./run-batch');
    on.mockRestore();
  });

  beforeEach(() => {
    send = vi.fn();
    process.send = send as any;
    exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any);
  });

  afterEach(() => {
    delete process.send;
    exit.mockRestore();
  });

  const task = (target: string, overrides: Record<string, unknown>) => ({
    id: `app:${target}`,
    target: { project: 'app', target },
    projectRoot: 'app',
    overrides,
    outputs: [],
    parallelism: true,
  });

  // The overrides task-graph creation gives a task whose executor rejects `--fix`.
  it('runs each task with the overrides routed to it', async () => {
    const lint = task('lint', { fix: true, __overrides_unparsed__: ['--fix'] });
    const check = task('check', { __overrides_unparsed__: [] });
    const batchTaskGraph = {
      roots: [lint.id, check.id],
      tasks: { [lint.id]: lint, [check.id]: check },
      dependencies: { [lint.id]: [], [check.id]: [] },
      continuousDependencies: { [lint.id]: [], [check.id]: [] },
    };
    const target = { executor: 'test:strict' };

    await onMessage({
      type: BatchMessageType.RunTasks,
      executorName: 'test:strict',
      projectGraph: {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: { root: 'app', targets: { lint: target, check: target } },
          },
        },
        dependencies: { app: [] },
      },
      batchTaskGraph,
      fullTaskGraph: batchTaskGraph,
    });

    expect(exit).not.toHaveBeenCalled();
    expect(batchImplementation.mock.calls[0][1]).toEqual({
      'app:lint': { fix: true },
      'app:check': {},
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: BatchMessageType.CompleteBatchExecution,
      })
    );
  });
});
