import 'nx/src/internal-testing-utils/mock-project-graph';

import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { readProjectConfiguration, Tree } from '@nx/devkit';
import { getProjects, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
jest.mock('@nx/devkit', () => {
  return {
    ...jest.requireActual('@nx/devkit'),
    ensurePackage: jest.fn((pkg) => jest.requireActual(pkg)),
  };
});
describe('app', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);

    tree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update configuration', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(readProjectConfiguration(tree, 'my-app').root).toEqual('my-app');
      expect(readProjectConfiguration(tree, 'my-app-e2e').root).toEqual(
        'my-app-e2e'
      );
    }, 60_000);

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        tags: 'one,two',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-app': {
          tags: ['one', 'two'],
        },
        'my-app-e2e': {
          tags: [],
          implicitDependencies: ['my-app'],
        },
      });
    }, 60_000);

    it('should generate files', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('my-app/src/app/app.element.ts')).toBeTruthy();
      expect(tree.exists('my-app/src/app/app.element.spec.ts')).toBeTruthy();
      expect(tree.exists('my-app/src/app/app.element.css')).toBeTruthy();

      const tsconfig = readJson(tree, 'my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../tsconfig.base.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);

      const tsconfigApp = readJson(tree, 'my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      expect(tree.exists('my-app-e2e/playwright.config.ts')).toBeTruthy();
      const tsconfigE2E = readJson(tree, 'my-app-e2e/tsconfig.json');
      expect(tsconfigE2E).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "module": "commonjs",
            "outDir": "../dist/out-tsc",
            "sourceMap": false,
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "**/*.ts",
            "**/*.js",
            "playwright.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.spec.js",
            "src/**/*.test.ts",
            "src/**/*.test.js",
            "src/**/*.d.ts",
          ],
        }
      `);

      const eslintJson = readJson(tree, '/my-app/.eslintrc.json');
      expect(eslintJson).toMatchInlineSnapshot(`
        {
          "extends": [
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

    it('should setup playwright e2e project', async () => {
      await applicationGenerator(tree, {
        name: 'cool-app',
        e2eTestRunner: 'playwright',
        unitTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('cool-app-e2e/playwright.config.ts')).toBeTruthy();
    });

    it('should generate files if bundler is vite', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        bundler: 'vite',
        projectNameAndRootFormat: 'as-provided',
      });
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('my-app/src/app/app.element.ts')).toBeTruthy();
      expect(tree.exists('my-app/src/app/app.element.spec.ts')).toBeTruthy();
      expect(tree.exists('my-app/src/app/app.element.css')).toBeTruthy();

      const tsconfig = readJson(tree, 'my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../tsconfig.base.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(tree.exists('my-app-e2e/playwright.config.ts')).toBeTruthy();
      expect(tree.exists('my-app/index.html')).toBeTruthy();
      expect(tree.exists('my-app/vite.config.ts')).toBeTruthy();
      expect(tree.exists(`my-app/environments/environment.ts`)).toBeFalsy();
      expect(
        tree.exists(`my-app/environments/environment.prod.ts`)
      ).toBeFalsy();
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update configuration', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        directory: 'my-dir/my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(readProjectConfiguration(tree, 'my-app').root).toEqual(
        'my-dir/my-app'
      );
      expect(readProjectConfiguration(tree, 'my-app-e2e').root).toEqual(
        'my-dir/my-app-e2e'
      );
    }, 60_000);

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        directory: 'my-dir/my-app',
        tags: 'one,two',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-app': {
          tags: ['one', 'two'],
        },
        'my-app-e2e': {
          tags: [],
          implicitDependencies: ['my-app'],
        },
      });
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJson(tree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      await applicationGenerator(tree, {
        name: 'my-app',
        directory: 'my-dir/my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      // Make sure these exist
      [
        'my-dir/my-app/src/main.ts',
        'my-dir/my-app/src/app/app.element.ts',
        'my-dir/my-app/src/app/app.element.spec.ts',
        'my-dir/my-app/src/app/app.element.css',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-app-e2e/tsconfig.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });

    it('should extend from root tsconfig.base.json', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        directory: 'my-dir/my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'my-dir/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../tsconfig.base.json');
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'my-app',
        directory: 'my-dir/my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'my-dir/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../tsconfig.json');
    });

    it('should create Nx specific template', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        directory: 'my-dir/my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(
        tree.read('my-dir/my-app/src/app/app.element.ts', 'utf-8')
      ).toBeTruthy();
      expect(
        tree.read('my-dir/my-app/src/app/app.element.ts', 'utf-8')
      ).toContain('Hello there');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        style: 'scss',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-app/src/app/app.element.scss')).toEqual(true);
    });
  });

  it('should setup jest without serializers', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      addPlugin: true,
    });

    expect(tree.read('my-app/jest.config.ts', 'utf-8')).not.toContain(
      `'jest-preset-angular/build/AngularSnapshotSerializer.js',`
    );
  });

  it('should setup the web build builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      addPlugin: true,
    });
    expect(tree.read('my-app/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should setup the web dev server', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      addPlugin: true,
    });

    expect(tree.read('my-app/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should setup eslint', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      addPlugin: true,
    });
    expect(tree.read('my-app/.eslintrc.json', 'utf-8')).toMatchSnapshot();
  });

  describe('--prefix', () => {
    it('should use the prefix in the index.html', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        prefix: 'prefix',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      expect(tree.read('my-app/src/index.html', 'utf-8')).toContain(
        '<prefix-root></prefix-root>'
      );
    });
  });

  describe('--unit-test-runner', () => {
    it('--unit-test-runner=none', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        unitTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('jest.config.ts')).toBeFalsy();
      expect(tree.exists('my-app/src/app/app.element.spec.ts')).toBeFalsy();
      expect(tree.exists('my-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('my-app/jest.config.ts')).toBeFalsy();
    });

    it('--bundler=none should use jest as the default', async () => {
      await applicationGenerator(tree, {
        name: 'my-cool-app',
        bundler: 'none',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-cool-app/jest.config.ts')).toBeTruthy();
      expect(
        readJson(tree, 'my-cool-app/tsconfig.spec.json').compilerOptions.types
      ).toMatchInlineSnapshot(`
        [
          "jest",
          "node",
        ]
      `);
    });

    // Updated this test to match the way we do this for React
    // When user chooses Vite as bundler and they choose to generate unit tests
    // then use vitest
    it('--bundler=vite --unitTestRunner=jest respects unitTestRunner given', async () => {
      await applicationGenerator(tree, {
        name: 'my-vite-app',

        bundler: 'vite',
        unitTestRunner: 'jest',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-vite-app/vite.config.ts')).toBeTruthy();
      expect(tree.exists('my-vite-app/jest.config.ts')).toBeTruthy();
    });

    it('--bundler=vite --unitTestRunner=none', async () => {
      await applicationGenerator(tree, {
        name: 'my-vite-app',
        bundler: 'vite',
        unitTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-vite-app/vite.config.ts')).toBeTruthy();
      expect(tree.read('my-vite-app/vite.config.ts', 'utf-8')).not.toContain(
        'test: {'
      );
      expect(tree.exists('my-vite-app/tsconfig.spec.json')).toBeFalsy();
    });

    it('--bundler=webpack --unitTestRunner=vitest', async () => {
      await applicationGenerator(tree, {
        name: 'my-webpack-app',
        bundler: 'webpack',
        unitTestRunner: 'vitest',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-webpack-app/vite.config.ts')).toBeTruthy();
      expect(tree.exists('my-webpack-app/jest.config.ts')).toBeFalsy();
      expect(
        readJson(tree, 'my-webpack-app/tsconfig.spec.json').compilerOptions
          .types
      ).toMatchInlineSnapshot(`
        [
          "vitest/globals",
          "vitest/importMeta",
          "vite/client",
          "node",
          "vitest",
        ]
      `);
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        e2eTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists('my-app-e2e')).toBeFalsy();
    });
  });

  describe('--compiler', () => {
    it('should support babel compiler', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        compiler: 'babel',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      } as Schema);

      expect(tree.read(`my-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-app',
          preset: '../jest.preset.js',
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: {
            '^.+\\\\.[tj]s$': 'babel-jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/my-app',
        };
        "
      `);

      expect(tree.exists('my-app/.babelrc')).toBeTruthy();
      expect(tree.exists('my-app/.swcrc')).toBeFalsy();
    });

    it('should support swc compiler', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        compiler: 'swc',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      } as Schema);

      expect(tree.read(`my-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-app',
          preset: '../jest.preset.js',
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: {
            '^.+\\\\.[tj]s$': '@swc/jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/my-app',
        };
        "
      `);

      expect(tree.exists('my-app/.babelrc')).toBeFalsy();
      expect(tree.exists('my-app/.swcrc')).toBeTruthy();
    });

    it('should be strict by default', async () => {
      await applicationGenerator(tree, {
        name: 'my-app',
        compiler: 'swc',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      } as Schema);

      const tsconfig = readJson(tree, 'my-app/tsconfig.json');
      expect(tsconfig.compilerOptions.strict).toBeTruthy();
    });
  });

  describe('setup web app with --bundler=vite', () => {
    let viteAppTree: Tree;
    beforeAll(async () => {
      viteAppTree = createTreeWithEmptyWorkspace();
      await applicationGenerator(viteAppTree, {
        name: 'my-app',
        bundler: 'vite',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
    });

    it('should setup vite configuration', () => {
      expect(tree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });
    it('should add dependencies in package.json', () => {
      const packageJson = readJson(viteAppTree, '/package.json');

      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
      });
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(viteAppTree, '/my-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions.noImplicitReturns).toBeTruthy();
    });

    it('should create index.html and vite.config file at the root of the app', () => {
      expect(viteAppTree.exists('/my-app/index.html')).toBe(true);
      expect(viteAppTree.exists('/my-app/vite.config.ts')).toBe(true);
    });

    it('should not include a spec file when the bundler or unitTestRunner is vite and insourceTests is false', async () => {
      expect(viteAppTree.exists('/my-app/src/app/app.element.spec.ts')).toBe(
        true
      );

      await applicationGenerator(viteAppTree, {
        name: 'insourceTests',
        bundler: 'vite',
        inSourceTests: true,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      expect(
        viteAppTree.exists('/insource-tests/src/app/app.element.spec.ts')
      ).toBe(false);
    });
  });
});
