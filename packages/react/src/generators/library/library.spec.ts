import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import libraryGenerator from './library';
import { Linter } from '@nrwl/linter';
import { Schema } from './schema';
import applicationGenerator from '../application/application';

describe('lib', () => {
  let appTree: Tree;

  let defaultSchema: Schema = {
    name: 'myLib',
    linter: Linter.EsLint,
    skipFormat: false,
    skipTsConfig: false,
    unitTestRunner: 'jest',
    style: 'css',
    component: true,
    strict: true,
    standaloneConfig: false,
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const workspaceJson = readJson(appTree, '/workspace.json');
      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeUndefined();
      expect(workspaceJson.projects['my-lib'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-lib/**/*.{ts,tsx,js,jsx}'],
        },
      });
    });

    it('should update tags', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, tags: 'one,two' });
      const project = readProjectConfiguration(appTree, 'my-lib');
      expect(project).toEqual(
        expect.objectContaining({
          tags: ['one', 'two'],
        })
      );
    });

    it('should add react and react-dom packages to package.json if not already present', async () => {
      await libraryGenerator(appTree, defaultSchema);

      const packageJson = readJson(appTree, '/package.json');

      expect(packageJson).toMatchObject({
        dependencies: {
          react: expect.anything(),
          'react-dom': expect.anything(),
        },
      });
    });

    it('should update tsconfig.base.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.base.json (no existing path mappings)', async () => {
      updateJson(appTree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.paths = undefined;
        return json;
      });

      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).toEqual(true);
      expect(tsconfigJson.compilerOptions.strict).toEqual(true);
      expect(tsconfigJson.compilerOptions.noImplicitReturns).toEqual(true);
      expect(tsconfigJson.compilerOptions.noFallthroughCasesInSwitch).toEqual(
        true
      );
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should ignore test files in tsconfig.lib.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.exclude).toEqual([
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.spec.tsx',
        '**/*.test.tsx',
        '**/*.spec.js',
        '**/*.test.js',
        '**/*.spec.jsx',
        '**/*.test.jsx',
      ]);
    });

    it('should generate files', async () => {
      await libraryGenerator(appTree, defaultSchema);
      expect(appTree.exists('libs/my-lib/package.json')).toBeFalsy();
      expect(appTree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(appTree.exists('libs/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.css')
      ).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.spec.tsx')
      ).toBeTruthy();

      const eslintJson = readJson(appTree, 'libs/my-lib/.eslintrc.json');
      expect(eslintJson).toMatchInlineSnapshot(`
        Object {
          "extends": Array [
            "plugin:@nrwl/nx/react",
            "../../.eslintrc.json",
          ],
          "ignorePatterns": Array [
            "!**/*",
          ],
          "overrides": Array [
            Object {
              "files": Array [
                "*.ts",
                "*.tsx",
                "*.js",
                "*.jsx",
              ],
              "rules": Object {},
            },
            Object {
              "files": Array [
                "*.ts",
                "*.tsx",
              ],
              "rules": Object {},
            },
            Object {
              "files": Array [
                "*.js",
                "*.jsx",
              ],
              "rules": Object {},
            },
          ],
        }
      `);
    });
  });

  describe('nested', () => {
    it('should update tags and implicitDependencies', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        directory: 'myDir',
        tags: 'one',
      });
      const myLib = readProjectConfiguration(appTree, 'my-dir-my-lib');
      expect(myLib).toEqual(
        expect.objectContaining({
          tags: ['one'],
        })
      );

      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'myLib2',
        directory: 'myDir',
        tags: 'one,two',
      });

      const myLib2 = readProjectConfiguration(appTree, 'my-dir-my-lib2');
      expect(myLib2).toEqual(
        expect.objectContaining({
          tags: ['one', 'two'],
        })
      );
    });

    it('should generate files', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, directory: 'myDir' });
      expect(appTree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.css')
      ).toBeTruthy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.tsx')
      ).toBeTruthy();
    });

    it('should update workspace.json', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, directory: 'myDir' });
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-lib'].root).toEqual(
        'libs/my-dir/my-lib'
      );
      expect(workspaceJson.projects['my-dir-my-lib'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-dir/my-lib/**/*.{ts,tsx,js,jsx}'],
        },
      });
    });

    it('should update tsconfig.base.json', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, directory: 'myDir' });
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, directory: 'myDir' });

      const tsconfigJson = readJson(
        appTree,
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
      await libraryGenerator(appTree, { ...defaultSchema, style: 'scss' });

      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.scss')
      ).toBeTruthy();
    });
  });

  describe('--style none', () => {
    it('should not use styles when style none', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, style: 'none' });

      expect(appTree.exists('libs/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.spec.tsx')
      ).toBeTruthy();
      expect(appTree.exists('libs/my-lib/src/lib/my-lib.css')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/src/lib/my-lib.scss')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/src/lib/my-lib.styl')).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.css')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.scss')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.styl')
      ).toBeFalsy();

      const content = appTree.read('libs/my-lib/src/lib/my-lib.tsx', 'utf-8');
      expect(content).not.toContain('styled-components');
      expect(content).not.toContain('<StyledApp>');
      expect(content).not.toContain('@emotion/styled');
      expect(content).not.toContain('<StyledApp>');

      //for imports
      expect(content).not.toContain('app.styl');
      expect(content).not.toContain('app.css');
      expect(content).not.toContain('app.scss');
      expect(content).not.toContain('app.module.styl');
      expect(content).not.toContain('app.module.css');
      expect(content).not.toContain('app.module.scss');
    });
  });

  describe('--no-component', () => {
    it('should not generate components or styles', async () => {
      await libraryGenerator(appTree, { ...defaultSchema, component: false });

      expect(appTree.exists('libs/my-lib/src/lib')).toBeFalsy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        unitTestRunner: 'none',
      });

      expect(appTree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/jest.config.js')).toBeFalsy();
      const workspaceJson = readJson(appTree, 'workspace.json');
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
      expect(workspaceJson.projects['my-lib'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "libs/my-lib/**/*.{ts,tsx,js,jsx}",
            ],
          },
          "outputs": Array [
            "{options.outputFile}",
          ],
        }
      `);
    });
  });

  describe('--appProject', () => {
    it('should add new route to existing routing code', async () => {
      await applicationGenerator(appTree, {
        babelJest: true,
        e2eTestRunner: 'none',
        linter: Linter.EsLint,
        skipFormat: true,
        unitTestRunner: 'jest',
        name: 'myApp',
        routing: true,
        style: 'css',
        standaloneConfig: false,
      });

      await libraryGenerator(appTree, {
        ...defaultSchema,
        appProject: 'my-app',
      });

      const appSource = appTree.read('apps/my-app/src/app/app.tsx', 'utf-8');
      const mainSource = appTree.read('apps/my-app/src/main.tsx', 'utf-8');

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });

    it('should initialize routes if none were set up then add new route', async () => {
      await applicationGenerator(appTree, {
        babelJest: true,
        e2eTestRunner: 'none',
        linter: Linter.EsLint,
        skipFormat: true,
        unitTestRunner: 'jest',
        name: 'myApp',
        style: 'css',
        standaloneConfig: false,
      });

      await libraryGenerator(appTree, {
        ...defaultSchema,
        appProject: 'my-app',
      });

      const appSource = appTree.read('apps/my-app/src/app/app.tsx', 'utf-8');
      const mainSource = appTree.read('apps/my-app/src/main.tsx', 'utf-8');

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });
  });

  describe('--buildable', () => {
    it('should have a builder defined', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        buildable: true,
      });

      const workspaceJson = getProjects(appTree);

      expect(workspaceJson.get('my-lib').targets.build).toBeDefined();
    });
  });

  describe('--publishable', () => {
    it('should add build architect', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const workspaceJson = getProjects(appTree);

      expect(workspaceJson.get('my-lib').targets.build).toMatchObject({
        executor: '@nrwl/web:rollup',
        outputs: ['{options.outputPath}'],
        options: {
          external: ['react/jsx-runtime'],
          entryFile: 'libs/my-lib/src/index.ts',
          outputPath: 'dist/libs/my-lib',
          project: 'libs/my-lib/package.json',
          tsConfig: 'libs/my-lib/tsconfig.lib.json',
          rollupConfig: '@nrwl/react/plugins/bundle-rollup',
        },
      });
    });

    it('should fail if no importPath is provided with publishable', async () => {
      expect.assertions(1);

      try {
        await libraryGenerator(appTree, {
          ...defaultSchema,
          directory: 'myDir',
          publishable: true,
        });
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
    });

    it('should support styled-components', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'styled-components',
      });

      const workspaceJson = readJson(appTree, '/workspace.json');
      const babelrc = readJson(appTree, 'libs/my-lib/.babelrc');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual([
        ['styled-components', { pure: true, ssr: true }],
      ]);
    });

    it('should support @emotion/styled', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: '@emotion/styled',
      });

      const workspaceJson = readJson(appTree, '/workspace.json');
      const babelrc = readJson(appTree, 'libs/my-lib/.babelrc');
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react/jsx-runtime', '@emotion/styled/base'],
        },
      });
      expect(babelrc.plugins).toEqual(['@emotion/babel-plugin']);
      expect(tsconfigJson.compilerOptions['jsxImportSource']).toEqual(
        '@emotion/react'
      );
    });

    it('should support styled-jsx', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'styled-jsx',
      });

      const workspaceJson = readJson(appTree, '/workspace.json');
      const babelrc = readJson(appTree, 'libs/my-lib/.babelrc');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual(['styled-jsx/babel']);
    });

    it('should support style none', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'none',
      });

      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].architect.build).toMatchObject({
        options: {
          external: ['react/jsx-runtime'],
        },
      });
    });

    it('should add package.json and .babelrc', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const packageJson = readJson(appTree, '/libs/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
      expect(appTree.exists('/libs/my-lib/.babelrc'));
    });
  });

  describe('--js', () => {
    it('should generate JS files', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        js: true,
      });

      expect(appTree.exists('/libs/my-lib/src/index.js')).toBe(true);
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        directory: 'myDir',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(appTree, 'libs/my-dir/my-lib/package.json');
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'myLib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(appTree, {
          ...defaultSchema,
          name: 'myLib2',
          publishable: true,
          importPath: '@myorg/lib',
        });
      } catch (e) {
        expect(e.message).toContain(
          'You already have a library using the import path'
        );
      }

      expect.assertions(1);
    });
  });

  describe('--no-strict', () => {
    it('should not add options for strict mode', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        strict: false,
      });
      const tsconfigJson = readJson(appTree, '/libs/my-lib/tsconfig.json');

      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).not.toBeDefined();
      expect(tsconfigJson.compilerOptions.strict).not.toBeDefined();
      expect(tsconfigJson.compilerOptions.noImplicitReturns).not.toBeDefined();
      expect(
        tsconfigJson.compilerOptions.noFallthroughCasesInSwitch
      ).not.toBeDefined();
    });
  });

  describe('--compiler', () => {
    it('should install swc dependencies if needed', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        compiler: 'swc',
      });
      const packageJson = readJson(appTree, 'package.json');

      expect(packageJson.devDependencies['@swc/core']).toEqual(
        expect.any(String)
      );
    });
  });

  it.each`
    style
    ${'styled-components'}
    ${'styled-jsx'}
    ${'@emotion/styled'}
  `(
    'should generate valid .babelrc JSON config for CSS-in-JS solutions',
    async ({ style }) => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        style,
        name: 'myLib',
      });

      expect(() => {
        readJson(appTree, `libs/my-lib/.babelrc`);
      }).not.toThrow();
    }
  );
});
