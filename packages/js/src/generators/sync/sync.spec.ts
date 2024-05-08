import { ProjectGraph, Tree, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { syncGenerator } from './sync';

let projectGraph: ProjectGraph;

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
}));

describe('syncGenerator()', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {
        a: {
          name: 'a',
          type: 'lib',
          data: {
            root: 'packages/a',
          },
        },
        b: {
          name: 'b',
          type: 'lib',
          data: {
            root: 'packages/b',
          },
        },
      },
      dependencies: {
        a: [],
        b: [
          {
            type: 'static',
            source: 'b',
            target: 'a',
          },
        ],
      },
    };

    writeJson(tree, 'nx.json', {
      // Wire up the @nx/js/typescript plugin with default options
      plugins: ['@nx/js/typescript'],
    });

    // Root tsconfigs
    writeJson(tree, 'tsconfig.json', {});
    writeJson(tree, 'tsconfig.options.json', { compilerOptions: {} });

    // Package A
    writeJson(tree, 'packages/a/tsconfig.json', {});
    writeJson(tree, 'packages/a/tsconfig.lib.json', {
      compilerOptions: {
        outDir: '../../dist/packages/a/dist',
      },
    });
    writeJson(tree, 'packages/a/package.json', {
      name: 'a',
      version: '0.0.0',
    });

    // Package B (depends on A)
    writeJson(tree, 'packages/b/tsconfig.json', {});
    writeJson(tree, 'packages/b/tsconfig.lib.json', {});
    writeJson(tree, 'packages/b/package.json', {
      name: 'b',
      version: '0.0.0',
      dependencies: {
        a: '0.0.0',
      },
    });
  });

  it('should error if the @nx/js/typescript plugin is not configured in nx.json', async () => {
    const nxJson = readJson(tree, 'nx.json');
    nxJson.plugins = nxJson.plugins.filter((p) => p !== '@nx/js/typescript');
    writeJson(tree, 'nx.json', nxJson);

    await expect(syncGenerator(tree, {})).rejects.toMatchInlineSnapshot(
      `[Error: The @nx/js/typescript plugin must be added to the "plugins" array in nx.json before syncing tsconfigs]`
    );
  });

  describe('root tsconfig.json', () => {
    it('should sync project references to the root tsconfig.json', async () => {
      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(
        `undefined`
      );

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
      ).toMatchInlineSnapshot(`undefined`);

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
  });
});
