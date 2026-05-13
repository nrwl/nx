import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import type { ProjectGraph } from '../../config/project-graph';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import convertTargetDefaultsToArray from './convert-target-defaults-to-array';

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
  let tree: Tree;
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

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
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

  it('converts record-shape to array preserving insertion order', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      build: { cache: true, dependsOn: ['^build'] },
      test: { inputs: ['default', '^production'] },
    };
    updateNxJson(tree, nxJson);
    const graph = graphWithTargets({
      app: { build: { command: 'echo build' }, test: { command: 'echo test' } },
    });
    await convertTargetDefaultsToArray(tree, graph);
    expect(readNxJson(tree).targetDefaults).toEqual([
      { target: 'build', cache: true, dependsOn: ['^build'] },
      { target: 'test', inputs: ['default', '^production'] },
    ]);
  });

  it('moves executor-style keys to `executor`, leaving `target` unset', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/vite:test': { inputs: ['default'] },
      'nx:run-commands': { cache: true },
    };
    updateNxJson(tree, nxJson);
    const graph = graphWithTargets({
      app: {
        test: { executor: '@nx/vite:test' },
        run: { executor: 'nx:run-commands' },
      },
    });
    await convertTargetDefaultsToArray(tree, graph);
    expect(readNxJson(tree).targetDefaults).toEqual([
      { executor: '@nx/vite:test', inputs: ['default'] },
      { executor: 'nx:run-commands', cache: true },
    ]);
  });

  it('keeps glob keys as `target` strings', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      'e2e-ci--*': { dependsOn: ['build'] },
      'test:*': { cache: true },
    };
    updateNxJson(tree, nxJson);
    await convertTargetDefaultsToArray(tree);
    expect(readNxJson(tree).targetDefaults).toEqual([
      { target: 'e2e-ci--*', dependsOn: ['build'] },
      { target: 'test:*', cache: true },
    ]);
  });

  describe('with project graph', () => {
    it('emits `target` when a `:` key is only used as a target name', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        'foo:bar': { cache: true },
      };
      updateNxJson(tree, nxJson);
      const graph = graphWithTargets({
        app: { 'foo:bar': { command: 'echo hi' } },
      });
      await convertTargetDefaultsToArray(tree, graph);
      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'foo:bar', cache: true },
      ]);
    });

    it('emits `executor` when a `:` key is only used as an executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vite:test': { inputs: ['default'] },
      };
      updateNxJson(tree, nxJson);
      const graph = graphWithTargets({
        app: { test: { executor: '@nx/vite:test' } },
      });
      await convertTargetDefaultsToArray(tree, graph);
      expect(readNxJson(tree).targetDefaults).toEqual([
        { executor: '@nx/vite:test', inputs: ['default'] },
      ]);
    });

    it('duplicates the entry when a `:` key matches both a target name and an executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        'foo:bar': { cache: true },
      };
      updateNxJson(tree, nxJson);
      const graph = graphWithTargets({
        app: { 'foo:bar': { command: 'echo hi' } },
        lib: { build: { executor: 'foo:bar' } },
      });
      await convertTargetDefaultsToArray(tree, graph);
      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'foo:bar', cache: true },
        { executor: 'foo:bar', cache: true },
      ]);
    });

    it('drops entries when no project matches the key', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/unused:executor': { cache: true },
        unused: { inputs: ['default'] },
      };
      updateNxJson(tree, nxJson);
      const graph = graphWithTargets({
        app: { build: { executor: '@nx/something-else:build' } },
      });
      await convertTargetDefaultsToArray(tree, graph);
      expect(readNxJson(tree).targetDefaults).toEqual([]);
    });
  });
});
