import { join } from 'path';
import type { TaskHasher } from '../hasher/task-hasher';
import type { TaskGraph } from '../config/task-graph';

// The hasher and output application run for real; the orchestrator only
// records the hasher and graph it is handed.
const orchestrated = vi.hoisted(() => ({
  hasher: undefined as unknown as TaskHasher,
  taskGraph: undefined as unknown as TaskGraph,
}));
const root = vi.hoisted(() => ({ dir: '' }));

vi.mock('../utils/workspace-root', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  get workspaceRoot() {
    return root.dir;
  },
}));
vi.mock('../daemon/client/client', () => ({
  daemonClient: { enabled: () => false },
}));
vi.mock('../utils/dotenv', () => ({ loadRootEnvFiles: vi.fn() }));
vi.mock('./run-command', () => ({
  constructLifeCycles: () => [],
  getRunner: () => ({ runnerOptions: {} }),
  setEnvVarsBasedOnArgs: vi.fn(),
}));
vi.mock('./task-orchestrator', () => ({
  TaskOrchestrator: vi.fn(function (hasher, _cache, _tasks, _pg, taskGraph) {
    orchestrated.hasher = hasher;
    orchestrated.taskGraph = taskGraph;
    return {
      init: vi.fn(),
      processAllScheduledTasks: vi.fn(),
      nextBatch: () => null,
      resolveCachedTasks: async () => [],
      runTaskDirectly: async (_: boolean, task: any) => ({ task }),
      startContinuousTask: async () => ({}),
      waitForContinuousTaskExit: async () => undefined,
      dispose: vi.fn(),
    };
  }),
}));

import { TempFs } from '../internal-testing-utils/temp-fs';
import {
  closeDbConnection,
  connectToNxDb,
  IoSnapshotStore,
  type IoSnapshots,
} from '../native';
import { hydrateFileMap } from '../project-graph/build-project-graph';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { retrieveWorkspaceFiles } from '../project-graph/utils/retrieve-workspace-files';
import { createTaskGraph } from './create-task-graph';
import { runContinuousTasks, runDiscreteTasks } from './init-tasks-runner';

describe.each([
  ['runDiscreteTasks', runDiscreteTasks],
  ['runContinuousTasks', runContinuousTasks],
])('%s with an I/O snapshot set', (_, run) => {
  let tempFs: TempFs;
  let snapshotDb: ReturnType<typeof connectToNxDb>;

  beforeEach(async () => {
    tempFs = new TempFs('init-tasks-runner-io-snapshots');
    root.dir = tempFs.tempDir;
    await tempFs.createFiles({
      'libs/child/project.json': JSON.stringify({ name: 'child' }),
      'libs/child/observed.ts': 'observed',
      'libs/child/unread.ts': 'unread',
      'nx.json': '{}',
    });
    snapshotDb = connectToNxDb(join(tempFs.tempDir, 'db'), 'io-snapshots');
  });
  afterEach(() => {
    closeDbConnection(snapshotDb);
    tempFs.cleanup();
  });

  async function fixture() {
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/child': 'child',
    });
    hydrateFileMap(workspaceFiles.fileMap, workspaceFiles.rustReferences);
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        targets: {
          compile: {
            executor: 'nx:run-commands',
            outputs: ['{projectRoot}/dist'],
          },
        },
      },
    });
    const projectGraph = builder.getUpdatedProjectGraph();
    const fullTaskGraph = createTaskGraph(
      projectGraph,
      {},
      ['child'],
      ['compile'],
      undefined,
      {}
    );
    return {
      projectGraph,
      fullTaskGraph,
      task: fullTaskGraph.tasks['child:compile'],
    };
  }

  function recordedSet(): IoSnapshots {
    const commit = 'head'.padEnd(40, '0');
    new IoSnapshotStore(snapshotDb).import({
      requestedCommit: commit,
      snapshotsJson: JSON.stringify({
        'child:compile': {
          commit,
          inputs: ['libs/child/observed.ts'],
          outputs: ['libs/child/generated'],
        },
      }),
    });
    return new IoSnapshotStore(snapshotDb).get(commit)!;
  }

  const hashOf = (task: any) =>
    orchestrated.hasher.hashTask(task, orchestrated.taskGraph, {});

  it('extends declared outputs with observed ones and hashes the task from its recorded reads', async () => {
    const { projectGraph, fullTaskGraph, task } = await fixture();

    await run(
      [task],
      projectGraph,
      fullTaskGraph,
      {},
      {} as any,
      recordedSet()
    );

    expect(task.outputs).toEqual(['libs/child/dist', 'libs/child/generated']);
    const hash = await hashOf(task);
    expect(hash.details.nodes).not.toHaveProperty(['child:libs/child/**/*']);
    expect(
      Object.keys(hash.details.nodes).filter((k) =>
        k.startsWith('io-snapshot:')
      )
    ).toHaveLength(1);

    // The hash follows the read, not the declared fileset's other files.
    await tempFs.createFiles({ 'libs/child/unread.ts': 'changed' });
    expect((await hashOf(task)).value).toBe(hash.value);
    await tempFs.createFiles({ 'libs/child/observed.ts': 'changed' });
    expect((await hashOf(task)).value).not.toBe(hash.value);
  });

  it('hashes natively and keeps declared outputs without a set', async () => {
    const { projectGraph, fullTaskGraph, task } = await fixture();

    await run([task], projectGraph, fullTaskGraph, {}, {} as any);

    expect(task.outputs).toEqual(['libs/child/dist']);
    const { nodes } = (await hashOf(task)).details;
    expect(nodes).toHaveProperty(['child:libs/child/**/*']);
    expect(Object.keys(nodes).some((k) => k.startsWith('io-snapshot:'))).toBe(
      false
    );
  });
});
