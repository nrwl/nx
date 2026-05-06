import type { ProjectGraph } from '../config/project-graph';
import type { HashInputs } from '../native';

// ── Mocks must be declared BEFORE imports that use them ─────────────────────
//
// jest.mock() calls are hoisted to the top of the file by Babel/SWC, which
// means any factory closure runs before module-level `const` declarations are
// initialised.  The pattern below avoids referencing outer-scope variables
// inside the factory; instead we configure the mock in beforeEach so every
// test starts with a fresh set of spies.

jest.mock('./hash-plan-inspector', () => ({
  HashPlanInspector: jest.fn(),
}));

jest.mock('../tasks-runner/utils', () => ({
  getOutputsForTargetAndConfiguration: jest.fn(),
}));

jest.mock('../tasks-runner/create-task-graph', () => ({
  createTaskGraph: jest.fn(),
}));

jest.mock('./task-hasher', () => ({
  getInputs: jest.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

// eslint-disable-next-line import/order
import { HashPlanInspector } from './hash-plan-inspector';
// eslint-disable-next-line import/order
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
// eslint-disable-next-line import/order
import { createTaskGraph } from '../tasks-runner/create-task-graph';
// eslint-disable-next-line import/order
import { getInputs as mockedGetInputs } from './task-hasher';
// eslint-disable-next-line import/order
import { createTaskFileResolver } from './task-file-resolver';

const MockHashPlanInspector = jest.mocked(HashPlanInspector);
const mockGetOutputs = jest.mocked(getOutputsForTargetAndConfiguration);
const mockCreateTaskGraph = jest.mocked(createTaskGraph);
const mockGetStructuredInputs = jest.mocked(mockedGetInputs);

// ── Per-test mock spies ──────────────────────────────────────────────────────

let mockInit: jest.Mock;
let mockInspectTaskInputs: jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGraph(): ProjectGraph {
  return {
    nodes: {
      myproj: {
        name: 'myproj',
        type: 'lib',
        data: {
          root: 'libs/myproj',
          targets: {
            build: {
              executor: '@nx/js:tsc',
              outputs: ['dist/libs/myproj'],
            },
          },
        },
      },
    },
    dependencies: { myproj: [] },
  } as unknown as ProjectGraph;
}

function makeHashInputs(files: string[]): HashInputs {
  return {
    files,
    runtime: [],
    environment: [],
    depOutputs: [],
    external: [],
  };
}

/**
 * Project graph used by the dependentTasksOutputFiles tests: includes a
 * direct dep `dep` and a transitive chain `mid → deep`, all with a `build`
 * target so the resolver's getOutputs() doesn't short-circuit.
 */
function buildGraphWithDeps(): ProjectGraph {
  const buildTarget = {
    executor: '@nx/js:tsc',
    outputs: [] as string[],
  };
  return {
    nodes: {
      myproj: {
        name: 'myproj',
        type: 'lib',
        data: { root: 'libs/myproj', targets: { build: buildTarget } },
      },
      dep: {
        name: 'dep',
        type: 'lib',
        data: { root: 'libs/dep', targets: { build: buildTarget } },
      },
      mid: {
        name: 'mid',
        type: 'lib',
        data: { root: 'libs/mid', targets: { build: buildTarget } },
      },
      deep: {
        name: 'deep',
        type: 'lib',
        data: { root: 'libs/deep', targets: { build: buildTarget } },
      },
    },
    dependencies: { myproj: [], dep: [], mid: [], deep: [] },
  } as unknown as ProjectGraph;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createTaskFileResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Rebuild per-test spies so callers can customise return values.
    mockInit = jest.fn().mockResolvedValue(undefined);
    mockInspectTaskInputs = jest.fn();

    MockHashPlanInspector.mockImplementation(
      () =>
        ({
          init: mockInit,
          inspectTaskInputs: mockInspectTaskInputs,
        }) as unknown as HashPlanInspector
    );

    // Default: no outputs
    mockGetOutputs.mockReturnValue([]);

    // Defaults for the new dependentTasksOutputFiles code path: empty task
    // graph and empty depsOutputs unless a test overrides them.
    mockCreateTaskGraph.mockReturnValue({
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    });
    mockGetStructuredInputs.mockReturnValue({
      selfInputs: [],
      depsInputs: [],
      depsOutputs: [],
      projectInputs: [],
      depsFilesets: [],
    } as ReturnType<typeof mockedGetInputs>);
  });

  it('initialises the HashPlanInspector exactly once', async () => {
    const graph = buildGraph();
    mockInspectTaskInputs.mockReturnValue({
      'myproj:build': makeHashInputs([]),
    });

    const resolver = await createTaskFileResolver({ projectGraph: graph });

    // Trigger multiple calls to exercise init-once guarantee
    resolver.getInputs('myproj:build');
    resolver.getInputs('myproj:build');
    resolver.getOutputs('myproj:build');

    expect(MockHashPlanInspector).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  describe('getInputs', () => {
    it('returns the expanded file list from the inspector', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([
          'libs/myproj/src/index.ts',
          'libs/myproj/package.json',
        ]),
      });

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      const inputs = resolver.getInputs('myproj:build');

      expect(inputs).toEqual([
        'libs/myproj/src/index.ts',
        'libs/myproj/package.json',
      ]);
    });

    it('returns empty array when inspector finds no files', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(resolver.getInputs('myproj:build')).toEqual([]);
    });

    it('caches result — inspectTaskInputs called only once per taskId', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      resolver.getInputs('myproj:build');
      resolver.getInputs('myproj:build');
      resolver.getInputs('myproj:build');

      expect(mockInspectTaskInputs).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOutputs', () => {
    it('returns the output patterns for the task', async () => {
      const graph = buildGraph();
      mockGetOutputs.mockReturnValue([
        'dist/libs/myproj',
        'dist/libs/myproj/**',
      ]);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      const outputs = resolver.getOutputs('myproj:build');

      expect(outputs).toEqual(['dist/libs/myproj', 'dist/libs/myproj/**']);
    });

    it('returns empty array when node has no matching target', async () => {
      const graph = buildGraph();

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      // 'myproj:test' target does not exist in graph
      const outputs = resolver.getOutputs('myproj:test');

      expect(outputs).toEqual([]);
      expect(mockGetOutputs).not.toHaveBeenCalled();
    });

    it('caches result — getOutputsForTargetAndConfiguration called only once per taskId', async () => {
      const graph = buildGraph();
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      resolver.getOutputs('myproj:build');
      resolver.getOutputs('myproj:build');
      resolver.getOutputs('myproj:build');

      expect(mockGetOutputs).toHaveBeenCalledTimes(1);
    });
  });

  describe('isInput', () => {
    it('returns true for a path in the input file list (exact match)', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(resolver.isInput('myproj:build', 'libs/myproj/src/index.ts')).toBe(
        true
      );
    });

    it('returns false for a path NOT in the input file list', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(resolver.isInput('myproj:build', 'libs/other/src/index.ts')).toBe(
        false
      );
    });

    it('returns true when path matches a materialized depOutputs entry (upstream has run)', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': {
          files: [],
          runtime: [],
          environment: [],
          depOutputs: ['libs/dep/dist/index.d.ts'],
          external: [],
        },
      });

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(resolver.isInput('myproj:build', 'libs/dep/dist/index.d.ts')).toBe(
        true
      );
    });

    it('returns true when path matches a dependentTasksOutputFiles glob AND an upstream task output (upstream has NOT run)', async () => {
      const graph = buildGraphWithDeps();
      // No materialized files / depOutputs — simulating "upstream not yet run".
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });

      // Task graph: myproj:build depends directly on dep:build.
      mockCreateTaskGraph.mockReturnValue({
        roots: ['dep:build'],
        tasks: {
          'myproj:build': {
            id: 'myproj:build',
            target: { project: 'myproj', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'dep:build': {
            id: 'dep:build',
            target: { project: 'dep', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'myproj:build': ['dep:build'],
          'dep:build': [],
        },
        continuousDependencies: {},
      });

      // myproj:build declares one dependentTasksOutputFiles input.
      mockGetStructuredInputs.mockReturnValue({
        selfInputs: [],
        depsInputs: [],
        depsOutputs: [
          { dependentTasksOutputFiles: '**/*.d.ts', transitive: false },
        ],
        projectInputs: [],
        depsFilesets: [],
      } as ReturnType<typeof mockedGetInputs>);

      // dep:build declares libs/dep/dist as an output dir.
      mockGetOutputs.mockImplementation(((t: {
        project?: string;
        target?: { project?: string };
      }) =>
        (t.project ?? t.target?.project) === 'dep'
          ? ['libs/dep/dist']
          : []) as typeof getOutputsForTargetAndConfiguration);

      const resolver = await createTaskFileResolver({ projectGraph: graph });

      // Path lies inside dep:build's outputs AND matches the **/*.d.ts glob.
      expect(resolver.isInput('myproj:build', 'libs/dep/dist/index.d.ts')).toBe(
        true
      );
    });

    it('returns false when path matches the dependentTasksOutputFiles glob but no upstream output covers it', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockCreateTaskGraph.mockReturnValue({
        roots: ['dep:build'],
        tasks: {
          'myproj:build': {
            id: 'myproj:build',
            target: { project: 'myproj', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'dep:build': {
            id: 'dep:build',
            target: { project: 'dep', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'myproj:build': ['dep:build'],
          'dep:build': [],
        },
        continuousDependencies: {},
      });
      mockGetStructuredInputs.mockReturnValue({
        selfInputs: [],
        depsInputs: [],
        depsOutputs: [
          { dependentTasksOutputFiles: '**/*.d.ts', transitive: false },
        ],
        projectInputs: [],
        depsFilesets: [],
      } as ReturnType<typeof mockedGetInputs>);
      // dep:build's outputs do NOT include this path.
      mockGetOutputs.mockReturnValue(['libs/dep/dist']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });

      // Matches **/*.d.ts but NOT inside libs/dep/dist.
      expect(
        resolver.isInput('myproj:build', 'libs/somewhere-else/index.d.ts')
      ).toBe(false);
    });

    it('returns false when path lies inside an upstream output but does not match the dependentTasksOutputFiles glob', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockCreateTaskGraph.mockReturnValue({
        roots: ['dep:build'],
        tasks: {
          'myproj:build': {
            id: 'myproj:build',
            target: { project: 'myproj', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'dep:build': {
            id: 'dep:build',
            target: { project: 'dep', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'myproj:build': ['dep:build'],
          'dep:build': [],
        },
        continuousDependencies: {},
      });
      mockGetStructuredInputs.mockReturnValue({
        selfInputs: [],
        depsInputs: [],
        depsOutputs: [
          { dependentTasksOutputFiles: '**/*.d.ts', transitive: false },
        ],
        projectInputs: [],
        depsFilesets: [],
      } as ReturnType<typeof mockedGetInputs>);
      mockGetOutputs.mockReturnValue(['libs/dep/dist']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });

      // .js does not match **/*.d.ts even though the path is inside the output dir.
      expect(resolver.isInput('myproj:build', 'libs/dep/dist/index.js')).toBe(
        false
      );
    });

    it('walks transitive task graph dependencies when transitive=true', async () => {
      const graph = buildGraphWithDeps();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      // myproj -> mid -> deep
      mockCreateTaskGraph.mockReturnValue({
        roots: ['deep:build'],
        tasks: {
          'myproj:build': {
            id: 'myproj:build',
            target: { project: 'myproj', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'mid:build': {
            id: 'mid:build',
            target: { project: 'mid', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'deep:build': {
            id: 'deep:build',
            target: { project: 'deep', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'myproj:build': ['mid:build'],
          'mid:build': ['deep:build'],
          'deep:build': [],
        },
        continuousDependencies: {},
      });
      mockGetStructuredInputs.mockReturnValue({
        selfInputs: [],
        depsInputs: [],
        depsOutputs: [
          { dependentTasksOutputFiles: '**/*.d.ts', transitive: true },
        ],
        projectInputs: [],
        depsFilesets: [],
      } as ReturnType<typeof mockedGetInputs>);
      mockGetOutputs.mockImplementation(((t: {
        project?: string;
        target?: { project?: string };
      }) =>
        (t.project ?? t.target?.project) === 'deep'
          ? ['libs/deep/dist']
          : []) as typeof getOutputsForTargetAndConfiguration);

      const resolver = await createTaskFileResolver({ projectGraph: graph });

      // The matching output lives on the transitive dep `deep:build`.
      expect(
        resolver.isInput('myproj:build', 'libs/deep/dist/index.d.ts')
      ).toBe(true);
    });

    it('does NOT walk transitive deps when transitive flag is false (default)', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockCreateTaskGraph.mockReturnValue({
        roots: ['deep:build'],
        tasks: {
          'myproj:build': {
            id: 'myproj:build',
            target: { project: 'myproj', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'mid:build': {
            id: 'mid:build',
            target: { project: 'mid', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'deep:build': {
            id: 'deep:build',
            target: { project: 'deep', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'myproj:build': ['mid:build'],
          'mid:build': ['deep:build'],
          'deep:build': [],
        },
        continuousDependencies: {},
      });
      mockGetStructuredInputs.mockReturnValue({
        selfInputs: [],
        depsInputs: [],
        depsOutputs: [
          { dependentTasksOutputFiles: '**/*.d.ts', transitive: false },
        ],
        projectInputs: [],
        depsFilesets: [],
      } as ReturnType<typeof mockedGetInputs>);
      // Only `deep` declares a matching output dir; `mid` declares nothing.
      mockGetOutputs.mockImplementation(((t: {
        project?: string;
        target?: { project?: string };
      }) =>
        (t.project ?? t.target?.project) === 'deep'
          ? ['libs/deep/dist']
          : []) as typeof getOutputsForTargetAndConfiguration);

      const resolver = await createTaskFileResolver({ projectGraph: graph });

      // With transitive=false, only direct dep `mid:build` is consulted, and
      // it has no matching outputs.
      expect(
        resolver.isInput('myproj:build', 'libs/deep/dist/index.d.ts')
      ).toBe(false);
    });
  });

  describe('matchesDependentTaskOutputs', () => {
    it('exposes the same dep-outputs check as a standalone method', async () => {
      const graph = buildGraphWithDeps();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockCreateTaskGraph.mockReturnValue({
        roots: ['dep:build'],
        tasks: {
          'myproj:build': {
            id: 'myproj:build',
            target: { project: 'myproj', target: 'build' },
            overrides: {},
            outputs: [],
          },
          'dep:build': {
            id: 'dep:build',
            target: { project: 'dep', target: 'build' },
            overrides: {},
            outputs: [],
          },
        },
        dependencies: {
          'myproj:build': ['dep:build'],
          'dep:build': [],
        },
        continuousDependencies: {},
      });
      mockGetStructuredInputs.mockReturnValue({
        selfInputs: [],
        depsInputs: [],
        depsOutputs: [
          { dependentTasksOutputFiles: '**/*.d.ts', transitive: false },
        ],
        projectInputs: [],
        depsFilesets: [],
      } as ReturnType<typeof mockedGetInputs>);
      mockGetOutputs.mockImplementation(((t: {
        project?: string;
        target?: { project?: string };
      }) =>
        (t.project ?? t.target?.project) === 'dep'
          ? ['libs/dep/dist']
          : []) as typeof getOutputsForTargetAndConfiguration);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(
        resolver.matchesDependentTaskOutputs(
          'myproj:build',
          'libs/dep/dist/index.d.ts'
        )
      ).toBe(true);
      expect(
        resolver.matchesDependentTaskOutputs(
          'myproj:build',
          'libs/dep/dist/index.js'
        )
      ).toBe(false);
    });
  });

  describe('isOutput', () => {
    it('returns true for an exact match against an output pattern', async () => {
      const graph = buildGraph();
      mockGetOutputs.mockReturnValue(['dist/libs/myproj/index.js']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(
        resolver.isOutput('myproj:build', 'dist/libs/myproj/index.js')
      ).toBe(true);
    });

    it('returns true when path is nested inside an output directory', async () => {
      const graph = buildGraph();
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(
        resolver.isOutput('myproj:build', 'dist/libs/myproj/deep/file.js')
      ).toBe(true);
    });

    it('returns true for a glob pattern match (dist/**)', async () => {
      const graph = buildGraph();
      mockGetOutputs.mockReturnValue(['dist/**']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(resolver.isOutput('myproj:build', 'dist/main.js')).toBe(true);
      expect(resolver.isOutput('myproj:build', 'dist/nested/chunk.js')).toBe(
        true
      );
    });

    it('returns false for a path that does NOT match any output pattern', async () => {
      const graph = buildGraph();
      mockGetOutputs.mockReturnValue(['dist/**']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });
      expect(resolver.isOutput('myproj:build', 'other-dir/file.js')).toBe(
        false
      );
    });
  });

  describe('caching across both getInputs and getOutputs', () => {
    it('does not call underlying APIs more than once per taskId even with mixed calls', async () => {
      const graph = buildGraph();
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      const resolver = await createTaskFileResolver({ projectGraph: graph });

      // Interleaved calls for the same taskId
      resolver.getInputs('myproj:build');
      resolver.getOutputs('myproj:build');
      resolver.getInputs('myproj:build');
      resolver.getOutputs('myproj:build');

      expect(mockInspectTaskInputs).toHaveBeenCalledTimes(1);
      expect(mockGetOutputs).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseTaskId validation', () => {
    it('throws on a taskId that has no colon (no target)', async () => {
      const graph = buildGraph();
      const resolver = await createTaskFileResolver({ projectGraph: graph });

      expect(() => resolver.getInputs('justproject')).toThrow(
        /Invalid taskId "justproject"/
      );
    });

    it('throws on an empty taskId string', async () => {
      const graph = buildGraph();
      const resolver = await createTaskFileResolver({ projectGraph: graph });

      expect(() => resolver.getInputs('')).toThrow(/Invalid taskId ""/);
    });
  });
});
