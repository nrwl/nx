import {
  readJson,
  readNxJson,
  updateJson,
  updateNxJson,
  writeJson,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { syncGenerator } from './typescript-sync';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
}));

describe('syncGenerator()', () => {
  let tree: Tree;

  function addProject(
    name: string,
    dependencies: string[] = [],
    extraRuntimeTsConfigs: string[] = [],
    root: string = `packages/${name}`
  ) {
    projectGraph.nodes[name] = {
      name,
      type: 'lib',
      data: { root },
    };
    projectGraph.dependencies[name] = dependencies.map((dep) => ({
      type: 'static',
      source: name,
      target: dep,
    }));
    writeJson(tree, `${root}/tsconfig.json`, {
      compilerOptions: {
        composite: true,
      },
    });
    for (const runtimeTsConfigFileName of extraRuntimeTsConfigs) {
      writeJson(tree, `${root}/${runtimeTsConfigFileName}`, {
        compilerOptions: {
          composite: true,
        },
      });
    }
    writeJson(tree, `${root}/package.json`, {
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
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        composite: true,
      },
    });
    writeJson(tree, 'tsconfig.options.json', {
      compilerOptions: {
        composite: true,
      },
    });

    // b => a
    addProject('a');
    addProject('b', ['a']);
  });

  it('should error if the @nx/js/typescript plugin is not configured in nx.json', async () => {
    const nxJson = readJson(tree, 'nx.json');
    nxJson.plugins = nxJson.plugins.filter((p) => p !== '@nx/js/typescript');
    writeJson(tree, 'nx.json', nxJson);

    await expect(syncGenerator(tree)).rejects.toMatchInlineSnapshot(
      `[Error: The @nx/js/typescript plugin must be added to the "plugins" array in nx.json before syncing tsconfigs]`
    );
  });

  it('should error if there is no root tsconfig.json', async () => {
    tree.delete('tsconfig.json');

    await expect(syncGenerator(tree)).rejects.toMatchInlineSnapshot(
      `[Error: A "tsconfig.json" file must exist in the workspace root in order to use this sync generator.]`
    );
  });

  it('should not make changes when references are set regardless their order and/or there are unformatted files', async () => {
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
    writeJson(tree, 'packages/a/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
    });
    // unformatted tsconfig.json to test that it doesn't get picked up as a change
    tree.write(
      'packages/b/tsconfig.json',
      `{
      "compilerOptions": {
        "composite": true,
      },
            "references": [     { "path": "../a" }
]}`
    );
    // unformatted tsconfig.lib.json to test that it doesn't get picked up as a change
    tree.write(
      'packages/b/tsconfig.lib.json',
      `{
      "compilerOptions": {
        "composite": true,
      },
            "references": [     { "path": "../a/tsconfig.lib.json" }
]}`
    );
    updateJson(tree, 'packages/c/tsconfig.json', (json) => ({
      ...json,
      references: [{ path: '../b' }, { path: '../a' }],
    }));
    writeJson(tree, 'packages/c/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [
        { path: '../b/tsconfig.lib.json' },
        { path: '../a/tsconfig.lib.json' },
      ],
    });
    updateJson(tree, 'packages/d/tsconfig.json', (json) => ({
      ...json,
      references: [{ path: '../b' }, { path: '../a' }],
    }));
    writeJson(tree, 'packages/d/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [
        { path: '../b/tsconfig.lib.json' },
        { path: '../a/tsconfig.lib.json' },
      ],
    });
    updateJson(tree, 'packages/e/tsconfig.json', (json) => ({
      ...json,
      references: [{ path: '../b' }, { path: '../d' }, { path: '../a' }],
    }));
    writeJson(tree, 'packages/e/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [
        { path: '../b/tsconfig.lib.json' },
        { path: '../d/tsconfig.lib.json' },
        { path: '../a/tsconfig.lib.json' },
      ],
    });
    const changesBeforeSyncing = tree
      .listChanges()
      .map((c) => [c.path, c.type, c.content.toString('utf-8')]);

    await syncGenerator(tree);

    expect(
      tree
        .listChanges()
        .map((c) => [c.path, c.type, c.content.toString('utf-8')])
    ).toStrictEqual(changesBeforeSyncing);
  });

  describe('root tsconfig.json', () => {
    it('should sync project references to the tsconfig.json', async () => {
      expect(readJson(tree, 'tsconfig.json').references).toBeUndefined();

      await syncGenerator(tree);

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

    it('should respect existing project references and discard non-existing ones in the tsconfig.json', async () => {
      writeJson(tree, 'tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
        // Swapped order and additional manual reference
        references: [
          { path: './packages/b' },
          { path: './packages/a' },
          { path: './packages/c' }, // existing extra reference to a tsconfig.json file in a non-project directory
          { path: './packages/d' }, // non-existing reference
        ],
      });
      writeJson(tree, 'packages/c/tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
      });

      await syncGenerator(tree);

      const rootTsconfig = readJson(tree, 'tsconfig.json');
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "./packages/b",
          },
          {
            "path": "./packages/a",
          },
          {
            "path": "./packages/c",
          },
        ]
      `);
    });

    it('should leave comments outside of references untouched in the tsconfig.json when patching', async () => {
      tree.write(
        'tsconfig.json',
        `{
  // This is a top level comment
  "compilerOptions": {
    "composite": true,
    // This is a nested comment
    "target": "es5"
  }
}
`
      );

      await syncGenerator(tree);

      expect(tree.read('tsconfig.json').toString('utf-8'))
        .toMatchInlineSnapshot(`
        "{
          // This is a top level comment
          "compilerOptions": {
            "composite": true,
            // This is a nested comment
            "target": "es5"
          },
          "references": [{ "path": "./packages/a" }, { "path": "./packages/b" }]
        }
        "
      `);
    });

    it('should not add a reference if the internally referenced tsconfig.json does not have composite: true', async () => {
      // Delete composite from a, causing it to not show up in the final tsconfig.json snapshot
      writeJson(tree, 'packages/a/tsconfig.json', {
        compilerOptions: {},
      });

      await syncGenerator(tree);

      expect(tree.read('tsconfig.json').toString('utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "compilerOptions": {
            "composite": true
          },
          "references": [{ "path": "./packages/b" }]
        }
        "
      `);
    });
  });

  describe('project level tsconfig.json', () => {
    it('should sync project references to tsconfig.json files where needed', async () => {
      expect(
        readJson(tree, 'packages/b/tsconfig.json').references
      ).toBeUndefined();

      await syncGenerator(tree);

      expect(readJson(tree, 'packages/b/tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
    });

    it('should respect existing internal project references in the tsconfig.json', async () => {
      writeJson(tree, 'packages/b/tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
        // Swapped order and additional manual reference
        references: [
          { path: './some/thing' },
          { path: './another/one' },
          { path: './nested/project1' }, // external nested project reference that's not a dependency
        ],
      });
      addProject('project1', [], [], 'packages/b/nested/project1');

      await syncGenerator(tree);

      const rootTsconfig = readJson(tree, 'packages/b/tsconfig.json');
      // The dependency reference on "a" is added to the start of the array
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "./some/thing",
          },
          {
            "path": "./another/one",
          },
        ]
      `);
    });

    it('should prune existing external project references that are no longer dependencies', async () => {
      writeJson(tree, 'packages/b/tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
        references: [
          { path: './some/thing' },
          { path: './another/one' },
          { path: '../c' }, // this is not a dependency, should be pruned
        ],
      });

      await syncGenerator(tree);

      const rootTsconfig = readJson(tree, 'packages/b/tsconfig.json');
      // The dependency reference on "a" is added to the start of the array
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "./some/thing",
          },
          {
            "path": "./another/one",
          },
        ]
      `);
    });

    it('should not prune existing external project references that are not dependencies but are ignored', async () => {
      writeJson(tree, 'packages/b/tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
        references: [
          { path: './some/thing' },
          { path: './another/one' },
          { path: '../../some-path/dir' }, // this is not a dependency but it's ignored, should not be pruned
          { path: '../c' }, // this is not a dependency and it's not ignored, should be pruned
        ],
      });
      tree.write('some-path/dir/tsconfig.json', '{}');
      tree.write('.gitignore', 'some-path/dir');

      await syncGenerator(tree);

      const rootTsconfig = readJson(tree, 'packages/b/tsconfig.json');
      // The dependency reference on "a" is added to the start of the array
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "./some/thing",
          },
          {
            "path": "./another/one",
          },
          {
            "path": "../../some-path/dir",
          },
        ]
      `);
    });

    it('should not prune stale project references from projects included in `nx.sync.ignoredReferences`', async () => {
      const nxJson = readNxJson(tree);
      nxJson.sync = {
        generatorOptions: {
          '@nx/js:typescript-sync': {
            projectsToKeepStaleReferences: ['b'],
          },
        },
      };
      updateNxJson(tree, nxJson);
      writeJson(tree, 'packages/b/tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
        references: [
          { path: './some/thing' },
          { path: './another/one' },
          // this is not a dependency and it's not ignored, it would normally be pruned,
          // but it's included in `nx.sync.ignoredReferences`, so we don't prune it
          { path: '../c' },
        ],
        nx: {
          sync: {
            ignoredReferences: ['../c'],
          },
        },
      });
      tree.write('some-path/dir/tsconfig.json', '{}');
      tree.write('.gitignore', 'some-path/dir');

      await syncGenerator(tree);

      const rootTsconfig = readJson(tree, 'packages/b/tsconfig.json');
      // The dependency reference on "a" is added to the start of the array
      expect(rootTsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
          {
            "path": "./some/thing",
          },
          {
            "path": "./another/one",
          },
          {
            "path": "../c",
          },
        ]
      `);
    });

    it('should collect transitive dependencies and sync project references to tsconfig.json files', async () => {
      // c => b => a
      // d => b => a
      //   => a
      // e => d => b => a
      addProject('c', ['b']);
      addProject('d', ['b', 'a']);
      addProject('e', ['d']);

      await syncGenerator(tree);

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

    it('should leave comments outside of references untouched in the tsconfig.json when patching', async () => {
      addProject('foo', ['bar'], ['tsconfig.build.json']);
      addProject('bar', [], ['tsconfig.build.json']);

      tree.write(
        'packages/foo/tsconfig.build.json',
        `{
  // This is a top level comment
  "compilerOptions": {
    "composite": true,
    // This is a nested comment
    "target": "es5",
  },
  "references": []
}
      `
      );

      await syncGenerator(tree);

      expect(tree.read('packages/foo/tsconfig.build.json').toString('utf-8'))
        .toMatchInlineSnapshot(`
        "{
          // This is a top level comment
          "compilerOptions": {
            "composite": true,
            // This is a nested comment
            "target": "es5"
          },
          "references": [{ "path": "../bar/tsconfig.build.json" }]
        }
        "
      `);
    });

    it('should not add a reference if the dependency tsconfig.json does not have composite: true', async () => {
      addProject('foo', ['bar'], ['tsconfig.build.json']);
      addProject('bar', [], ['tsconfig.build.json']);

      // Delete composite from bar, causing it to not show up in the final tsconfig.json snapshots below
      writeJson(tree, 'packages/bar/tsconfig.json', {
        compilerOptions: {},
      });

      await syncGenerator(tree);

      expect(tree.read('tsconfig.json').toString('utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "compilerOptions": {
            "composite": true
          },
          "references": [
            { "path": "./packages/a" },
            { "path": "./packages/b" },
            { "path": "./packages/foo" }
          ]
        }
        "
      `);

      expect(tree.read('packages/foo/tsconfig.json').toString('utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "compilerOptions": {
            "composite": true
          }
        }
        "
      `);
    });

    describe('without custom sync generator options', () => {
      it.each`
        runtimeTsConfigFileName
        ${'tsconfig.app.json'}
        ${'tsconfig.lib.json'}
        ${'tsconfig.build.json'}
        ${'tsconfig.cjs.json'}
        ${'tsconfig.esm.json'}
        ${'tsconfig.runtime.json'}
      `(
        'should sync project references to $runtimeTsConfigFileName files',
        async ({ runtimeTsConfigFileName }) => {
          writeJson(tree, `packages/a/${runtimeTsConfigFileName}`, {
            compilerOptions: {
              composite: true,
            },
          });
          writeJson(tree, `packages/b/${runtimeTsConfigFileName}`, {
            compilerOptions: {
              composite: true,
            },
          });

          await syncGenerator(tree);

          expect(readJson(tree, 'packages/b/tsconfig.json').references)
            .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
          expect(
            readJson(tree, `packages/b/${runtimeTsConfigFileName}`).references
          ).toMatchInlineSnapshot(`
        [
          {
            "path": "../a/${runtimeTsConfigFileName}",
          },
        ]
      `);
        }
      );

      it('should sync project references to multiple runtime tsconfig files', async () => {
        writeJson(tree, 'packages/a/tsconfig.lib.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.cjs.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.esm.json', {
          compilerOptions: {
            composite: true,
          },
        });

        await syncGenerator(tree);

        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.cjs.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.esm.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
          ]
        `);
      });

      it('should sync project references to different runtime tsconfig files', async () => {
        writeJson(tree, 'packages/a/tsconfig.lib.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.build.json', {
          compilerOptions: {
            composite: true,
          },
        });
        addProject('c', ['b'], ['tsconfig.cjs.json', 'tsconfig.esm.json']);
        addProject('d', ['b', 'a'], ['tsconfig.runtime.json']);
        addProject('e', ['c'], ['tsconfig.cjs.json', 'tsconfig.esm.json']);
        addProject('f', ['c'], ['tsconfig.runtime.json']);

        await syncGenerator(tree);

        // b
        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.build.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
          ]
        `);
        // c
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
        expect(readJson(tree, 'packages/c/tsconfig.cjs.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
            {
              "path": "../b/tsconfig.build.json",
            },
          ]
        `);
        expect(readJson(tree, 'packages/c/tsconfig.esm.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
            {
              "path": "../b/tsconfig.build.json",
            },
          ]
        `);
        // d
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
        expect(readJson(tree, 'packages/d/tsconfig.runtime.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
            {
              "path": "../b/tsconfig.build.json",
            },
          ]
        `);
        // e
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
              "path": "../c",
            },
          ]
        `);
        expect(readJson(tree, 'packages/e/tsconfig.cjs.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
            {
              "path": "../b/tsconfig.build.json",
            },
            {
              "path": "../c/tsconfig.cjs.json",
            },
          ]
        `);
        expect(readJson(tree, 'packages/e/tsconfig.esm.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
            {
              "path": "../b/tsconfig.build.json",
            },
            {
              "path": "../c/tsconfig.esm.json",
            },
          ]
        `);
        // f
        expect(readJson(tree, 'packages/f/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
            {
              "path": "../b",
            },
            {
              "path": "../c",
            },
          ]
        `);
        // in the case of "c", it will reference the first runtime tsconfig file it finds because there's no `packages/c/tsconfig.runtime.json`
        expect(readJson(tree, 'packages/f/tsconfig.runtime.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.lib.json",
            },
            {
              "path": "../b/tsconfig.build.json",
            },
            {
              "path": "../c/tsconfig.cjs.json",
            },
          ]
        `);
      });

      it.each`
        runtimeTsConfigFileName
        ${'tsconfig.app.json'}
        ${'tsconfig.lib.json'}
        ${'tsconfig.build.json'}
        ${'tsconfig.cjs.json'}
        ${'tsconfig.esm.json'}
        ${'tsconfig.runtime.json'}
      `(
        'should collect transitive dependencies and sync project references to $runtimeTsConfigFileName files',
        async ({ runtimeTsConfigFileName }) => {
          writeJson(tree, `packages/a/${runtimeTsConfigFileName}`, {
            compilerOptions: {
              composite: true,
            },
          });
          writeJson(tree, `packages/b/${runtimeTsConfigFileName}`, {
            compilerOptions: {
              composite: true,
            },
          });
          // c => b => a
          // d => b => a
          //   => a
          // e => d => b => a
          addProject('c', ['b'], [runtimeTsConfigFileName]);
          addProject('d', ['b', 'a'], [runtimeTsConfigFileName]);
          addProject('e', ['d'], [runtimeTsConfigFileName]);

          await syncGenerator(tree);

          expect(
            readJson(tree, 'packages/a/tsconfig.json').references
          ).toBeUndefined();
          expect(
            readJson(tree, `packages/a/${runtimeTsConfigFileName}`).references
          ).toBeUndefined();
          expect(readJson(tree, 'packages/b/tsconfig.json').references)
            .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
          expect(
            readJson(tree, `packages/b/${runtimeTsConfigFileName}`).references
          ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/${runtimeTsConfigFileName}",
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
          expect(
            readJson(tree, `packages/c/${runtimeTsConfigFileName}`).references
          ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/${runtimeTsConfigFileName}",
            },
            {
              "path": "../b/${runtimeTsConfigFileName}",
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
          expect(
            readJson(tree, `packages/d/${runtimeTsConfigFileName}`).references
          ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/${runtimeTsConfigFileName}",
            },
            {
              "path": "../b/${runtimeTsConfigFileName}",
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
          expect(
            readJson(tree, `packages/e/${runtimeTsConfigFileName}`).references
          ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/${runtimeTsConfigFileName}",
            },
            {
              "path": "../b/${runtimeTsConfigFileName}",
            },
            {
              "path": "../d/${runtimeTsConfigFileName}",
            },
          ]
        `);
        }
      );

      it('should not make changes to non-default runtime tsconfig files', async () => {
        writeJson(tree, 'packages/a/tsconfig.lib.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/a/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/a/tsconfig.spec.json', {
          compilerOptions: {
            composite: true,
          },
        });
        // default runtime tsconfig that should be updated
        writeJson(tree, 'packages/b/tsconfig.lib.json', {
          compilerOptions: {
            composite: true,
          },
        });
        // non-default runtime tsconfig files that should not be updated
        writeJson(tree, 'packages/b/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.spec.json', {
          compilerOptions: {
            composite: true,
          },
        });

        await syncGenerator(tree);

        // assert that tsconfig.json and tsconfig.lib.json files have been updated
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
        // assert that tsconfig.lib.json and tsconfig.spec.json files have not been updated
        expect(readJson(tree, 'packages/b/tsconfig.custom.json')).toStrictEqual(
          {
            compilerOptions: {
              composite: true,
            },
          }
        );
        expect(readJson(tree, 'packages/b/tsconfig.spec.json')).toStrictEqual({
          compilerOptions: {
            composite: true,
          },
        });
      });
    });

    describe('with custom sync generator options', () => {
      it('should sync project references to configured tsconfig.custom.json files', async () => {
        const nxJson = readNxJson(tree);
        nxJson.sync = {
          generatorOptions: {
            '@nx/js:typescript-sync': {
              runtimeTsConfigFileNames: ['tsconfig.custom.json'],
            },
          },
        };
        updateNxJson(tree, nxJson);
        writeJson(tree, 'packages/a/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });

        await syncGenerator(tree);

        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
        [
          {
            "path": "../a",
          },
        ]
      `);
        expect(readJson(tree, 'packages/b/tsconfig.custom.json').references)
          .toMatchInlineSnapshot(`
        [
          {
            "path": "../a/tsconfig.custom.json",
          },
        ]
      `);
      });

      it('should sync project references to multiple configured runtime tsconfig files', async () => {
        const nxJson = readNxJson(tree);
        nxJson.sync = {
          generatorOptions: {
            '@nx/js:typescript-sync': {
              runtimeTsConfigFileNames: [
                'tsconfig.custom.json',
                'tsconfig.custom-cjs.json',
                'tsconfig.custom-esm.json',
              ],
            },
          },
        };
        updateNxJson(tree, nxJson);
        writeJson(tree, 'packages/a/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.custom-cjs.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.custom-esm.json', {
          compilerOptions: {
            composite: true,
          },
        });

        await syncGenerator(tree);

        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.custom-cjs.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.custom-esm.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
          ]
        `);
      });

      it('should sync project references to different configured runtime tsconfig files', async () => {
        const nxJson = readNxJson(tree);
        nxJson.sync = {
          generatorOptions: {
            '@nx/js:typescript-sync': {
              runtimeTsConfigFileNames: [
                'tsconfig.custom.json',
                'tsconfig.custom-build.json',
                'tsconfig.custom-cjs.json',
                'tsconfig.custom-esm.json',
                'tsconfig.custom-runtime.json',
              ],
            },
          },
        };
        updateNxJson(tree, nxJson);
        writeJson(tree, 'packages/a/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.custom-build.json', {
          compilerOptions: {
            composite: true,
          },
        });
        addProject(
          'c',
          ['b'],
          ['tsconfig.custom-cjs.json', 'tsconfig.custom-esm.json']
        );
        addProject('d', ['b', 'a'], ['tsconfig.custom-runtime.json']);
        addProject(
          'e',
          ['c'],
          ['tsconfig.custom-cjs.json', 'tsconfig.custom-esm.json']
        );
        addProject('f', ['c'], ['tsconfig.custom-runtime.json']);

        await syncGenerator(tree);

        // b
        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
        expect(
          readJson(tree, 'packages/b/tsconfig.custom-build.json').references
        ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
          ]
        `);
        // c
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
        expect(readJson(tree, 'packages/c/tsconfig.custom-cjs.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom-build.json",
            },
          ]
        `);
        expect(readJson(tree, 'packages/c/tsconfig.custom-esm.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom-build.json",
            },
          ]
        `);
        // d
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
        expect(
          readJson(tree, 'packages/d/tsconfig.custom-runtime.json').references
        ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom-build.json",
            },
          ]
        `);
        // e
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
              "path": "../c",
            },
          ]
        `);
        expect(readJson(tree, 'packages/e/tsconfig.custom-cjs.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom-build.json",
            },
            {
              "path": "../c/tsconfig.custom-cjs.json",
            },
          ]
        `);
        expect(readJson(tree, 'packages/e/tsconfig.custom-esm.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom-build.json",
            },
            {
              "path": "../c/tsconfig.custom-esm.json",
            },
          ]
        `);
        // f
        expect(readJson(tree, 'packages/f/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
            {
              "path": "../b",
            },
            {
              "path": "../c",
            },
          ]
        `);
        // in the case of "c", it will reference the first runtime tsconfig file it finds because there's no `packages/c/tsconfig.runtime.json`
        expect(
          readJson(tree, 'packages/f/tsconfig.custom-runtime.json').references
        ).toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom-build.json",
            },
            {
              "path": "../c/tsconfig.custom-cjs.json",
            },
          ]
        `);
      });

      it('should collect transitive dependencies and sync project references to configured tsconfig.custom.json files', async () => {
        const nxJson = readNxJson(tree);
        nxJson.sync = {
          generatorOptions: {
            '@nx/js:typescript-sync': {
              runtimeTsConfigFileNames: ['tsconfig.custom.json'],
            },
          },
        };
        updateNxJson(tree, nxJson);
        writeJson(tree, 'packages/a/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        // c => b => a
        // d => b => a
        //   => a
        // e => d => b => a
        addProject('c', ['b'], ['tsconfig.custom.json']);
        addProject('d', ['b', 'a'], ['tsconfig.custom.json']);
        addProject('e', ['d'], ['tsconfig.custom.json']);

        await syncGenerator(tree);

        expect(
          readJson(tree, 'packages/a/tsconfig.json').references
        ).toBeUndefined();
        expect(
          readJson(tree, 'packages/a/tsconfig.custom.json').references
        ).toBeUndefined();
        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.custom.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
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
        expect(readJson(tree, 'packages/c/tsconfig.custom.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom.json",
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
        expect(readJson(tree, 'packages/d/tsconfig.custom.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom.json",
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
        expect(readJson(tree, 'packages/e/tsconfig.custom.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
            {
              "path": "../b/tsconfig.custom.json",
            },
            {
              "path": "../d/tsconfig.custom.json",
            },
          ]
        `);
      });

      it('should not make changes to tsconfig files not configured as runtime', async () => {
        const nxJson = readNxJson(tree);
        nxJson.sync = {
          generatorOptions: {
            '@nx/js:typescript-sync': {
              runtimeTsConfigFileNames: ['tsconfig.custom.json'],
            },
          },
        };
        updateNxJson(tree, nxJson);
        writeJson(tree, 'packages/a/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/a/tsconfig.lib.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/a/tsconfig.spec.json', {
          compilerOptions: {
            composite: true,
          },
        });
        // non-default runtime tsconfig that should be updated because is in the configured list
        writeJson(tree, 'packages/b/tsconfig.custom.json', {
          compilerOptions: {
            composite: true,
          },
        });
        // default runtime tsconfig that shouldn't be updated because is not in the configured list
        writeJson(tree, 'packages/b/tsconfig.lib.json', {
          compilerOptions: {
            composite: true,
          },
        });
        writeJson(tree, 'packages/b/tsconfig.spec.json', {
          compilerOptions: {
            composite: true,
          },
        });

        await syncGenerator(tree);

        // assert that tsconfig.json and tsconfig.custom.json files have been updated
        expect(readJson(tree, 'packages/b/tsconfig.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a",
            },
          ]
        `);
        expect(readJson(tree, 'packages/b/tsconfig.custom.json').references)
          .toMatchInlineSnapshot(`
          [
            {
              "path": "../a/tsconfig.custom.json",
            },
          ]
        `);
        // assert that tsconfig.lib.json and tsconfig.spec.json files have not been updated
        expect(readJson(tree, 'packages/b/tsconfig.lib.json')).toStrictEqual({
          compilerOptions: {
            composite: true,
          },
        });
        expect(readJson(tree, 'packages/b/tsconfig.spec.json')).toStrictEqual({
          compilerOptions: {
            composite: true,
          },
        });
      });
    });
  });
});
