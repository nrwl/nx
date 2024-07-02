import {
  readJson,
  updateJson,
  writeJson,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { syncGenerator } from './sync';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
}));

describe('syncGenerator()', () => {
  let tree: Tree;

  function addProject(name: string, dependencies: string[] = []) {
    projectGraph.nodes[name] = {
      name,
      type: 'lib',
      data: { root: `packages/${name}` },
    };
    projectGraph.dependencies[name] = dependencies.map((dep) => ({
      type: 'static',
      source: name,
      target: dep,
    }));
    writeJson(tree, `packages/${name}/tsconfig.json`, {});
    writeJson(tree, `packages/${name}/tsconfig.lib.json`, {});
    writeJson(tree, `packages/${name}/package.json`, {
      name: name,
      version: '0.0.0',
      dependencies: dependencies.reduce(
        (acc, dep) => ({ ...acc, [dep]: '0.0.0' }),
        {}
      ),
    });
  }

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };

    writeJson(tree, 'nx.json', {
      // Wire up the @nx/js/typescript plugin with default options
      plugins: ['@nx/js/typescript'],
    });

    // Root tsconfigs
    writeJson(tree, 'tsconfig.json', {});
    writeJson(tree, 'tsconfig.options.json', { compilerOptions: {} });

    // b => a
    addProject('a');
    addProject('b', ['a']);
  });

  it('should error if the @nx/js/typescript plugin is not configured in nx.json', async () => {
    const nxJson = readJson(tree, 'nx.json');
    nxJson.plugins = nxJson.plugins.filter((p) => p !== '@nx/js/typescript');
    writeJson(tree, 'nx.json', nxJson);

    await expect(syncGenerator(tree, {})).rejects.toMatchInlineSnapshot(
      `[Error: The @nx/js/typescript plugin must be added to the "plugins" array in nx.json before syncing tsconfigs]`
    );
  });

  it('should error if there is no root tsconfig.json', async () => {
    tree.delete('tsconfig.json');

    await expect(syncGenerator(tree, {})).rejects.toMatchInlineSnapshot(
      `[Error: A "tsconfig.json" file must exist in the workspace root.]`
    );
  });

  describe('root tsconfig.json', () => {
    it('should sync project references to the root tsconfig.json', async () => {
      expect(readJson(tree, 'tsconfig.json').references).toBeUndefined();

      await syncGenerator(tree, {});

      const rootTsconfig = readJson(tree, 'tsconfig.json');
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "./packages/a",
          },
          {
            "path": "./packages/b",
          },
        ]
      `);
    });

    it('should respect existing project references in the root tsconfig.json', async () => {
      writeJson(tree, 'tsconfig.json', {
        // Swapped order and additional manual reference
        references: [
          { path: './packages/b' },
          { path: 'packages/a' },
          { path: 'packages/c' },
        ],
      });
      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./packages/b",
          },
          {
            "path": "packages/a",
          },
          {
            "path": "packages/c",
          },
        ]
      `);

      await syncGenerator(tree, {});

      const rootTsconfig = readJson(tree, 'tsconfig.json');
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "./packages/b",
          },
          {
            "path": "packages/a",
          },
          {
            "path": "packages/c",
          },
        ]
      `);
    });
  });

  describe('project level tsconfig.json', () => {
    it('should sync project references to project level tsconfig.json files where needed', async () => {
      expect(
        readJson(tree, 'packages/b/tsconfig.json').references
      ).toBeUndefined();

      await syncGenerator(tree, {});

      expect(readJson(tree, 'packages/b/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
    });

    it('should respect existing project references in the project level tsconfig.json', async () => {
      writeJson(tree, 'packages/b/tsconfig.json', {
        // Swapped order and additional manual reference
        references: [{ path: '../some/thing' }, { path: '../../another/one' }],
      });
      expect(readJson(tree, 'packages/b/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../some/thing",
          },
          {
            "path": "../../another/one",
          },
        ]
      `);

      await syncGenerator(tree, {});

      const rootTsconfig = readJson(tree, 'packages/b/tsconfig.json');
      // The dependency reference on "a" is added to the start of the array
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../some/thing",
          },
          {
            "path": "../../another/one",
          },
        ]
      `);
    });

    it('should sync project references to project level tsconfig.lib.json files when build target configured', async () => {
      const nxJson = readJson(tree, 'nx.json');
      nxJson.plugins = nxJson.plugins.filter((p) => p !== '@nx/js/typescript');
      nxJson.plugins.push({
        plugin: '@nx/js/typescript',
        options: { build: { configName: 'tsconfig.lib.json' } },
      });
      writeJson(tree, 'nx.json', nxJson);

      await syncGenerator(tree, {});

      expect(readJson(tree, 'packages/b/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
      expect(readJson(tree, 'packages/b/tsconfig.lib.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a/tsconfig.lib.json",
          },
        ]
      `);
    });

    it('should collect transitive dependencies and sync project references to project level tsconfig.json files', async () => {
      // c => b => a
      // d => b => a
      //   => a
      // e => d => b => a
      addProject('c', ['b']);
      addProject('d', ['b', 'a']);
      addProject('e', ['d']);

      await syncGenerator(tree, {});

      expect(
        readJson(tree, 'packages/a/tsconfig.json').references
      ).toBeUndefined();
      expect(readJson(tree, 'packages/b/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
      expect(readJson(tree, 'packages/c/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../b",
          },
        ]
      `);
      expect(readJson(tree, 'packages/d/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../b",
          },
        ]
      `);
      expect(readJson(tree, 'packages/e/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../b",
          },
          {
            "path": "../d",
          },
        ]
      `);
    });

    it('should collect transitive dependencies and sync project references to project level tsconfig.lib.json files', async () => {
      const nxJson = readJson(tree, 'nx.json');
      nxJson.plugins = nxJson.plugins.filter((p) => p !== '@nx/js/typescript');
      nxJson.plugins.push({
        plugin: '@nx/js/typescript',
        options: { build: { configName: 'tsconfig.lib.json' } },
      });
      writeJson(tree, 'nx.json', nxJson);
      // c => b => a
      // d => b => a
      //   => a
      // e => d => b => a
      addProject('c', ['b']);
      addProject('d', ['b', 'a']);
      addProject('e', ['d']);

      await syncGenerator(tree, {});

      expect(
        readJson(tree, 'packages/a/tsconfig.json').references
      ).toBeUndefined();
      expect(
        readJson(tree, 'packages/a/tsconfig.lib.json').references
      ).toBeUndefined();
      expect(readJson(tree, 'packages/b/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
      expect(readJson(tree, 'packages/b/tsconfig.lib.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a/tsconfig.lib.json",
          },
        ]
      `);
      expect(readJson(tree, 'packages/c/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../b",
          },
        ]
      `);
      expect(readJson(tree, 'packages/c/tsconfig.lib.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a/tsconfig.lib.json",
          },
          {
            "path": "../b/tsconfig.lib.json",
          },
        ]
      `);
      expect(readJson(tree, 'packages/d/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../b",
          },
        ]
      `);
      expect(readJson(tree, 'packages/d/tsconfig.lib.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a/tsconfig.lib.json",
          },
          {
            "path": "../b/tsconfig.lib.json",
          },
        ]
      `);
      expect(readJson(tree, 'packages/e/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "../b",
          },
          {
            "path": "../d",
          },
        ]
      `);
      expect(readJson(tree, 'packages/e/tsconfig.lib.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a/tsconfig.lib.json",
          },
          {
            "path": "../b/tsconfig.lib.json",
          },
          {
            "path": "../d/tsconfig.lib.json",
          },
        ]
      `);
    });

    it('should make no changes when the references are set regardless their order', async () => {
      // c => b => a
      // d => b => a
      //   => a
      // e => d => b => a
      addProject('c', ['b']);
      addProject('d', ['b', 'a']);
      addProject('e', ['d']);
      // set all expected references but in a different order
      updateJson(tree, 'tsconfig.json', (json) => ({
        ...json,
        references: [
          { path: './packages/c' },
          { path: './packages/a' },
          { path: './packages/b' },
          { path: './packages/e' },
          { path: './packages/d' },
        ],
      }));
      updateJson(tree, 'packages/b/tsconfig.json', (json) => ({
        ...json,
        references: [{ path: '../a' }],
      }));
      updateJson(tree, 'packages/c/tsconfig.json', (json) => ({
        ...json,
        references: [{ path: '../b' }, { path: '../a' }],
      }));
      updateJson(tree, 'packages/d/tsconfig.json', (json) => ({
        ...json,
        references: [{ path: '../b' }, { path: '../a' }],
      }));
      updateJson(tree, 'packages/e/tsconfig.json', (json) => ({
        ...json,
        references: [{ path: '../b' }, { path: '../d' }, { path: '../a' }],
      }));
      const currentChanges = tree.listChanges();

      await syncGenerator(tree, {});

      expect(tree.listChanges()).toEqual(currentChanges);
    });
  });
});
