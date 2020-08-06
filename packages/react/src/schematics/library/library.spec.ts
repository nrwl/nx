import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { NxJson, readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
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
        builder: '@nrwl/linter:lint',
        options: {
          linter: 'eslint',
          exclude: ['**/node_modules/**', '!libs/my-lib/**/*'],
          tsConfig: [
            'libs/my-lib/tsconfig.lib.json',
            'libs/my-lib/tsconfig.spec.json',
          ],
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

    it('should add react and react-dom packages to package.json if not already present', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);

      const packageJson = readJsonInTree(tree, '/package.json');

      expect(packageJson).toMatchObject({
        dependencies: {
          react: expect.anything(),
          'react-dom': expect.anything(),
        },
      });
    });

    it('should update tsconfig.base.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.base.json (no existing path mappings)', async () => {
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
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
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
      expect(tree.exists('libs/my-lib/package.json')).toBeFalsy();
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
        builder: '@nrwl/linter:lint',
        options: {
          linter: 'eslint',
          exclude: ['**/node_modules/**', '!libs/my-dir/my-lib/**/*'],
          tsConfig: [
            'libs/my-dir/my-lib/tsconfig.lib.json',
            'libs/my-dir/my-lib/tsconfig.spec.json',
          ],
        },
      });
    });

    it('should update tsconfig.base.json', async () => {
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

  describe('--style none', () => {
    it('should not use styles when style none', async () => {
      const result = await runSchematic(
        'lib',
        { name: 'myLib', style: 'none' },
        appTree
      );

      expect(result.exists('libs/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(result.exists('libs/my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();
      expect(result.exists('libs/my-lib/src/lib/my-lib.css')).toBeFalsy();
      expect(result.exists('libs/my-lib/src/lib/my-lib.scss')).toBeFalsy();
      expect(result.exists('libs/my-lib/src/lib/my-lib.styl')).toBeFalsy();

      const content = result.read('libs/my-lib/src/lib/my-lib.tsx').toString();
      expect(content).not.toContain('styled-components');
      expect(content).not.toContain('<StyledApp>');
      expect(content).not.toContain('@emotion/styled');
      expect(content).not.toContain('<StyledApp>');

      //for imports
      expect(content).not.toContain('app.styl');
      expect(content).not.toContain('app.css');
      expect(content).not.toContain('app.scss');
    });
  });

  describe('--no-component', () => {
    it('should not generate components or styles', async () => {
      const result = await runSchematic(
        'lib',
        { name: 'myLib', component: false },
        appTree
      );

      expect(result.exists('libs/my-lib/src/lib')).toBeFalsy();
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
          appProject: 'my-app',
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
          appProject: 'my-app',
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

  describe('--buildable', () => {
    it('should have a builder defined', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          buildable: true,
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toBeDefined();
    });
  });

  describe('--publishable', () => {
    it('should add build architect', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        builder: '@nrwl/web:package',
        options: {
          external: ['react', 'react-dom'],
          entryFile: 'libs/my-lib/src/index.ts',
          outputPath: 'dist/libs/my-lib',
          project: 'libs/my-lib/package.json',
          tsConfig: 'libs/my-lib/tsconfig.lib.json',
          babelConfig: '@nrwl/react/plugins/bundle-babel',
          rollupConfig: '@nrwl/react/plugins/bundle-rollup',
        },
      });
    });

    it('should fail if no importPath is provided with publishable', async () => {
      expect.assertions(1);

      try {
        const tree = await runSchematic(
          'lib',
          { name: 'myLib', directory: 'myDir', publishable: true },
          appTree
        );
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
    });

    it('should support styled-components', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          style: 'styled-components',
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'react-is', 'styled-components'],
        },
      });
    });

    it('should support @emotion/styled', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          style: '@emotion/styled',
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', '@emotion/styled', '@emotion/core'],
        },
      });
    });

    it('should support styled-jsx', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          style: 'styled-jsx',
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');
      const babelrc = readJsonInTree(tree, 'libs/my-lib/.babelrc');
      const babelJestConfig = readJsonInTree(
        tree,
        'libs/my-lib/babel-jest.config.json'
      );

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'styled-jsx'],
        },
      });
      expect(babelrc.plugins).toContain('styled-jsx/babel');
      expect(babelJestConfig.plugins).toContain('styled-jsx/babel');
    });

    it('should support style none', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          style: 'none',
        },
        appTree
      );

      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react', 'react-dom'],
        },
      });
    });

    it('should add package.json and .babelrc', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
        },
        appTree
      );

      const packageJson = readJsonInTree(tree, '/libs/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
      expect(tree.exists('/libs/my-lib/.babelrc'));
    });
  });

  describe('--js', () => {
    it('should generate JS files', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          js: true,
        },
        appTree
      );

      expect(tree.exists('/libs/my-lib/src/index.js')).toBe(true);
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
            framework: 'angular',
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
});
