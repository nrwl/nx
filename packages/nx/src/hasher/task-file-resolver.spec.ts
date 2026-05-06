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

// ── Imports (after mocks) ────────────────────────────────────────────────────

// eslint-disable-next-line import/order
import { HashPlanInspector } from './hash-plan-inspector';
// eslint-disable-next-line import/order
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
// eslint-disable-next-line import/order
import { createTaskFileResolver } from './task-file-resolver';

const MockHashPlanInspector = jest.mocked(HashPlanInspector);
const mockGetOutputs = jest.mocked(getOutputsForTargetAndConfiguration);

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
