import { deserialize } from 'v8';
import { run } from '../src/command-line/run/run';
import { TaskGraph } from '../src/config/task-graph';
import { encodeTaskGraphForWorker } from '../src/tasks-runner/task-graph-for-worker';
import { isDedupedPayload } from '../src/utils/dedupe-serialization';

vi.mock('../src/command-line/run/run', () => ({ run: vi.fn(async () => 0) }));

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

describe('run-executor task graph transport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NX_WORKSPACE_ROOT', '/workspace');
    vi.stubEnv('NX_TERMINAL_OUTPUT_PATH', '');
    vi.stubEnv('NX_CLI_SET', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ['a plain object', ['a', 'b'], 1, false],
    ['a small buffer, JSON bytes', ['a', 'b'], 1, true],
    [
      'a dense buffer, deduped',
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      300,
      true,
    ],
  ])(
    'passes the complete graph to the executor from %s',
    async (_, projects, inputs, asBuffer) => {
      const input = graph(projects, inputs);
      const wire = asBuffer
        ? encodeTaskGraphForWorker(input)
        : JSON.parse(JSON.stringify(input));
      if (inputs > 1) {
        // The dense case must actually take the dedupe path on the wire.
        expect(isDedupedPayload(deserialize(wire as Buffer))).toBe(true);
      }
      const exit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const on = vi.spyOn(process, 'on');
      await import('./run-executor');
      const callback = on.mock.calls.find(
        ([event]) => event === 'message'
      )?.[1];
      expect(callback).toBeTypeOf('function');
      try {
        await callback({
          targetDescription: input.tasks['a:build'].target,
          overrides: {},
          taskGraph: wire,
          isVerbose: false,
        });
        const received = vi.mocked(run).mock.calls.at(-1)[5];
        expect(JSON.stringify(received)).toBe(JSON.stringify(input));
        expect(
          Object.getOwnPropertyDescriptor(
            received.tasks['a:build'].hashDetails.nodes,
            'shared'
          )
        ).toEqual({
          value: 'value'.repeat(100),
          writable: true,
          configurable: true,
          enumerable: true,
        });
        expect(exit).toHaveBeenCalledWith(0);
      } finally {
        process.removeListener('message', callback);
      }
    }
  );
});
