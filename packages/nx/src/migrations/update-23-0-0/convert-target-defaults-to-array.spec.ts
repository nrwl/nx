import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import type { ProjectGraph } from '../../config/project-graph';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

jest.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: jest.fn(),
}));
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import convertTargetDefaultsToArray, {
  convertTargetDefaultsRecordToArray,
} from './convert-target-defaults-to-array';

const createProjectGraphAsyncMock = createProjectGraphAsync as jest.Mock;

function graphWithTargets(
  projects: Record<
    string,
    Record<string, { executor?: string; command?: string }>
  >
): ProjectGraph {
  const nodes: ProjectGraph['nodes'] = {};
  for (const [projectName, targets] of Object.entries(projects)) {
    nodes[projectName] = {
      type: 'lib',
      name: projectName,
      data: { root: `libs/${projectName}`, targets },
    };
  }
  return { nodes, dependencies: {} };
}

describe('convert-target-defaults-to-array migration', () => {
  const originalSkipFormat = process.env.NX_SKIP_FORMAT;

  beforeAll(() => {
    process.env.NX_SKIP_FORMAT = 'true';
  });
  afterAll(() => {
    if (originalSkipFormat === undefined) {
      delete process.env.NX_SKIP_FORMAT;
    } else {
      process.env.NX_SKIP_FORMAT = originalSkipFormat;
    }
  });

  // The migration entry point — nx.json handling. It takes only a `Tree`:
  // the migration runner never passes a project graph, so the signature
  // must not pretend otherwise. Graph-dependent disambiguation is tested
  // separately against `convertTargetDefaultsRecordToArray`.
  describe('convertTargetDefaultsToArray', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      createProjectGraphAsyncMock.mockReset();
      createProjectGraphAsyncMock.mockResolvedValue({
        nodes: {},
        dependencies: {},
      });
    });

    it('is a no-op when nx.json does not exist', async () => {
      tree.delete('nx.json');
      await expect(convertTargetDefaultsToArray(tree)).resolves.toEqual([]);
    });

    it('is a no-op when targetDefaults is absent', async () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;
      updateNxJson(tree, nxJson);
      await convertTargetDefaultsToArray(tree);
      expect(readNxJson(tree).targetDefaults).toBeUndefined();
    });

    it('is a no-op when targetDefaults is already an array', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [
        { target: 'build', cache: true },
        { target: 'test', inputs: ['default', '^production'] },
      ];
      updateNxJson(tree, nxJson);
      await convertTargetDefaultsToArray(tree);
      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'build', cache: true },
        { target: 'test', inputs: ['default', '^production'] },
      ]);
    });

    it('converts a record-shape targetDefaults in nx.json to array shape', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: { cache: true, dependsOn: ['^build'] },
        test: { inputs: ['default', '^production'] },
      };
      updateNxJson(tree, nxJson);
      await convertTargetDefaultsToArray(tree);
      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'build', cache: true, dependsOn: ['^build'] },
        { target: 'test', inputs: ['default', '^production'] },
      ]);
    });

    it('does not build a project graph when no keys are executor-ambiguous', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: { cache: true },
        'e2e-ci--*': { cache: true },
      };
      updateNxJson(tree, nxJson);
      await convertTargetDefaultsToArray(tree);
      expect(createProjectGraphAsyncMock).not.toHaveBeenCalled();
    });

    // Regression: the migration runner invokes migrations as `fn(tree, {})`.
    // The migration must never treat a missing/empty graph as evidence that
    // a default is dead — every legacy entry has to survive the conversion.
    it('keeps every entry when the graph yields no matches', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: { dependsOn: ['^build', 'build-base'] },
        test: {
          options: { env: { NODE_OPTIONS: '--experimental-vm-modules' } },
        },
        lint: { cache: true },
        '@nx/esbuild:esbuild': { cache: true },
      };
      updateNxJson(tree, nxJson);
      createProjectGraphAsyncMock.mockResolvedValue({
        nodes: {},
        dependencies: {},
      });
      await convertTargetDefaultsToArray(tree);
      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'build', dependsOn: ['^build', 'build-base'] },
        {
          target: 'test',
          options: { env: { NODE_OPTIONS: '--experimental-vm-modules' } },
        },
        { target: 'lint', cache: true },
        { executor: '@nx/esbuild:esbuild', cache: true },
      ]);
    });

    it('reports a next step when the project graph cannot be built', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = { '@nx/vite:test': { cache: true } };
      updateNxJson(tree, nxJson);
      createProjectGraphAsyncMock.mockRejectedValue(new Error('graph boom'));
      const nextSteps = await convertTargetDefaultsToArray(tree);
      expect(nextSteps.join('\n')).toContain(
        'project graph could not be built'
      );
      // The entry still survives via the syntactic fallback.
      expect(readNxJson(tree).targetDefaults).toEqual([
        { executor: '@nx/vite:test', cache: true },
      ]);
    });
  });

  // The pure conversion + `:`-key disambiguation. Graphs are injected
  // directly, so no workspace or migration runner is involved.
  describe('convertTargetDefaultsRecordToArray', () => {
    it('preserves insertion order', () => {
      expect(
        convertTargetDefaultsRecordToArray({
          build: { cache: true, dependsOn: ['^build'] },
          test: { inputs: ['default', '^production'] },
        })
      ).toEqual([
        { target: 'build', cache: true, dependsOn: ['^build'] },
        { target: 'test', inputs: ['default', '^production'] },
      ]);
    });

    it('treats plain (non-":") keys as target names', () => {
      expect(
        convertTargetDefaultsRecordToArray({ 'build-base': { cache: true } })
      ).toEqual([{ target: 'build-base', cache: true }]);
    });

    it('keeps glob keys as `target` strings', () => {
      expect(
        convertTargetDefaultsRecordToArray({
          'e2e-ci--*': { dependsOn: ['build'] },
          'test:*': { cache: true },
        })
      ).toEqual([
        { target: 'e2e-ci--*', dependsOn: ['build'] },
        { target: 'test:*', cache: true },
      ]);
    });

    describe('with a project graph', () => {
      it('emits `target` when a `:` key is only used as a target name', () => {
        const graph = graphWithTargets({
          app: { 'foo:bar': { command: 'echo hi' } },
        });
        expect(
          convertTargetDefaultsRecordToArray(
            { 'foo:bar': { cache: true } },
            graph
          )
        ).toEqual([{ target: 'foo:bar', cache: true }]);
      });

      it('emits `executor` when a `:` key is only used as an executor', () => {
        const graph = graphWithTargets({
          app: { test: { executor: '@nx/vite:test' } },
        });
        expect(
          convertTargetDefaultsRecordToArray(
            { '@nx/vite:test': { inputs: ['default'] } },
            graph
          )
        ).toEqual([{ executor: '@nx/vite:test', inputs: ['default'] }]);
      });

      it('duplicates the entry when a `:` key matches both a target name and an executor', () => {
        const graph = graphWithTargets({
          app: { 'foo:bar': { command: 'echo hi' } },
          lib: { build: { executor: 'foo:bar' } },
        });
        expect(
          convertTargetDefaultsRecordToArray(
            { 'foo:bar': { cache: true } },
            graph
          )
        ).toEqual([
          { target: 'foo:bar', cache: true },
          { executor: 'foo:bar', cache: true },
        ]);
      });

      it('keeps the entry via the syntactic fallback when the graph has no match', () => {
        const graph = graphWithTargets({
          app: { build: { executor: '@nx/something-else:build' } },
        });
        expect(
          convertTargetDefaultsRecordToArray(
            {
              '@nx/unused:executor': { cache: true },
              unused: { inputs: ['default'] },
            },
            graph
          )
        ).toEqual([
          { executor: '@nx/unused:executor', cache: true },
          { target: 'unused', inputs: ['default'] },
        ]);
      });
    });

    describe('without a project graph', () => {
      it('falls back to the syntactic heuristic — `:` keys become executors', () => {
        expect(
          convertTargetDefaultsRecordToArray({
            '@nx/vite:test': { inputs: ['default'] },
            'nx:run-commands': { cache: true },
            build: { cache: true },
          })
        ).toEqual([
          { executor: '@nx/vite:test', inputs: ['default'] },
          { executor: 'nx:run-commands', cache: true },
          { target: 'build', cache: true },
        ]);
      });
    });
  });
});
