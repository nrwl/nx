import type { ReadySignalMessage } from '../../tasks-runner/readiness/ready-signal';
import { ReadySignalServer } from '../../tasks-runner/readiness/ready-signal-server';

vi.mock('../../project-graph/project-graph', () => ({
  readCachedProjectGraph: () => ({ nodes: {}, dependencies: {} }),
  readProjectsConfigurationFromProjectGraph: () => ({
    version: 2,
    projects: {
      app: { root: 'app', targets: { serve: { executor: 'test:serve' } } },
    },
  }),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('./executor-utils', () => ({
  parseExecutor: () => ['test', 'serve'],
  getExecutorInformation: () => ({
    schema: { properties: {} },
    isNxExecutor: true,
    implementationFactory: () =>
      async function* () {
        yield { success: true, baseUrl: 'http://0.0.0.0:4200/app/' };
      },
  }),
}));

describe('run', () => {
  let server: ReadySignalServer;

  beforeEach(async () => {
    server = new ReadySignalServer();
    for (const [key, value] of Object.entries(await server.env('app:serve'))) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    server.close();
  });

  it('signals the task ready at the baseUrl its executor yields', async () => {
    const received: ReadySignalMessage[] = [];
    server.subscribe('app:serve', (message) => received.push(message));
    const { run } = await import('./run');

    const code = await run(
      process.cwd(),
      process.cwd(),
      { project: 'app', target: 'serve' },
      {},
      false,
      { roots: [], tasks: {}, dependencies: {} }
    );
    for (let i = 0; i < 100 && received.length < 1; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(code).toBe(0);
    expect(received).toEqual([
      {
        type: 'nx-ready-signal:ready',
        taskId: 'app:serve',
        url: 'http://localhost:4200/app/',
      },
    ]);
  });
});
