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

jest.mock('../tasks-runner/create-task-graph', () => ({
  createTaskGraph: jest.fn(),
}));

jest.mock('./task-hasher', () => ({
  getInputs: jest.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { createProjectGraphAsync } from '../project-graph/project-graph';
import { HashPlanInspector } from './hash-plan-inspector';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import { getInputs as mockedGetInputs } from './task-hasher';
import {
  checkFilesAreInputs,
  checkFilesAreOutputs,
  _resetContextForTesting,
} from './check-task-files';

const mockCreateProjectGraphAsync = jest.mocked(createProjectGraphAsync);
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
 * Graph with a direct dep and a transitive chain for dependentTasksOutputFiles
 * tests.
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

describe('checkFilesAreInputs / checkFilesAreOutputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module-level caches so each test gets a fresh context load.
    _resetContextForTesting();

    mockInit = jest.fn().mockResolvedValue(undefined);
    mockInspectTaskInputs = jest.fn();

    MockHashPlanInspector.mockImplementation(
      () =>
        ({
          init: mockInit,
          inspectTaskInputs: mockInspectTaskInputs,
        }) as unknown as HashPlanInspector
    );

    // Default project graph returned by createProjectGraphAsync.
    mockCreateProjectGraphAsync.mockResolvedValue(buildGraph());

    // Default: no outputs.
    mockGetOutputs.mockReturnValue([]);

    // Defaults for the dependentTasksOutputFiles code path.
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

  it('loads the project graph exactly once across multiple calls', async () => {
    mockInspectTaskInputs.mockReturnValue({
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
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/myproj/src/index.ts',
      ]);
      expect(result.matched).toEqual(['libs/myproj/src/index.ts']);
      expect(result.unmatched).toEqual([]);
    });

    it('returns unmatched for a path NOT in the input file list', async () => {
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/other/src/index.ts',
      ]);
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual(['libs/other/src/index.ts']);
    });

    it('splits a mixed file list into matched and unmatched', async () => {
      mockInspectTaskInputs.mockReturnValue({
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
      mockInspectTaskInputs.mockReturnValue({
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

    it('matches via dependentTasksOutputFiles glob + upstream output (upstream has NOT run)', async () => {
      mockCreateProjectGraphAsync.mockResolvedValue(buildGraphWithDeps());
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

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/dep/dist/index.d.ts',
      ]);
      expect(result.matched).toEqual(['libs/dep/dist/index.d.ts']);
    });

    it('does NOT match when path matches the glob but no upstream output covers it', async () => {
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
      // dep:build outputs do NOT cover the path being checked.
      mockGetOutputs.mockReturnValue(['libs/dep/dist']);

      const result = await checkFilesAreInputs('myproj:build', [
        'libs/somewhere-else/index.d.ts',
      ]);
      expect(result.unmatched).toEqual(['libs/somewhere-else/index.d.ts']);
    });

    it('does NOT match when path is inside an upstream output but does not match the glob', async () => {
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

      // .js does not match **/*.d.ts even though the path is inside the output dir.
      const result = await checkFilesAreInputs('myproj:build', [
        'libs/dep/dist/index.js',
      ]);
      expect(result.unmatched).toEqual(['libs/dep/dist/index.js']);
    });

    it('walks transitive task graph dependencies when transitive=true', async () => {
      mockCreateProjectGraphAsync.mockResolvedValue(buildGraphWithDeps());
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

      // The matching output lives on the transitive dep `deep:build`.
      const result = await checkFilesAreInputs('myproj:build', [
        'libs/deep/dist/index.d.ts',
      ]);
      expect(result.matched).toEqual(['libs/deep/dist/index.d.ts']);
    });

    it('does NOT walk transitive deps when transitive=false', async () => {
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
      mockGetOutputs.mockImplementation(((t: {
        project?: string;
        target?: { project?: string };
      }) =>
        (t.project ?? t.target?.project) === 'deep'
          ? ['libs/deep/dist']
          : []) as typeof getOutputsForTargetAndConfiguration);

      // With transitive=false, only direct dep `mid:build` is consulted, and
      // it has no matching outputs → path is unmatched.
      const result = await checkFilesAreInputs('myproj:build', [
        'libs/deep/dist/index.d.ts',
      ]);
      expect(result.unmatched).toEqual(['libs/deep/dist/index.d.ts']);
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

    it('excludes paths matching a negated glob even when a positive glob matches', async () => {
      mockGetOutputs.mockReturnValue([
        'apps/web/.next/**',
        '!apps/web/.next/cache/**',
      ]);

      const result = await checkFilesAreOutputs('myproj:build', [
        'apps/web/.next/static/chunk.js',
        'apps/web/.next/cache/webpack/a.pack',
      ]);
      expect(result.matched).toEqual(['apps/web/.next/static/chunk.js']);
      expect(result.unmatched).toEqual(['apps/web/.next/cache/webpack/a.pack']);
    });

    it('excludes paths inside a negated directory pattern (no glob)', async () => {
      mockGetOutputs.mockReturnValue([
        'apps/web/.next',
        '!apps/web/.next/cache',
      ]);

      const result = await checkFilesAreOutputs('myproj:build', [
        'apps/web/.next/static/chunk.js',
        'apps/web/.next/cache/webpack/a.pack',
      ]);
      expect(result.matched).toEqual(['apps/web/.next/static/chunk.js']);
      expect(result.unmatched).toEqual(['apps/web/.next/cache/webpack/a.pack']);
    });

    it('does NOT match unrelated paths against a standalone negated pattern', async () => {
      mockGetOutputs.mockReturnValue(['!dist/cache/**']);

      const result = await checkFilesAreOutputs('myproj:build', [
        'src/index.ts',
      ]);
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual(['src/index.ts']);
    });

    it('applies exclusion regardless of pattern order', async () => {
      mockGetOutputs.mockReturnValue(['!dist/cache/**', 'dist/**']);

      const result = await checkFilesAreOutputs('myproj:build', [
        'dist/main.js',
        'dist/cache/a.js',
      ]);
      expect(result.matched).toEqual(['dist/main.js']);
      expect(result.unmatched).toEqual(['dist/cache/a.js']);
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
    it('does not call underlying APIs more than once per taskId', async () => {
      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      await checkFilesAreInputs('myproj:build', ['libs/myproj/src/index.ts']);
      await checkFilesAreOutputs('myproj:build', ['dist/libs/myproj/x.js']);
      await checkFilesAreInputs('myproj:build', ['libs/myproj/src/index.ts']);
      await checkFilesAreOutputs('myproj:build', ['dist/libs/myproj/x.js']);

      expect(mockInspectTaskInputs).toHaveBeenCalledTimes(1);
      expect(mockGetOutputs).toHaveBeenCalledTimes(1);
    });
  });
});
