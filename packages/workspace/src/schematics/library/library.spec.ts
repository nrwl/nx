import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { NxJson } from '@nrwl/workspace';

import { runSchematic } from '../../utils/testing';
import { Schema } from './schema.d';

describe('lib', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeUndefined();
      expect(workspaceJson.projects['my-lib'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['libs/my-lib/**/*.ts'],
        },
      });
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson.projects).toEqual({
        'my-lib': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should update root tsconfig.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.json (no existing path mappings)', async () => {
      const updatedTree: any = updateJsonInTree(
        'tsconfig.base.json',
        (json) => {
          json.compilerOptions.paths = undefined;
          return json;
        }
      )(appTree, null);

      const tree = await runSchematic('lib', { name: 'myLib' }, updatedTree);
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toMatchInlineSnapshot(`
        Object {
          "extends": "../../tsconfig.base.json",
          "files": Array [],
          "include": Array [],
          "references": Array [
            Object {
              "path": "./tsconfig.lib.json",
            },
            Object {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(
        tree,
        'libs/my-lib/tsconfig.spec.json'
      );
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(
        tree,
        'libs/my-lib/tsconfig.lib.json'
      );
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should generate files', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib' } as Schema,
        appTree
      );

      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.readContent(`libs/my-lib/jest.config.js`))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
          globals: {
            'ts-jest': {
              tsConfig: '<rootDir>/tsconfig.spec.json',
            },
          },
          transform: {
            '^.+\\\\\\\\.[tj]sx?$': 'ts-jest',
          },
          moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          coverageDirectory: '../../coverage/libs/my-lib',
        };
        "
      `);
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/README.md')).toBeTruthy();

      const ReadmeContent = tree.readContent('libs/my-lib/README.md');
      expect(ReadmeContent).toContain('nx test my-lib');
    });
  });

  describe('nested', () => {
    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          directory: 'myDir',
          tags: 'one',
        },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson.projects).toEqual({
        'my-dir-my-lib': {
          tags: ['one'],
        },
      });

      const tree2 = await runSchematic(
        'lib',
        {
          name: 'myLib2',
          directory: 'myDir',
          tags: 'one,two',
          simpleModuleName: true,
        },
        tree
      );
      const nxJson2 = readJsonInTree<NxJson>(tree2, '/nx.json');
      expect(nxJson2.projects).toEqual({
        'my-dir-my-lib': {
          tags: ['one'],
        },
        'my-dir-my-lib2': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.ts')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists(`libs/my-dir/my-lib/.eslintrc.json`)).toBeTruthy();
    });

    it('should update workspace.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-lib'].root).toEqual(
        'libs/my-dir/my-lib'
      );
      expect(workspaceJson.projects['my-dir-my-lib'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['libs/my-dir/my-lib/**/*.ts'],
        },
      });
    });

    it('should update tsconfig.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');
      expect(
        tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']
      ).toEqual(['libs/my-dir/my-lib/src/index.ts']);
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );

      const tsconfigJson = readJsonInTree(
        tree,
        'libs/my-dir/my-lib/tsconfig.json'
      );
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
    });

    it('should create a local .eslintrc.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );

      const lint = readJsonInTree(tree, 'libs/my-dir/my-lib/.eslintrc.json');
      expect(lint.extends).toEqual('../../../.eslintrc.json');
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration nor spec file', async () => {
      const resultTree = await runSchematic(
        'lib',
        { name: 'myLib', unitTestRunner: 'none' },
        appTree
      );

      expect(resultTree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/jest.config.js')).toBeFalsy();
      expect(
        resultTree.exists('libs/my-lib/src/lib/my-lib.spec.ts')
      ).toBeFalsy();

      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
      expect(workspaceJson.projects['my-lib'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "libs/my-lib/**/*.ts",
            ],
          },
        }
      `);
    });
  });

  describe('--importPath', () => {
    it('should update the tsconfig with the given import path', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          directory: 'myDir',
          importPath: '@myorg/lib',
        },
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');

      expect(tsconfigJson.compilerOptions.paths['@myorg/lib']).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      const tree1 = await runSchematic(
        'lib',
        {
          name: 'myLib1',
          importPath: '@myorg/lib',
        },
        appTree
      );

      try {
        await runSchematic(
          'lib',
          {
            name: 'myLib2',
            importPath: '@myorg/lib',
          },
          tree1
        );
      } catch (e) {
        expect(e.message).toContain(
          'You already have a library using the import path'
        );
      }

      expect.assertions(1);
    });
  });

  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', js: true },
        appTree
      );
      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.js')).toBeTruthy();
    });

    it('should update tsconfig.json with compilerOptions.allowJs: true', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', js: true },
        appTree
      );
      expect(
        readJsonInTree(tree, 'libs/my-lib/tsconfig.json').compilerOptions
      ).toEqual({
        allowJs: true,
      });
    });

    it('should update tsconfig.lib.json include with **/*.js glob', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', js: true },
        appTree
      );
      expect(
        readJsonInTree(tree, 'libs/my-lib/tsconfig.lib.json').include
      ).toEqual(['**/*.ts', '**/*.js']);
    });

    it('should update root tsconfig.json with a js file path', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', js: true },
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.js',
      ]);
    });

    it('should generate js files for nested libs as well', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir', js: true },
        appTree
      );
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.js')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.js')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.js')
      ).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.js')).toBeTruthy();
    });
  });

  describe(`--babelJest`, () => {
    it('should use babel for jest', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', babelJest: true } as Schema,
        appTree
      );

      expect(tree.readContent(`libs/my-lib/jest.config.js`))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
          transform: {
            '^.+\\\\\\\\.[tj]sx?$': [
              'babel-jest',
              { cwd: __dirname, configFile: './babel-jest.config.json' },
            ],
          },
          moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          coverageDirectory: '../../coverage/libs/my-lib',
        };
        "
      `);

      expect(readJsonInTree(tree, 'libs/my-lib/babel-jest.config.json'))
        .toMatchInlineSnapshot(`
        Object {
          "presets": Array [
            Array [
              "@babel/preset-env",
              Object {
                "targets": Object {
                  "node": "current",
                },
              },
            ],
            "@babel/preset-typescript",
            "@babel/preset-react",
          ],
        }
      `);
    });
  });
  describe('--pascalCaseFiles', () => {
    it('should generate files with upper case names', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', pascalCaseFiles: true },
        appTree
      );
      expect(tree.exists('libs/my-lib/src/lib/MyLib.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/MyLib.spec.ts')).toBeTruthy();
    });

    it('should generate files with upper case names for nested libs as well', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir', pascalCaseFiles: true },
        appTree
      );
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/MyDirMyLib.ts')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/MyDirMyLib.spec.ts')
      ).toBeTruthy();
    });
  });
});
