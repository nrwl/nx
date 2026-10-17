import { BatchMessageType } from './batch-messages';

const batchImplementation = vi.fn();

vi.mock('../../project-graph/project-graph', () => ({
  readProjectsConfigurationFromProjectGraph: () => ({
    version: 2,
    projects: {
      a: {
        root: 'libs/a',
        targets: { build: { executor: '@nx/test:build', options: {} } },
      },
    },
  }),
}));

vi.mock('../../config/configuration', () => ({
  readNxJson: () => ({}),
}));

vi.mock('../../command-line/run/executor-utils', () => ({
  parseExecutor: (executor: string) => executor.split(':'),
  getExecutorInformation: () => ({
    schema: {
      properties: { watch: { type: 'boolean' } },
    },
    batchImplementationFactory: () => batchImplementation,
  }),
}));

describe('run-batch', () => {
  beforeAll(async () => {
    await import('./run-batch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print schema errors and exit instead of rejecting', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const exited = new Promise<number>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
        resolve(code);
      }) as any);
    });

    process.emit(
      'message' as any,
      {
        type: BatchMessageType.RunTasks,
        executorName: '@nx/test:build',
        projectGraph: { nodes: {}, dependencies: {} },
        batchTaskGraph: {
          roots: ['a:build'],
          tasks: {
            'a:build': {
              id: 'a:build',
              target: { project: 'a', target: 'build' },
              overrides: { watch: 'abc' },
            },
          },
          dependencies: {},
          continuousDependencies: {},
        },
        fullTaskGraph: {
          roots: [],
          tasks: {},
          dependencies: {},
          continuousDependencies: {},
        },
      } as any
    );

    expect(await exited).toEqual(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("'abc' should be a 'boolean'")
    );
    expect(batchImplementation).not.toHaveBeenCalled();
  });
});
