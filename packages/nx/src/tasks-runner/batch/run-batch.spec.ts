import { deserialize } from 'v8';
import { TaskGraph } from '../../config/task-graph';
import { isDedupedPayload } from '../../utils/dedupe-serialization';
import { encodeTaskGraphForWorker } from '../task-graph-for-worker';
import { BatchMessageType } from './batch-messages';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async () => ({})) }));
vi.mock('../../command-line/run/executor-utils', () => ({
  parseExecutor: () => ['test-plugin', 'build'],
  getExecutorInformation: () => ({
    schema: {},
    batchImplementationFactory: () => execute,
  }),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../utils/params', () => ({
  combineOptionsForExecutor: (options) => options,
}));

function graph(projects: string[], inputs: number): TaskGraph {
  const shared: Record<string, string> = { shared: 'value'.repeat(100) };
  for (let i = 1; i < inputs; i++) shared[`workspace:lib/file-${i}.ts`] = 'h';
  return {
    roots: [`${projects[0]}:build`],
    dependencies: Object.fromEntries(projects.map((p) => [`${p}:build`, []])),
    continuousDependencies: {},
    tasks: Object.fromEntries(
      projects.map((project) => [
        `${project}:build`,
        {
          id: `${project}:build`,
          target: { project, target: 'build' },
          overrides: {},
          outputs: [],
          hash: `hash-${project}`,
          hashDetails: { command: 'build', nodes: { ...shared, project } },
        },
      ])
    ),
  };
}

describe('batch worker task graph transport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NX_CLI_SET', '');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ['plain objects', ['a', 'b'], 1, false],
    ['small buffers, JSON bytes', ['a', 'b'], 1, true],
    [
      'dense buffers, deduped',
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      300,
      true,
    ],
  ])(
    'passes independent complete graphs to the batch from %s',
    async (_, projects, inputs, asBuffer) => {
      const input = graph(projects, inputs);
      const projectGraph = {
        nodes: Object.fromEntries(
          projects.map((name) => [
            name,
            {
              name,
              type: 'lib',
              data: {
                root: name,
                targets: { build: { executor: 'test-plugin:build' } },
              },
            },
          ])
        ),
        dependencies: Object.fromEntries(projects.map((p) => [p, []])),
      };
      const encode = () =>
        asBuffer
          ? encodeTaskGraphForWorker(input)
          : JSON.parse(JSON.stringify(input));
      if (inputs > 1) {
        expect(isDedupedPayload(deserialize(encode() as Buffer))).toBe(true);
      }
      const send = vi.spyOn(process, 'send').mockImplementation(() => true);
      const on = vi.spyOn(process, 'on');
      await import('./run-batch');
      const callback = on.mock.calls.find(
        ([event]) => event === 'message'
      )?.[1];
      expect(callback).toBeTypeOf('function');
      try {
        await callback({
          type: BatchMessageType.RunTasks,
          executorName: 'test-plugin:build',
          projectGraph,
          batchTaskGraph: encode(),
          fullTaskGraph: encode(),
        });
        const [batchGraph, , , context] = vi
          .mocked(execute)
          .mock.calls.at(-1) as any;
        expect(JSON.stringify(batchGraph)).toBe(JSON.stringify(input));
        expect(JSON.stringify(context.taskGraph)).toBe(JSON.stringify(input));
        // Two decodes of the same bytes must yield two independent objects.
        batchGraph.tasks['a:build'].hashDetails.nodes.shared = 'changed';
        expect(
          context.taskGraph.tasks['a:build'].hashDetails.nodes.shared
        ).toBe('value'.repeat(100));
        expect(send).toHaveBeenCalledWith({
          type: BatchMessageType.CompleteBatchExecution,
          results: {},
        });
      } finally {
        process.removeListener('message', callback);
      }
    }
  );
});
