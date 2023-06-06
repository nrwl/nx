import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { nxVersion } from '../../utils/versions';
import applicationGenerator from '../application/application';
import libraryGenerator from './library';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
describe('lib', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  let defaultSchema: Schema = {
    name: 'myLib',
    linter: Linter.EsLint,
    skipFormat: false,
    skipTsConfig: false,
    unitTestRunner: 'jest',
    style: 'css',
    component: true,
    strict: true,
    simpleName: false,
  };

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, '/package.json', (json) => {
      json.devDependencies = {
        '@nx/cypress': nxVersion,
        '@nx/jest': nxVersion,
        '@nx/rollup': nxVersion,
        '@nx/vite': nxVersion,
        '@nx/webpack': nxVersion,
      };
      return json;
    });
  });

  it('should update project configuration', async () => {
    await libraryGenerator(tree, defaultSchema);
    const project = readProjectConfiguration(tree, 'my-lib');
    expect(project.root).toEqual('libs/my-lib');
    expect(project.targets.build).toBeUndefined();
    expect(project.targets.lint).toEqual({
      executor: '@nx/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: ['libs/my-lib/**/*.{ts,tsx,js,jsx}'],
      },
    });
  });

  it('should add vite types to tsconfigs', async () => {
    await libraryGenerator(tree, {
      ...defaultSchema,
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });
    const tsconfigApp = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
    expect(tsconfigApp.compilerOptions.types).toEqual(['node', 'vite/client']);
    const tsconfigSpec = readJson(tree, 'libs/my-lib/tsconfig.spec.json');
    expect(tsconfigSpec.compilerOptions.types).toEqual([
      'vitest/globals',
      'vitest/importMeta',
      'vite/client',
      'node',
    ]);
  });

  it('should update tags', async () => {
    await libraryGenerator(tree, { ...defaultSchema, tags: 'one,two' });
    const project = readProjectConfiguration(tree, 'my-lib');
    expect(project).toEqual(
      expect.objectContaining({
        tags: ['one', 'two'],
      })
    );
  });

  it('should add react and react-dom packages to package.json if not already present', async () => {
    await libraryGenerator(tree, defaultSchema);

    const packageJson = readJson(tree, '/package.json');

    expect(packageJson).toMatchObject({
      dependencies: {
        react: expect.anything(),
        'react-dom': expect.anything(),
      },
    });
  });

  it('should update root tsconfig.base.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, '/tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'libs/my-lib/src/index.ts',
    ]);
  });

  it('should create tsconfig.base.json out of tsconfig.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await libraryGenerator(tree, defaultSchema);

    expect(tree.exists('tsconfig.base.json')).toEqual(true);
    const tsconfigJson = readJson(tree, 'tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'libs/my-lib/src/index.ts',
    ]);
  });

  it('should update root tsconfig.base.json (no existing path mappings)', async () => {
    updateJson(tree, 'tsconfig.base.json', (json) => {
      json.compilerOptions.paths = undefined;
      return json;
    });

    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, '/tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'libs/my-lib/src/index.ts',
    ]);
  });

  it('should create a local tsconfig.json', async () => {
    await libraryGenerator(tree, defaultSchema);

    const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
    expect(tsconfigJson.extends).toBe('../../tsconfig.base.json');
    expect(tsconfigJson.references).toEqual([
      {
        path: './tsconfig.lib.json',
      },
      {
        path: './tsconfig.spec.json',
      },
    ]);
    expect(tsconfigJson.compilerOptions.strict).toEqual(true);
  });

  it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.spec.json');
    expect(tsconfigJson.extends).toEqual('./tsconfig.json');
  });

  it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
    expect(tsconfigJson.extends).toEqual('./tsconfig.json');
  });

  it('should ignore test files in tsconfig.lib.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
    expect(tsconfigJson.exclude).toEqual([
      'jest.config.ts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.tsx',
      'src/**/*.test.tsx',
      'src/**/*.spec.js',
      'src/**/*.test.js',
      'src/**/*.spec.jsx',
      'src/**/*.test.jsx',
    ]);
  });

  it('should generate files', async () => {
    await libraryGenerator(tree, defaultSchema);
    expect(tree.exists('libs/my-lib/package.json')).toBeFalsy();
    expect(tree.exists(`libs/my-lib/jest.config.ts`)).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/lib/my-lib.module.css')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();

    const eslintJson = readJson(tree, 'libs/my-lib/.eslintrc.json');
    expect(eslintJson).toMatchInlineSnapshot(`
        {
          "extends": [
            "plugin:@nx/react",
            "../../.eslintrc.json",
          ],
          "ignorePatterns": [
            "!**/*",
          ],
          "overrides": [
            {
              "files": [
                "*.ts",
                "*.tsx",
                "*.js",
                "*.jsx",
              ],
              "rules": {},
            },
            {
              "files": [
                "*.ts",
                "*.tsx",
              ],
              "rules": {},
            },
            {
              "files": [
                "*.js",
                "*.jsx",
              ],
              "rules": {},
            },
          ],
        }
      `);
  });
  it('should update jest.config.ts for babel', async () => {
    await libraryGenerator(tree, {
      ...defaultSchema,
      buildable: true,
      compiler: 'babel',
    });
    expect(tree.read('libs/my-lib/jest.config.ts', 'utf-8')).toContain(
      "['babel-jest', { presets: ['@nx/react/babel'] }]"
    );
  });

  it('should add @babel/preset-react when using babel compiler', async () => {
    await libraryGenerator(tree, {
      ...defaultSchema,
      compiler: 'babel',
      directory: 'myDir',
      tags: 'one',
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@babel/preset-react']).toBeDefined();
  });

  describe('nested', () => {
    it('should update tags and implicitDependencies', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'myDir',
        tags: 'one',
      });
      const myLib = readProjectConfiguration(tree, 'my-dir-my-lib');
      expect(myLib).toEqual(
        expect.objectContaining({
          tags: ['one'],
        })
      );

      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'myLib2',
        directory: 'myDir',
        tags: 'one,two',
      });

      const myLib2 = readProjectConfiguration(tree, 'my-dir-my-lib2');
      expect(myLib2).toEqual(
        expect.objectContaining({
          tags: ['one', 'two'],
        })
      );
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, { ...defaultSchema, directory: 'myDir' });
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.tsx')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.css')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.tsx')
      ).toBeTruthy();
    });

    it('should update jest.config.ts for babel', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'myDir',
        buildable: true,
        compiler: 'babel',
      });
      expect(tree.read('libs/my-dir/my-lib/jest.config.ts', 'utf-8')).toContain(
        "['babel-jest', { presets: ['@nx/react/babel'] }]"
      );
    });

    it('should update project configurations', async () => {
      await libraryGenerator(tree, { ...defaultSchema, directory: 'myDir' });
      const config = readProjectConfiguration(tree, 'my-dir-my-lib');

      expect(config.root).toEqual('libs/my-dir/my-lib');
      expect(config.targets.lint).toEqual({
        executor: '@nx/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-dir/my-lib/**/*.{ts,tsx,js,jsx}'],
        },
      });
    });

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(tree, { ...defaultSchema, directory: 'myDir' });
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, { ...defaultSchema, directory: 'myDir' });

      const tsconfigJson = readJson(tree, 'libs/my-dir/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../../../tsconfig.base.json');
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
      await libraryGenerator(tree, { ...defaultSchema, style: 'scss' });

      expect(
        tree.exists('libs/my-lib/src/lib/my-lib.module.scss')
      ).toBeTruthy();
    });
  });

  describe('--style none', () => {
    it('should not use styles when style none', async () => {
      await libraryGenerator(tree, { ...defaultSchema, style: 'none' });

      expect(tree.exists('libs/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.css')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.scss')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.styl')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.module.css')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.module.scss')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.module.styl')).toBeFalsy();

      const content = tree.read('libs/my-lib/src/lib/my-lib.tsx', 'utf-8');
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
      await libraryGenerator(tree, { ...defaultSchema, component: false });

      expect(tree.exists('libs/my-lib/src/lib')).toBeFalsy();
    });
  });

  describe('--globalCss', () => {
    it('should not generate .module styles', async () => {
      await libraryGenerator(tree, { ...defaultSchema, globalCss: true });

      expect(tree.exists('libs/my-lib/src/lib/my-lib.css'));
      expect(tree.exists('libs/my-lib/src/lib/my-lib.module.css')).toBeFalsy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        unitTestRunner: 'none',
      });

      expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('libs/my-lib/jest.config.ts')).toBeFalsy();
      const config = readProjectConfiguration(tree, 'my-lib');
      expect(config.targets.test).toBeUndefined();
      expect(config.targets.lint).toMatchInlineSnapshot(`
        {
          "executor": "@nx/linter:eslint",
          "options": {
            "lintFilePatterns": [
              "libs/my-lib/**/*.{ts,tsx,js,jsx}",
            ],
          },
          "outputs": [
            "{options.outputFile}",
          ],
        }
      `);
    });
  });

  describe('--appProject', () => {
    it('should add new route to existing routing code', async () => {
      await applicationGenerator(tree, {
        compiler: 'babel',
        e2eTestRunner: 'none',
        linter: Linter.EsLint,
        skipFormat: true,
        unitTestRunner: 'jest',
        name: 'myApp',
        routing: true,
        style: 'css',

        bundler: 'webpack',
      });

      await libraryGenerator(tree, {
        ...defaultSchema,
        appProject: 'my-app',
      });

      const appSource = tree.read('apps/my-app/src/app/app.tsx', 'utf-8');
      const mainSource = tree.read('apps/my-app/src/main.tsx', 'utf-8');

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });

    it('should initialize routes if none were set up then add new route', async () => {
      await applicationGenerator(tree, {
        e2eTestRunner: 'none',
        linter: Linter.EsLint,
        skipFormat: true,
        unitTestRunner: 'jest',
        name: 'myApp',
        style: 'css',

        bundler: 'webpack',
      });

      await libraryGenerator(tree, {
        ...defaultSchema,
        appProject: 'my-app',
      });

      const appSource = tree.read('apps/my-app/src/app/app.tsx', 'utf-8');
      const mainSource = tree.read('apps/my-app/src/main.tsx', 'utf-8');

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });
  });

  describe('--buildable', () => {
    it('should have a builder defined', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        buildable: true,
      });

      const projectsConfigurations = getProjects(tree);

      expect(projectsConfigurations.get('my-lib').targets.build).toBeDefined();
    });
  });

  describe('--publishable', () => {
    it('should add build targets', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const projectsConfigurations = getProjects(tree);

      expect(projectsConfigurations.get('my-lib').targets.build).toMatchObject({
        executor: '@nx/rollup:rollup',
        outputs: ['{options.outputPath}'],
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          entryFile: 'libs/my-lib/src/index.ts',
          outputPath: 'dist/libs/my-lib',
          project: 'libs/my-lib/package.json',
          tsConfig: 'libs/my-lib/tsconfig.lib.json',
          rollupConfig: '@nx/react/plugins/bundle-rollup',
        },
      });
    });

    it('should fail if no importPath is provided with publishable', async () => {
      expect.assertions(1);

      try {
        await libraryGenerator(tree, {
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
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'styled-components',
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      const babelrc = readJson(tree, 'libs/my-lib/.babelrc');

      expect(config.targets.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual([
        ['styled-components', { pure: true, ssr: true }],
      ]);
    });

    it('should support @emotion/styled', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: '@emotion/styled',
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      const babelrc = readJson(tree, 'libs/my-lib/.babelrc');
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');

      expect(config.targets.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', '@emotion/react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual(['@emotion/babel-plugin']);
      expect(tsconfigJson.compilerOptions['jsxImportSource']).toEqual(
        '@emotion/react'
      );
    });

    it('should support styled-jsx', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'styled-jsx',
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      const babelrc = readJson(tree, 'libs/my-lib/.babelrc');

      expect(config.targets.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual(['styled-jsx/babel']);
    });

    it('should support style none', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'none',
      });

      const config = readProjectConfiguration(tree, 'my-lib');

      expect(config.targets.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
      });
    });

    it('should add package.json and .babelrc', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const packageJson = readJson(tree, '/libs/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
      expect(tree.exists('/libs/my-lib/.babelrc'));
    });
  });

  describe('--js', () => {
    it('should generate JS files', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        js: true,
      });

      expect(tree.exists('/libs/my-lib/src/index.js')).toBe(true);
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        directory: 'myDir',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(tree, 'libs/my-dir/my-lib/package.json');
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'myLib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(tree, {
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
      await libraryGenerator(tree, {
        ...defaultSchema,
        strict: false,
      });
      const tsconfigJson = readJson(tree, '/libs/my-lib/tsconfig.json');

      expect(tsconfigJson.compilerOptions.strict).toEqual(false);
    });
  });

  describe('--compiler', () => {
    it('should install swc dependencies if needed', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        buildable: true,
        compiler: 'swc',
      });
      const packageJson = readJson(tree, 'package.json');

      expect(packageJson.devDependencies['@swc/core']).toEqual(
        expect.any(String)
      );
    });
  });

  describe('--skipPackageJson', () => {
    it('should not add dependencies to package.json when true', async () => {
      // ARRANGE
      const packageJsonBeforeGenerator = tree.read('package.json', 'utf-8');
      // ACT
      await libraryGenerator(tree, {
        ...defaultSchema,
        skipPackageJson: true,
      });

      // ASSERT
      expect(tree.read('package.json', 'utf-8')).toEqual(
        packageJsonBeforeGenerator
      );
    });
  });

  describe('--setParserOptionsProject', () => {
    it('should set the parserOptions.project in the eslintrc.json file', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        setParserOptionsProject: true,
      });

      const eslintConfig = readJson(tree, 'libs/my-lib/.eslintrc.json');

      expect(eslintConfig.overrides[0].parserOptions.project).toEqual([
        'libs/my-lib/tsconfig.*?.json',
      ]);
    });
  });

  describe('--simpleName', () => {
    it('should generate a library with a simple name', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        simpleName: true,
        directory: 'myDir',
      });

      const indexFile = tree.read('libs/my-dir/my-lib/src/index.ts', 'utf-8');

      expect(indexFile).toContain(`export * from './lib/my-lib';`);

      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.module.css')
      ).toBeTruthy();

      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.spec.tsx')
      ).toBeTruthy();

      expect(tree.exists('libs/my-dir/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
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
      await libraryGenerator(tree, {
        ...defaultSchema,
        style,
        compiler: 'babel',
        name: 'myLib',
      });

      expect(() => {
        readJson(tree, `libs/my-lib/.babelrc`);
      }).not.toThrow();
    }
  );

  it.each`
    style     | pkg
    ${'less'} | ${'less'}
    ${'scss'} | ${'sass'}
    ${'styl'} | ${'stylus'}
  `(
    'should add style preprocessor when vite is used',
    async ({ style, pkg }) => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        style,
        bundler: 'vite',
        unitTestRunner: 'vitest',
        name: 'myLib',
      });

      expect(readJson(tree, 'package.json')).toMatchObject({
        devDependencies: {
          [pkg]: expect.any(String),
        },
      });
    }
  );
});
