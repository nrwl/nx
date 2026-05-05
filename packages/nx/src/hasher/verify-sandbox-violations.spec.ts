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
import { verifySandboxViolations } from './verify-sandbox-violations';

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

describe('verifySandboxViolations', () => {
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

  it('returns empty array for empty violations', async () => {
    const result = await verifySandboxViolations([], {
      projectGraph: buildGraph(),
    });
    expect(result).toEqual([]);
    expect(MockHashPlanInspector).not.toHaveBeenCalled();
  });

  describe('all-reconciled case', () => {
    it('returns ok:true when every read and write is accounted for', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([
          'libs/myproj/src/index.ts',
          'libs/myproj/package.json',
        ]),
      });
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      const [result] = await verifySandboxViolations(
        [
          {
            taskId: 'myproj:build',
            reads: ['libs/myproj/src/index.ts', 'libs/myproj/package.json'],
            writes: ['dist/libs/myproj/index.js'],
          },
        ],
        { projectGraph: graph }
      );

      expect(result.ok).toBe(true);
      expect(result.reads.reconciled).toEqual([
        'libs/myproj/src/index.ts',
        'libs/myproj/package.json',
      ]);
      expect(result.reads.stillUnexpected).toEqual([]);
      expect(result.writes.reconciled).toEqual(['dist/libs/myproj/index.js']);
      expect(result.writes.stillUnexpected).toEqual([]);
    });
  });

  describe('mixed case', () => {
    it('splits paths into reconciled and stillUnexpected correctly', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      const [result] = await verifySandboxViolations(
        [
          {
            taskId: 'myproj:build',
            reads: ['libs/myproj/src/index.ts', 'some/secret/file.ts'],
            writes: ['dist/libs/myproj/bundle.js', '/tmp/shadow-file'],
          },
        ],
        { projectGraph: graph }
      );

      expect(result.ok).toBe(false);
      expect(result.reads.reconciled).toEqual(['libs/myproj/src/index.ts']);
      expect(result.reads.stillUnexpected).toEqual(['some/secret/file.ts']);
      expect(result.writes.reconciled).toEqual(['dist/libs/myproj/bundle.js']);
      expect(result.writes.stillUnexpected).toEqual(['/tmp/shadow-file']);
    });
  });

  describe('all-still-unexpected case', () => {
    it('returns ok:false when nothing is reconciled', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockGetOutputs.mockReturnValue([]);

      const [result] = await verifySandboxViolations(
        [
          {
            taskId: 'myproj:build',
            reads: ['sneaky/read.ts'],
            writes: ['sneaky/write.js'],
          },
        ],
        { projectGraph: graph }
      );

      expect(result.ok).toBe(false);
      expect(result.reads.stillUnexpected).toEqual(['sneaky/read.ts']);
      expect(result.writes.stillUnexpected).toEqual(['sneaky/write.js']);
      expect(result.reads.reconciled).toEqual([]);
      expect(result.writes.reconciled).toEqual([]);
    });
  });

  describe('glob output matching', () => {
    it('reconciles a write that matches a glob output pattern', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      // Output is a glob pattern
      mockGetOutputs.mockReturnValue(['dist/**']);

      const [result] = await verifySandboxViolations(
        [
          {
            taskId: 'myproj:build',
            writes: ['dist/main.js', 'dist/nested/chunk.js'],
          },
        ],
        { projectGraph: graph }
      );

      expect(result.writes.reconciled).toEqual([
        'dist/main.js',
        'dist/nested/chunk.js',
      ]);
      expect(result.writes.stillUnexpected).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it('does NOT reconcile a write that is outside the glob pattern', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });
      mockGetOutputs.mockReturnValue(['dist/**']);

      const [result] = await verifySandboxViolations(
        [
          {
            taskId: 'myproj:build',
            writes: ['other-dir/file.js'],
          },
        ],
        { projectGraph: graph }
      );

      expect(result.writes.stillUnexpected).toEqual(['other-dir/file.js']);
      expect(result.ok).toBe(false);
    });
  });

  describe('empty reads and writes', () => {
    it('handles undefined reads and writes as empty arrays', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });

      const [result] = await verifySandboxViolations(
        [{ taskId: 'myproj:build' }],
        { projectGraph: graph }
      );

      expect(result.reads.reconciled).toEqual([]);
      expect(result.reads.stillUnexpected).toEqual([]);
      expect(result.writes.reconciled).toEqual([]);
      expect(result.writes.stillUnexpected).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it('handles explicitly empty reads and writes arrays', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });

      const [result] = await verifySandboxViolations(
        [{ taskId: 'myproj:build', reads: [], writes: [] }],
        { projectGraph: graph }
      );

      expect(result.reads.reconciled).toEqual([]);
      expect(result.reads.stillUnexpected).toEqual([]);
      expect(result.writes.reconciled).toEqual([]);
      expect(result.writes.stillUnexpected).toEqual([]);
      expect(result.ok).toBe(true);
    });
  });

  describe('deduplication of inspector calls', () => {
    it('calls inspectTaskInputs only once for duplicate taskIds', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
      });
      mockGetOutputs.mockReturnValue(['dist/libs/myproj']);

      await verifySandboxViolations(
        [
          {
            taskId: 'myproj:build',
            reads: ['libs/myproj/src/index.ts'],
          },
          {
            taskId: 'myproj:build',
            reads: ['libs/myproj/src/index.ts'],
            writes: ['dist/libs/myproj/bundle.js'],
          },
          {
            taskId: 'myproj:build',
            writes: ['dist/libs/myproj/other.js'],
          },
        ],
        { projectGraph: graph }
      );

      // Three violations with the same taskId → inspector called only once
      expect(mockInspectTaskInputs).toHaveBeenCalledTimes(1);
    });

    it('builds the HashPlanInspector exactly once for the whole batch', async () => {
      const graph = buildGraph();

      mockInspectTaskInputs.mockReturnValue({
        'myproj:build': makeHashInputs([]),
      });

      await verifySandboxViolations(
        [
          { taskId: 'myproj:build' },
          { taskId: 'myproj:build' },
          { taskId: 'myproj:build' },
        ],
        { projectGraph: graph }
      );

      expect(MockHashPlanInspector).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it('calls inspectTaskInputs once per unique taskId across multiple distinct tasks', async () => {
      // Two-project graph
      const graph = {
        nodes: {
          myproj: {
            name: 'myproj',
            type: 'lib',
            data: {
              root: 'libs/myproj',
              targets: { build: { executor: '@nx/js:tsc' } },
            },
          },
          otherproj: {
            name: 'otherproj',
            type: 'lib',
            data: {
              root: 'libs/otherproj',
              targets: { build: { executor: '@nx/js:tsc' } },
            },
          },
        },
        dependencies: { myproj: [], otherproj: [] },
      } as unknown as ProjectGraph;

      mockInspectTaskInputs
        .mockReturnValueOnce({
          'myproj:build': makeHashInputs(['libs/myproj/src/index.ts']),
        })
        .mockReturnValueOnce({
          'otherproj:build': makeHashInputs(['libs/otherproj/src/index.ts']),
        });

      await verifySandboxViolations(
        [
          { taskId: 'myproj:build', reads: ['libs/myproj/src/index.ts'] },
          { taskId: 'otherproj:build', reads: ['libs/otherproj/src/index.ts'] },
          // Duplicate — should NOT cause a third call
          { taskId: 'myproj:build', reads: ['libs/myproj/src/index.ts'] },
        ],
        { projectGraph: graph }
      );

      // Two unique taskIds → exactly two inspectTaskInputs calls
      expect(mockInspectTaskInputs).toHaveBeenCalledTimes(2);
    });
  });
});
