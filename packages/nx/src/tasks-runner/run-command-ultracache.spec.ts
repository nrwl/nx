import { invokeTasksRunner } from './run-command';
import { createTaskGraph } from './create-task-graph';
import type { ProjectGraph } from '../config/project-graph';

const cloud = vi.hoisted(() => ({ load: vi.fn() }));
const createTaskHasher = vi.hoisted(() => vi.fn());
vi.mock('../ultracache/store', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  loadUltracacheConfigurationsForRun: cloud.load,
}));
vi.mock('../hasher/create-task-hasher', () => ({ createTaskHasher }));
vi.mock('../hasher/hash-task', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getTaskDetails: () => null,
}));

describe('workspace Ultracache mode at the hashing boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not enable recordings or retain a previous command default when the fetch gate is absent', async () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('NX_CLOUD_USE_ULTRACACHE', undefined);
    const { loadUltracacheConfigurationsForRun } = await vi.importActual<
      typeof import('../ultracache/store')
    >('../ultracache/store');
    // Reuse the project graph, as a long-lived process or the daemon does.
    const projectGraph: ProjectGraph = {
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: {
            root: 'apps/app',
            targets: {
              build: {
                executor: 'nx:run-commands',
                ultracache: { collectStats: true },
              },
              test: {
                executor: 'nx:run-commands',
                ultracache: { mode: 'on' },
              },
            },
          },
        },
      },
      dependencies: { app: [] },
    };
    for (const mode of ['warn', 'error', 'on', 'off', undefined, 'invalid']) {
      vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', mode);
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['app'],
        ['build', 'test'],
        undefined,
        {}
      );
      cloud.load.mockImplementationOnce(loadUltracacheConfigurationsForRun);
      const reachedHashing = new Error('reached hashing');
      createTaskHasher.mockImplementationOnce(
        (_graph, _nxJson, _options, configurations) => {
          expect(configurations).toBeUndefined();
          expect(taskGraph.tasks['app:build'].ultracache).toEqual({
            collectStats: true,
            ...(mode && mode !== 'invalid' ? { mode } : {}),
          });
          expect(taskGraph.tasks['app:test'].ultracache).toEqual({
            mode: 'on',
          });
          throw reachedHashing;
        }
      );
      await expect(
        invokeTasksRunner({
          tasks: Object.values(taskGraph.tasks),
          projectGraph,
          taskGraph,
          lifeCycle: {},
          nxJson: { nxCloudId: 'id' },
          nxArgs: {},
          loadDotEnvFiles: false,
          initiatingProject: null,
          initiatingTasks: [],
        })
      ).rejects.toBe(reachedHashing);
      expect(process.env.NX_CLOUD_USE_ULTRACACHE).toBeUndefined();
      expect(process.env.NX_CLOUD_ULTRACACHE_MODE).toBe(mode);
      expect(projectGraph.nodes.app.data.targets.build.ultracache).toEqual({
        collectStats: true,
      });
    }
  });

  it.each(['on', 'warn', 'error', 'off'])(
    'resolves %s after the Cloud client has supplied it during the awaited fetch',
    async (mode) => {
      vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', undefined);
      const projectGraph: ProjectGraph = {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'apps/app',
              targets: {
                build: {
                  executor: 'nx:run-commands',
                  ultracache: { collectStats: true },
                },
                test: {
                  executor: 'nx:run-commands',
                  ultracache: { mode: 'on' },
                },
              },
            },
          },
        },
        dependencies: { app: [] },
      };
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['app'],
        ['build', 'test'],
        undefined,
        {}
      );
      cloud.load.mockImplementationOnce(async () => {
        await Promise.resolve();
        vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', mode);
        return null;
      });
      // Stop at the hasher boundary: executing tasks is outside this regression.
      const reachedHashing = new Error('reached hashing');
      createTaskHasher.mockImplementationOnce(() => {
        expect(taskGraph.tasks['app:build'].ultracache).toEqual({
          collectStats: true,
          mode,
        });
        expect(taskGraph.tasks['app:test'].ultracache).toEqual({ mode: 'on' });
        throw reachedHashing;
      });
      await expect(
        invokeTasksRunner({
          tasks: Object.values(taskGraph.tasks),
          projectGraph,
          taskGraph,
          lifeCycle: {},
          nxJson: {},
          nxArgs: {},
          loadDotEnvFiles: false,
          initiatingProject: null,
          initiatingTasks: [],
        })
      ).rejects.toBe(reachedHashing);
      expect(projectGraph.nodes.app.data.targets.build.ultracache).toEqual({
        collectStats: true,
      });
    }
  );
});
