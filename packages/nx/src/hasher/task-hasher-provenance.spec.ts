import type {
  Task,
  TaskGraph,
  TaskUltracacheHashing,
} from '../config/task-graph';
import type { PartialHash } from './task-hasher';
import { DaemonBasedTaskHasher, InProcessTaskHasher } from './task-hasher';

const nativeHashers = vi.hoisted(() => ({
  hashTask: vi.fn(),
  hashTasks: vi.fn(),
  hashTasksUpfront: vi.fn(),
}));
vi.mock('./native-task-hasher-impl', () => ({
  NativeTaskHasherImpl: vi.fn(function () {
    return nativeHashers;
  }),
}));

const provenance: TaskUltracacheHashing = {
  mode: 'on',
  usedDeclaredInputs: false,
  configDigest: 'digest',
  sourceCommit: 'ancestor',
  fallbackReason: null,
};
const task: Task = {
  id: 'app:build',
  target: { project: 'app', target: 'build' },
  overrides: {},
  outputs: [],
  cache: true,
};
const graph: TaskGraph = {
  roots: [task.id],
  tasks: { [task.id]: task },
  dependencies: {},
  continuousDependencies: {},
};
const partial: PartialHash = {
  value: 'native-hash',
  details: { file: 'file-hash' },
  inputs: {
    files: [],
    runtime: [],
    environment: [],
    depOutputs: [],
    external: [],
  },
  ultracacheHashing: provenance,
};

it('preserves native provenance through single, batch and upfront command hashing without hashing it', async () => {
  const hasher = new InProcessTaskHasher(
    { nodes: {}, dependencies: {} },
    {},
    null,
    {}
  );
  nativeHashers.hashTask.mockResolvedValue(partial);
  nativeHashers.hashTasks.mockResolvedValue([partial]);
  nativeHashers.hashTasksUpfront.mockResolvedValue({ [task.id]: partial });
  const single = await hasher.hashTask(task, graph, {});
  expect(single.ultracacheHashing).toEqual(provenance);
  expect(await hasher.hashTasks([task], graph, { [task.id]: {} })).toEqual([
    single,
  ]);
  expect(
    await hasher.hashTasksUpfront([task], graph, { [task.id]: {} })
  ).toEqual({ [task.id]: single });
  nativeHashers.hashTask.mockResolvedValue({
    ...partial,
    ultracacheHashing: undefined,
  });
  const unknown = await hasher.hashTask(task, graph, {});
  expect(unknown.value).toBe(single.value);
  expect(unknown.details).toEqual(single.details);
  expect(unknown.ultracacheHashing).toBeUndefined();
});

it('preserves captured daemon metadata through all client hashing paths', async () => {
  const result = {
    ...partial,
    details: { command: 'command', nodes: partial.details },
  };
  const client = {
    hashTasks: vi.fn(async () => JSON.parse(JSON.stringify([result]))),
    hashTasksUpfront: vi.fn(async () =>
      JSON.parse(JSON.stringify({ [task.id]: result }))
    ),
  };
  const hasher = new DaemonBasedTaskHasher(
    client as any,
    {},
    { commit: 'checkout', fetchedAt: 1 }
  );
  expect((await hasher.hashTask(task, graph, {})).ultracacheHashing).toEqual(
    provenance
  );
  expect(
    (await hasher.hashTasks([task], graph, { [task.id]: {} }))[0]
      .ultracacheHashing
  ).toEqual(provenance);
  expect(
    (await hasher.hashTasksUpfront([task], graph, { [task.id]: {} }))[task.id]
      .ultracacheHashing
  ).toEqual(provenance);
});
