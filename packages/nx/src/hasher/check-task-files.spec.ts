import type { ProjectGraph } from '../config/project-graph';
import type { HashInputs } from '../native';

// ── Mocks must be declared BEFORE imports that use them ─────────────────────
//
// jest.mock() calls are hoisted to the top of the file by Babel/SWC. We
// configure the mock implementations in beforeEach so every test starts with a
// fresh set of spies. _resetContextForTesting() clears the module-level cache
// so each test loads a clean context.

jest.mock('../project-graph/project-graph', () => ({
  createProjectGraphAsync: jest.fn(),
}));

jest.mock('../config/nx-json', () => ({
  readNxJson: jest.fn().mockReturnValue({}),
}));

jest.mock('./hash-plan-inspector', () => ({
  HashPlanInspector: jest.fn(),
}));

jest.mock('../tasks-runner/utils', () => {
  const actual = jest.requireActual('../tasks-runner/utils');
  return {
    ...actual,
    getOutputsForTargetAndConfiguration: jest.fn(),
  };
});

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { createProjectGraphAsync } from '../project-graph/project-graph';
import { HashPlanInspector } from './hash-plan-inspector';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
import {
  checkFilesAreInputs,
  checkFilesAreOutputs,
  _resetContextForTesting,
} from './check-task-files';

const mockCreateProjectGraphAsync = jest.mocked(createProjectGraphAsync);
const MockHashPlanInspector = jest.mocked(HashPlanInspector);
const mockGetOutputs = jest.mocked(getOutputsForTargetAndConfiguration);

// ── Per-test mock spies ──────────────────────────────────────────────────────
//
// The dependency-graph walk and dependentTasksOutputFiles glob matching now
// live in native code (HashPlanInspector.checkDependentTaskOutputFiles), which
// has its own Rust unit tests. Here we mock the native-backed inspector methods
// and verify the TypeScript wiring: that checkFilesAreInputs combines declared
// input files, materialized depOutputs, and dependent-task-output matches, and
// that the (expensive) hash plan is built only once per taskId.

let mockInit: jest.Mock;
let mockGetPlansReferenceForTask: jest.Mock;
let mockInspectInputsFromPlan: jest.Mock;
let mockCheckDependentTaskOutputFiles: jest.Mock;

// A stand-in for the opaque native plan reference. Only its truthiness matters
// to the TypeScript code under test.
const PLANS_REFERENCE = { __plansReference: true };

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

describe('checkFilesAreInputs / checkFilesAreOutputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module-level caches so each test gets a fresh context load.
    _resetContextForTesting();

    mockInit = jest.fn().mockResolvedValue(undefined);
    mockGetPlansReferenceForTask = jest.fn().mockReturnValue(PLANS_REFERENCE);
    mockInspectInputsFromPlan = jest.fn().mockReturnValue({});
    mockCheckDependentTaskOutputFiles = jest.fn().mockReturnValue({});

    MockHashPlanInspector.mockImplementation(
      () =>
        ({
          init: mockInit,
          getPlansReferenceForTask: mockGetPlansReferenceForTask,
          inspectInputsFromPlan: mockInspectInputsFromPlan,
          checkDependentTaskOutputFiles: mockCheckDependentTaskOutputFiles,
        }) as unknown as HashPlanInspector
    );

    // Default project graph returned by createProjectGraphAsync.
    mockCreateProjectGraphAsync.mockResolvedValue(buildGraph());

    // Default: no outputs.
    mockGetOutputs.mockReturnValue([]);
  });

  it('loads the project graph exactly once across multiple calls', async () => {
    mockInspectInputsFromPlan.mockReturnValue({
      'myproj:build': makeHashInputs([]),
    });

    await checkFilesAreInputs('myproj:build', []);
    await checkFilesAreInputs('myproj:build', []);
    await checkFilesAreOutputs('myproj:build', []);

    expect(mockCreateProjectGraphAsync).toHaveBeenCalledTimes(1);
    expect(MockHashPlanInspector).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  // ── checkFilesAreInputs ──────────────────────────────────────────────────

  describe('checkFilesAreInputs', () => {
    it('returns matched for a path in the input file list (exact match)', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/myproj/src/index.ts',
      ]);
      expect(result.matched).toEqual(['libs/myproj/src/index.ts']);
      expect(result.unmatched).toEqual([]);
    });

    it('returns unmatched for a path NOT in the input file list', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/other/src/index.ts',
      ]);
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual(['libs/other/src/index.ts']);
    });

    it('splits a mixed file list into matched and unmatched', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs([
          'libs/myproj/src/index.ts',
          'libs/myproj/package.json',
        ]),
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/myproj/src/index.ts',
        'libs/other/src/unrelated.ts',
        'libs/myproj/package.json',
      ]);
      expect(result.matched).toEqual([
        'libs/myproj/src/index.ts',
        'libs/myproj/package.json',
      ]);
      expect(result.unmatched).toEqual(['libs/other/src/unrelated.ts']);
    });

    it('matches a materialized depOutputs entry (upstream has run)', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': {
          files: [],
          runtime: [],
          environment: [],
          depOutputs: ['libs/dep/dist/index.d.ts'],
          external: [],
        },
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/dep/dist/index.d.ts',
      ]);
      expect(result.matched).toEqual(['libs/dep/dist/index.d.ts']);
    });

    it('matches a dependentTasksOutputFiles file reported by the native check (upstream has NOT run)', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      // depOutputs is empty (upstream not built); the static native check is
      // what reports the file as a dependent-task output.
      mockCheckDependentTaskOutputFiles.mockReturnValue({
        'myproj:build': ['libs/dep/dist/index.d.ts'],
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/dep/dist/index.d.ts',
      ]);
      expect(result.matched).toEqual(['libs/dep/dist/index.d.ts']);
      expect(mockCheckDependentTaskOutputFiles).toHaveBeenCalledWith(
        PLANS_REFERENCE,
        ['libs/dep/dist/index.d.ts']
      );
    });

    it('does NOT match when the native check reports no dependent-task outputs', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockCheckDependentTaskOutputFiles.mockReturnValue({});

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/somewhere-else/index.d.ts',
      ]);
      expect(result.unmatched).toEqual(['libs/somewhere-else/index.d.ts']);
    });

    it('normalizes file paths before matching and before the native check', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs\\myproj\\src\\index.ts',
      ]);
      expect(result.matched).toEqual(['libs\\myproj\\src\\index.ts']);
      // The native check receives the normalized (forward-slash) path.
      expect(mockCheckDependentTaskOutputFiles).toHaveBeenCalledWith(
        PLANS_REFERENCE,
        ['libs/myproj/src/index.ts']
      );
    });

    it('propagates errors instead of reporting every file as unmatched when the plan fails to build', async () => {
      // A failure to build the hash plan must surface as a thrown error so a
      // validation tool sees "could not determine" rather than a confident-but-
      // wrong "not an input" verdict for legitimate inputs.
      mockGetPlansReferenceForTask.mockImplementation(() => {
        throw new Error('task graph failed to construct');
      });

      await expect(
        checkFilesAreInputs('myproj:build', ['libs/myproj/src/index.ts'])
      ).rejects.toThrow('task graph failed to construct');
    });
  });

  // ── checkFilesAreOutputs ─────────────────────────────────────────────────

  describe('checkFilesAreOutputs', () => {
    it('returns matched for an exact match against an output pattern', async () => {
      mockGetOutputs.mockReturnValue(['dist/libs/myproj/index.js']);

      const result = await checkFilesAreOutputs('myproj:build', [
        'dist/libs/myproj/index.js',
      ]);
      expect(result.matched).toEqual(['dist/libs/myproj/index.js']);
      expect(result.unmatched).toEqual([]);
    });

    it('returns matched when path is nested inside an output directory', async () => {
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      const result = await checkFilesAreOutputs('myproj:build', [
        'dist/libs/myproj/deep/file.js',
      ]);
      expect(result.matched).toEqual(['dist/libs/myproj/deep/file.js']);
    });

    it('returns matched for a glob pattern match', async () => {
      mockGetOutputs.mockReturnValue(['dist/**']);

      const result = await checkFilesAreOutputs('myproj:build', [
        'dist/main.js',
        'dist/nested/chunk.js',
        'other-dir/file.js',
      ]);
      expect(result.matched).toEqual(['dist/main.js', 'dist/nested/chunk.js']);
      expect(result.unmatched).toEqual(['other-dir/file.js']);
    });

    it('returns unmatched for a path that does NOT match any output pattern', async () => {
      mockGetOutputs.mockReturnValue(['dist/**']);

      const result = await checkFilesAreOutputs('myproj:build', [
        'other-dir/file.js',
      ]);
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual(['other-dir/file.js']);
    });

    it('returns empty matched/unmatched for an empty file list', async () => {
      mockGetOutputs.mockReturnValue(['dist/**']);

      const result = await checkFilesAreOutputs('myproj:build', []);
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual([]);
    });
  });

  // ── taskId validation ────────────────────────────────────────────────────

  describe('taskId validation', () => {
    it('throws on a taskId that has no colon (no target)', async () => {
      await expect(checkFilesAreInputs('justproject', [])).rejects.toThrow(
        /Invalid taskId "justproject"/
      );
    });

    it('throws on an empty taskId string', async () => {
      await expect(checkFilesAreInputs('', [])).rejects.toThrow(
        /Invalid taskId ""/
      );
    });

    it('throws from checkFilesAreOutputs on an invalid taskId', async () => {
      await expect(checkFilesAreOutputs('justproject', [])).rejects.toThrow(
        /Invalid taskId "justproject"/
      );
    });
  });

  // ── caching ──────────────────────────────────────────────────────────────

  describe('caching across calls', () => {
    it('builds the hash plan and resolves outputs at most once per taskId', async () => {
      mockInspectInputsFromPlan.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      await checkFilesAreInputs('myproj:build', ['libs/myproj/src/index.ts']);
      await checkFilesAreOutputs('myproj:build', ['dist/libs/myproj/x.js']);
      await checkFilesAreInputs('myproj:build', ['libs/myproj/src/index.ts']);
      await checkFilesAreOutputs('myproj:build', ['dist/libs/myproj/x.js']);

      // The expensive work — building the native plan and resolving output
      // patterns — happens once per taskId despite four calls.
      expect(mockGetPlansReferenceForTask).toHaveBeenCalledTimes(1);
      expect(mockInspectInputsFromPlan).toHaveBeenCalledTimes(1);
      expect(mockGetOutputs).toHaveBeenCalledTimes(1);
    });
  });
});
