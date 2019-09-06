import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { NxJson } from '@nrwl/workspace';
import { runSchematic } from '../../utils/testing';

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
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          exclude: ['**/node_modules/**', '!libs/my-lib/**'],
          tsConfig: [
            'libs/my-lib/tsconfig.lib.json',
            'libs/my-lib/tsconfig.spec.json'
          ]
        }
      });
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-lib': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should update root tsconfig.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts'
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toEqual({
        extends: '../../tsconfig.json',
        compilerOptions: {
          allowJs: true,
          jsx: 'react',
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          types: ['node', 'jest']
        },
        include: ['**/*.ts', '**/*.tsx']
      });
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
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.css')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();
    });
  });

  describe('nested', () => {
    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          directory: 'myDir',
          tags: 'one'
        },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-lib': {
            tags: ['one']
          }
        }
      });

      const tree2 = await runSchematic(
        'lib',
        {
          name: 'myLib2',
          directory: 'myDir',
          tags: 'one,two'
        },
        tree
      );
      const nxJson2 = readJsonInTree<NxJson>(tree2, '/nx.json');
      expect(nxJson2).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-lib': {
            tags: ['one']
          },
          'my-dir-my-lib2': {
            tags: ['one', 'two']
          }
        }
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
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.tsx')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.css')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.tsx')
      ).toBeTruthy();
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
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          exclude: ['**/node_modules/**', '!libs/my-dir/my-lib/**'],
          tsConfig: [
            'libs/my-dir/my-lib/tsconfig.lib.json',
            'libs/my-dir/my-lib/tsconfig.spec.json'
          ]
        }
      });
    });

    it('should update tsconfig.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
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
      expect(tsconfigJson).toEqual({
        extends: '../../../tsconfig.json',
        compilerOptions: {
          allowJs: true,
          jsx: 'react',
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          types: ['node', 'jest']
        },
        include: ['**/*.ts', '**/*.tsx']
      });
    });
  });

  describe('--style scss', () => {
    it('should use scss for styles', async () => {
      const result = await runSchematic(
        'lib',
        { name: 'myLib', style: 'scss' },
        appTree
      );

      expect(result.exists('libs/my-lib/src/lib/my-lib.scss')).toBeTruthy();
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
      const workspaceJson = readJsonInTree(resultTree, 'workspace.json');
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
      expect(
        workspaceJson.projects['my-lib'].architect.lint.options.tsConfig
      ).toEqual(['libs/my-lib/tsconfig.lib.json']);
    });
  });

  describe('--appProject', () => {
    it('should add new route to existing routing code', async () => {
      appTree = await runSchematic(
        'app',
        { name: 'myApp', routing: true },
        appTree
      );

      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          appProject: 'my-app'
        },
        appTree
      );

      const appSource = tree.read('apps/my-app/src/app/app.tsx').toString();
      const mainSource = tree.read('apps/my-app/src/main.tsx').toString();

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });

    it('should initialize routes if none were set up then add new route', async () => {
      appTree = await runSchematic('app', { name: 'myApp' }, appTree);

      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          appProject: 'my-app'
        },
        appTree
      );

      const appSource = tree.read('apps/my-app/src/app/app.tsx').toString();
      const mainSource = tree.read('apps/my-app/src/main.tsx').toString();

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });
  });

  describe('--publishable', () => {
    it('should add build architect', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        builder: '@nrwl/web:bundle',
        options: {
          entryFile: 'libs/my-lib/src/index.ts',
          outputPath: 'dist/libs/my-lib',
          project: 'libs/my-lib/package.json',
          tsConfig: 'libs/my-lib/tsconfig.lib.json',
          babelConfig: '@nrwl/react/plugins/bundle-babel',
          rollupConfig: '@nrwl/react/plugins/bundle-rollup'
        }
      });
    });

    it('should add package.json', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true
        },
        appTree
      );

      const packageJson = readJsonInTree(tree, '/libs/my-lib/package.json');

      expect(packageJson.name).toEqual('my-lib');
    });
  });
});
