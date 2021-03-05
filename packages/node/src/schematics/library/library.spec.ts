import { Tree } from '@angular-devkit/schematics';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
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
      expect(workspaceJson.projects['my-lib'].architect.test).toEqual({
        builder: '@nrwl/jest:jest',
        outputs: ['coverage/libs/my-lib'],
        options: {
          jestConfig: 'libs/my-lib/jest.config.js',
          passWithNoTests: true,
        },
      });
    });

    it('adds srcRootForCompilationRoot in workspace.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', rootDir: './src', buildable: true },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');
      expect(
        workspaceJson.projects['my-lib'].architect.build.options
          .srcRootForCompilationRoot
      ).toEqual('./src');
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

    it('should update root tsconfig.base.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
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
      expect(tsconfigJson.compilerOptions.types).toContain('node');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should generate files', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
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

    it('should throw an exception when not passing importPath when using --publishable', async () => {
      expect.assertions(1);

      try {
        const tree = await runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            publishable: true,
          },
          appTree
        );
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
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
      expect(tsconfigJson.extends).toEqual('../../../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const resultTree = await runSchematic(
        'lib',
        { name: 'myLib', unitTestRunner: 'none' },
        appTree
      );
      expect(resultTree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/jest.config.js')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/lib/my-lib.spec.ts')).toBeFalsy();
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
      const tsconfigJson = readJsonInTree(
        resultTree,
        'libs/my-lib/tsconfig.json'
      );
      expect(tsconfigJson.extends).toEqual('../../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
      ]);
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

  describe('buildable package', () => {
    it('should have a builder defined', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', buildable: true },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');

      expect(workspaceJson.projects['my-lib'].architect.build)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/node:package",
          "options": Object {
            "assets": Array [
              "libs/my-lib/*.md",
            ],
            "main": "libs/my-lib/src/index.ts",
            "outputPath": "dist/libs/my-lib",
            "packageJson": "libs/my-lib/package.json",
            "tsConfig": "libs/my-lib/tsconfig.lib.json",
          },
          "outputs": Array [
            "{options.outputPath}",
          ],
        }
      `);
    });
  });

  describe('publishable package', () => {
    it('should have a builder defined', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', publishable: true, importPath: '@proj/mylib' },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');

      expect(workspaceJson.projects['my-lib'].architect.build).toBeDefined();
    });

    it('should update package.json', async () => {
      const publishableTree = await runSchematic(
        'lib',
        { name: 'mylib', publishable: true, importPath: '@proj/mylib' },
        appTree
      );

      let packageJsonContent = readJsonInTree(
        publishableTree,
        'libs/mylib/package.json'
      );

      expect(packageJsonContent.name).toEqual('@proj/mylib');
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          directory: 'myDir',
          importPath: '@myorg/lib',
        },
        appTree
      );
      const packageJson = readJsonInTree(
        tree,
        'libs/my-dir/my-lib/package.json'
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      const tree1 = await runSchematic(
        'lib',
        {
          name: 'myLib1',
          publishable: true,
          importPath: '@myorg/lib',
        },
        appTree
      );

      try {
        await runSchematic(
          'lib',
          {
            name: 'myLib2',
            publishable: true,
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
            '^.+\\\\\\\\.[tj]sx?$': ['babel-jest', { cwd: __dirname }],
          },
          moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          coverageDirectory: '../../coverage/libs/my-lib',
        };
        "
      `);
    });
  });
  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          js: true,
        } as Schema,
        appTree
      );

      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.js')).toBeTruthy();

      expect(
        readJsonInTree(tree, 'libs/my-lib/tsconfig.json').compilerOptions
      ).toEqual({
        allowJs: true,
      });
      expect(
        readJsonInTree(tree, 'libs/my-lib/tsconfig.lib.json').include
      ).toEqual(['**/*.ts', '**/*.js']);
      expect(
        readJsonInTree(tree, 'libs/my-lib/tsconfig.lib.json').exclude
      ).toEqual(['**/*.spec.ts', '**/*.spec.js']);
    });

    it('should update root tsconfig.json with a js file path', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', js: true } as Schema,
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.js',
      ]);
    });

    it('should update architect builder when --buildable', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', buildable: true, js: true } as Schema,
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');

      expect(
        workspaceJson.projects['my-lib'].architect.build.options.main
      ).toEqual('libs/my-lib/src/index.js');
    });

    it('should generate js files for nested libs as well', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir', js: true } as Schema,
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
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate files with upper case names', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', pascalCaseFiles: true } as Schema,
        appTree
      );
      expect(tree.exists('libs/my-lib/src/lib/MyLib.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/MyLib.spec.ts')).toBeTruthy();
    });

    it('should generate files with upper case names for nested libs as well', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir', pascalCaseFiles: true } as Schema,
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
