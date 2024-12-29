import 'nx/src/internal-testing-utils/mock-project-graph';

import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { nxVersion } from '../../utils/versions';
import applicationGenerator from '../application/application';
import libraryGenerator from './library';
import { Schema } from './schema';
const { load } = require('@zkochan/js-yaml');
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
describe('lib', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  let defaultSchema: Schema = {
    directory: 'my-lib',
    linter: Linter.EsLint,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'jest',
    style: 'css',
    component: true,
    strict: true,
    simpleName: false,
    addPlugin: true,
  };

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyWorkspace();
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

    expect(project).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "my-lib",
        "projectType": "library",
        "root": "my-lib",
        "sourceRoot": "my-lib/src",
        "tags": [],
        "targets": {},
      }
    `);
  });

  it('should add vite types to tsconfigs', async () => {
    await libraryGenerator(tree, {
      ...defaultSchema,
      skipFormat: false,
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });
    const tsconfigApp = readJson(tree, 'my-lib/tsconfig.lib.json');
    expect(tsconfigApp.compilerOptions.types).toEqual([
      'node',
      '@nx/react/typings/cssmodule.d.ts',
      '@nx/react/typings/image.d.ts',
      'vite/client',
    ]);
    const tsconfigSpec = readJson(tree, 'my-lib/tsconfig.spec.json');
    expect(tsconfigSpec.compilerOptions.types).toEqual([
      'vitest/globals',
      'vitest/importMeta',
      'vite/client',
      'node',
      'vitest',
    ]);
    expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
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
      'my-lib/src/index.ts',
    ]);
  });

  it('should create tsconfig.base.json out of tsconfig.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await libraryGenerator(tree, defaultSchema);

    expect(tree.exists('tsconfig.base.json')).toEqual(true);
    const tsconfigJson = readJson(tree, 'tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'my-lib/src/index.ts',
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
      'my-lib/src/index.ts',
    ]);
  });

  it('should create a local tsconfig.json', async () => {
    await libraryGenerator(tree, defaultSchema);

    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
    expect(tsconfigJson.extends).toBe('../tsconfig.base.json');
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
    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.spec.json');
    expect(tsconfigJson.extends).toEqual('./tsconfig.json');
  });

  it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
    expect(tsconfigJson.extends).toEqual('./tsconfig.json');
  });

  it('should ignore test files in tsconfig.lib.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
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
    await libraryGenerator(tree, { ...defaultSchema, skipFormat: false });
    expect(tree.exists('my-lib/package.json')).toBeFalsy();
    expect(tree.exists(`my-lib/jest.config.ts`)).toBeTruthy();
    expect(tree.exists('my-lib/src/index.ts')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/my-lib.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/my-lib.module.css')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();

    const eslintJson = readJson(tree, 'my-lib/.eslintrc.json');
    expect(eslintJson).toMatchInlineSnapshot(`
        {
          "extends": [
            "plugin:@nx/react",
            "../.eslintrc.json",
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
    expect(tree.read('my-lib/jest.config.ts', 'utf-8')).toContain(
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
        name: 'my-dir-my-lib',
        directory: 'my-dir/my-lib',
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
        name: 'my-dir-my-lib2',
        directory: 'my-dir/my-lib-2',
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
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-dir/my-lib',
        name: 'my-dir-my-lib',
      });

      expect(tree.exists(`my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-dir-my-lib.tsx')
      ).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-dir-my-lib.module.css')
      ).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-dir-my-lib.spec.tsx')
      ).toBeTruthy();
    });

    it('should update jest.config.ts for babel', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-dir/my-lib',
        buildable: true,
        compiler: 'babel',
      });
      expect(tree.read('my-dir/my-lib/jest.config.ts', 'utf-8')).toContain(
        "['babel-jest', { presets: ['@nx/react/babel'] }]"
      );
    });

    it('should update project configurations', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-dir/my-lib',
        name: 'my-dir-my-lib',
      });
      const config = readProjectConfiguration(tree, 'my-dir-my-lib');

      expect(config).toMatchInlineSnapshot(`
        {
          "$schema": "../../node_modules/nx/schemas/project-schema.json",
          "name": "my-dir-my-lib",
          "projectType": "library",
          "root": "my-dir/my-lib",
          "sourceRoot": "my-dir/my-lib/src",
          "tags": [],
          "targets": {},
        }
      `);
    });

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-dir/my-lib',
      });
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/my-lib/src/index.ts',
      ]);
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-dir/my-lib',
      });

      const tsconfigJson = readJson(tree, 'my-dir/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../../tsconfig.base.json');
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

      expect(tree.exists('my-lib/src/lib/my-lib.module.scss')).toBeTruthy();
      const content = tree.read('my-lib/src/lib/my-lib.tsx', 'utf-8');
      expect(content).toMatchSnapshot();
    });
  });

  describe('--style none', () => {
    it('should not use styles when style none', async () => {
      await libraryGenerator(tree, { ...defaultSchema, style: 'none' });

      expect(tree.exists('my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.css')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.scss')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.module.css')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.module.scss')).toBeFalsy();

      const content = tree.read('my-lib/src/lib/my-lib.tsx', 'utf-8');
      expect(content).not.toContain('styled-components');
      expect(content).not.toContain('<StyledApp>');
      expect(content).not.toContain('@emotion/styled');
      expect(content).not.toContain('<StyledApp>');

      //for imports
      expect(content).not.toContain('app.css');
      expect(content).not.toContain('app.scss');
      expect(content).not.toContain('app.module.css');
      expect(content).not.toContain('app.module.scss');

      expect(content).toMatchSnapshot();
    });
  });

  describe('--style tailwind', () => {
    it('should not generate any styles file when style is tailwind', async () => {
      await libraryGenerator(tree, { ...defaultSchema, style: 'none' });

      expect(tree.exists('my-lib/src/lib/my-lib.tsx')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.css')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.scss')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.module.css')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.module.scss')).toBeFalsy();

      const content = tree.read('my-lib/src/lib/my-lib.tsx', 'utf-8');
      expect(content).toMatchSnapshot();
    });
  });

  describe('--no-component', () => {
    it('should not generate components or styles', async () => {
      await libraryGenerator(tree, { ...defaultSchema, component: false });

      expect(tree.exists('my-lib/src/lib')).toBeFalsy();
    });
  });

  describe('--globalCss', () => {
    it('should not generate .module styles', async () => {
      await libraryGenerator(tree, { ...defaultSchema, globalCss: true });

      expect(tree.exists('my-lib/src/lib/my-lib.css'));
      expect(tree.exists('my-lib/src/lib/my-lib.module.css')).toBeFalsy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        unitTestRunner: 'none',
      });

      expect(tree.exists('my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('my-lib/jest.config.ts')).toBeFalsy();
    });
  });

  describe('--bundler none, unit test runner vitest', () => {
    it('should configure vite', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        unitTestRunner: 'vitest',
        bundler: 'none',
      });

      expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
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
        directory: 'my-app',
        routing: true,
        style: 'css',
        bundler: 'webpack',
      });

      await libraryGenerator(tree, {
        ...defaultSchema,
        appProject: 'my-app',
      });

      const appSource = tree.read('my-app/src/app/app.tsx', 'utf-8');
      const mainSource = tree.read('my-app/src/main.tsx', 'utf-8');

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
        directory: 'my-app',
        style: 'css',
        bundler: 'webpack',
      });

      await libraryGenerator(tree, {
        ...defaultSchema,
        appProject: 'my-app',
      });

      const appSource = tree.read('my-app/src/app/app.tsx', 'utf-8');
      const mainSource = tree.read('my-app/src/main.tsx', 'utf-8');

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(appSource).toContain('@proj/my-lib');
      expect(appSource).toContain('react-router-dom');
      expect(appSource).toMatch(/<Route\s*path="\/my-lib"/);
    });
  });

  describe('--buildable', () => {
    it('should default to rollup bundler', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        buildable: true,
      });

      expect(tree.read('my-lib/rollup.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');
        const url = require('@rollup/plugin-url');
        const svg = require('@svgr/rollup');

        module.exports = withNx(
          {
            main: './src/index.ts',
            outputPath: '../dist/my-lib',
            tsConfig: './tsconfig.lib.json',
            compiler: 'babel',
            external: ["react","react-dom","react/jsx-runtime"],
            format: ['esm'],
            assets:[{ input: '.', output: '.', glob: 'README.md'}],
          }, {
            // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
            plugins: [
              svg({
                svgo: false,
                titleProp: true,
                ref: true,
              }),
              url({
                limit: 10000, // 10kB
              }),
            ],
          }
        );
        "
      `);
    });
  });

  describe('--publishable', () => {
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

    it('should add package.json and .babelrc', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const packageJson = readJson(tree, '/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
      expect(tree.exists('/my-lib/.babelrc'));
    });

    it('should add rollup config file', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        skipFormat: false,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      expect(tree.read('my-lib/rollup.config.cjs', 'utf-8'))
        .toEqual(`const { withNx } = require('@nx/rollup/with-nx');
const url = require('@rollup/plugin-url');
const svg = require('@svgr/rollup');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../dist/my-lib',
    tsConfig: './tsconfig.lib.json',
    compiler: 'babel',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    format: ['esm'],
    assets: [{ input: '.', output: '.', glob: 'README.md' }],
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    plugins: [
      svg({
        svgo: false,
        titleProp: true,
        ref: true,
      }),
      url({
        limit: 10000, // 10kB
      }),
    ],
  }
);
`);
    });

    it('should add build targets (legacy)', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        addPlugin: false,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const projectsConfigurations = getProjects(tree);

      expect(projectsConfigurations.get('my-lib').targets.build).toMatchObject({
        executor: '@nx/rollup:rollup',
        outputs: ['{options.outputPath}'],
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          entryFile: 'my-lib/src/index.ts',
          outputPath: 'dist/my-lib',
          project: 'my-lib/package.json',
          tsConfig: 'my-lib/tsconfig.lib.json',
          rollupConfig: '@nx/react/plugins/bundle-rollup',
        },
      });
    });

    it('should support styled-components (legacy)', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        addPlugin: false,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'styled-components',
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      const babelrc = readJson(tree, 'my-lib/.babelrc');

      expect(config.targets.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual([
        ['styled-components', { pure: true, ssr: true }],
      ]);
    });

    it('should support @emotion/styled (legacy)', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        addPlugin: false,
        publishable: true,
        importPath: '@proj/my-lib',
        style: '@emotion/styled',
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      const babelrc = readJson(tree, 'my-lib/.babelrc');
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');

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

    it('should support styled-jsx (legacy)', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        addPlugin: false,
        publishable: true,
        importPath: '@proj/my-lib',
        style: 'styled-jsx',
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      const babelrc = readJson(tree, 'my-lib/.babelrc');

      expect(config.targets.build).toMatchObject({
        options: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
      });
      expect(babelrc.plugins).toEqual(['styled-jsx/babel']);
    });

    it('should support style none (legacy)', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        addPlugin: false,
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
  });

  describe('--js', () => {
    it('should generate JS files', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        js: true,
      });

      expect(tree.exists('/my-lib/src/index.js')).toBe(true);
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        directory: 'my-dir/my-lib',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(tree, 'my-dir/my-lib/package.json');
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-lib-1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(tree, {
          ...defaultSchema,
          directory: 'my-lib-2',
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
      const tsconfigJson = readJson(tree, '/my-lib/tsconfig.json');

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

      const eslintConfig = readJson(tree, 'my-lib/.eslintrc.json');

      expect(eslintConfig.overrides[0].parserOptions.project).toEqual([
        'my-lib/tsconfig.*?.json',
      ]);
    });
  });

  describe('--simpleName', () => {
    it('should generate a library with a simple name', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        simpleName: true,
        directory: 'my-dir/my-lib',
      });

      const indexFile = tree.read('my-dir/my-lib/src/index.ts', 'utf-8');

      expect(indexFile).toContain(`export * from './lib/my-lib';`);

      expect(
        tree.exists('my-dir/my-lib/src/lib/my-lib.module.css')
      ).toBeTruthy();

      expect(tree.exists('my-dir/my-lib/src/lib/my-lib.spec.tsx')).toBeTruthy();

      expect(tree.exists('my-dir/my-lib/src/lib/my-lib.tsx')).toBeTruthy();
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
        name: 'my-lib',
      });

      expect(() => {
        readJson(tree, `my-lib/.babelrc`);
      }).not.toThrow();
    }
  );

  it.each`
    style     | pkg
    ${'less'} | ${'less'}
    ${'scss'} | ${'sass'}
  `(
    'should add style preprocessor when vite is used',
    async ({ style, pkg }) => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        style,
        bundler: 'vite',
        unitTestRunner: 'vitest',
        name: 'my-lib',
      });

      expect(readJson(tree, 'package.json')).toMatchObject({
        devDependencies: {
          [pkg]: expect.any(String),
        },
      });
    }
  );

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        bundler: 'vite',
        unitTestRunner: 'vitest',
        directory: 'mylib',
        name: 'mylib',
      });

      expect(tree.read('mylib/vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import dts from 'vite-plugin-dts';
        import * as path from 'path';

        export default defineConfig({
          root: __dirname,
          cacheDir: '../node_modules/.vite/mylib',
          plugins: [react(), dts({ entryRoot: 'src', tsconfigPath: path.join(__dirname, 'tsconfig.lib.json') })],
          // Uncomment this if you are using workers.
          // worker: {
          //  plugins: [ nxViteTsPaths() ],
          // },
          // Configuration for building your library.
          // See: https://vitejs.dev/guide/build.html#library-mode
          build: {
            outDir: './dist',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'mylib',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es']
            },
            rollupOptions: {
              // External packages that should not be bundled into your library.
              external: ['react','react-dom','react/jsx-runtime']
            },
          },
          test: {
            watch: false,
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            reporters: ['default'],
            coverage: {
              reportsDirectory: './test-output/vitest/coverage',
              provider: 'v8',
            }
          },
        });
        "
      `);

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./mylib",
          },
        ]
      `);
      expect(readJson(tree, 'mylib/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'mylib/tsconfig.lib.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "out-tsc/mylib",
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/mylib/tsconfig.lib.tsbuildinfo",
            "types": [
              "node",
              "@nx/react/typings/cssmodule.d.ts",
              "@nx/react/typings/image.d.ts",
              "vite/client",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "**/*.spec.ts",
            "**/*.test.ts",
            "**/*.spec.tsx",
            "**/*.test.tsx",
            "**/*.spec.js",
            "**/*.test.js",
            "**/*.spec.jsx",
            "**/*.test.jsx",
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.js",
            "src/**/*.jsx",
            "src/**/*.ts",
            "src/**/*.tsx",
          ],
        }
      `);
      expect(readJson(tree, 'mylib/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "./out-tsc/vitest",
            "types": [
              "vitest/globals",
              "vitest/importMeta",
              "vite/client",
              "node",
              "vitest",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
          ],
        }
      `);
    });

    it('should map non-buildable libraries to source', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        bundler: 'none',
        unitTestRunner: 'none',
        directory: 'mylib',
        name: 'mylib',
      });

      await libraryGenerator(tree, {
        ...defaultSchema,
        bundler: 'none',
        unitTestRunner: 'none',
        directory: 'myjslib',
        name: 'myjslib',
        js: true,
      });

      expect(readJson(tree, 'mylib/package.json')).toMatchInlineSnapshot(`
        {
          "main": "./src/index.ts",
          "name": "@proj/mylib",
          "nx": {
            "name": "mylib",
            "projectType": "library",
            "sourceRoot": "mylib/src",
          },
          "types": "./src/index.ts",
          "version": "0.0.1",
        }
      `);
      expect(readJson(tree, 'myjslib/package.json')).toMatchInlineSnapshot(`
        {
          "main": "./src/index.js",
          "name": "@proj/myjslib",
          "nx": {
            "name": "myjslib",
            "projectType": "library",
            "sourceRoot": "myjslib/src",
          },
          "types": "./src/index.js",
          "version": "0.0.1",
        }
      `);
    });

    it('should configure rollup correctly', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        bundler: 'rollup',
        unitTestRunner: 'none',
        directory: 'mylib',
        name: 'mylib',
      });

      expect(tree.read('mylib/rollup.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');
        const url = require('@rollup/plugin-url');
        const svg = require('@svgr/rollup');

        module.exports = withNx(
          {
            main: './src/index.ts',
            outputPath: './dist',
            tsConfig: './tsconfig.lib.json',
            compiler: 'babel',
            external: ["react","react-dom","react/jsx-runtime"],
            format: ['esm'],
            assets:[{ input: '.', output: '.', glob: 'README.md'}],
          }, {
            // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
            plugins: [
              svg({
                svgo: false,
                titleProp: true,
                ref: true,
              }),
              url({
                limit: 10000, // 10kB
              }),
            ],
          }
        );
        "
      `);
    });

    it('should configure files for publishable library', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        bundler: 'rollup',
        directory: 'mylib',
        name: 'mylib',
        publishable: true,
        importPath: '@acme/mylib',
      });

      expect(readJson(tree, 'mylib/package.json')).toMatchInlineSnapshot(`
        {
          "exports": {
            ".": {
              "import": "./dist/index.esm.js",
              "types": "./dist/index.esm.d.ts",
            },
            "./package.json": "./package.json",
          },
          "files": [
            "dist",
            "!**/*.tsbuildinfo",
          ],
          "main": "./dist/index.esm.js",
          "module": "./dist/index.esm.js",
          "name": "@acme/mylib",
          "nx": {
            "name": "mylib",
            "projectType": "library",
            "sourceRoot": "mylib/src",
          },
          "type": "module",
          "types": "./dist/index.esm.d.ts",
          "version": "0.0.1",
        }
      `);
    });

    it('should add project to workspaces when using TS solution', async () => {
      tree.write('pnpm-workspace.yaml', `packages:`);

      await libraryGenerator(tree, {
        ...defaultSchema,
        bundler: 'rollup',
        unitTestRunner: 'none',
        directory: 'mylib',
        name: 'mylib',
      });
      const pnpmContent = tree.read('pnpm-workspace.yaml', 'utf-8');
      const pnpmWorkspaceFile = load(pnpmContent);

      expect(pnpmWorkspaceFile.packages).toEqual(['mylib']);
    });
  });
});
