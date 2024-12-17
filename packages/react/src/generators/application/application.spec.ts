import 'nx/src/internal-testing-utils/mock-project-graph';

import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getPackageManagerCommand,
  getProjects,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');

const packageCmd = getPackageManagerCommand().exec;

describe('app', () => {
  let appTree: Tree;
  let schema: Schema = {
    compiler: 'babel',
    e2eTestRunner: 'cypress',
    skipFormat: true,
    directory: 'my-app',
    linter: Linter.EsLint,
    style: 'css',
    strict: true,
    addPlugin: true,
  };
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    appTree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should create project configurations', async () => {
      await applicationGenerator(appTree, schema);

      const projects = getProjects(appTree);

      expect(projects.get('my-app').root).toEqual('my-app');
      expect(projects.get('my-app-e2e').root).toEqual('my-app-e2e');
    }, 60_000);

    it('should add vite types to tsconfigs', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        skipFormat: false,
        bundler: 'vite',
        unitTestRunner: 'vitest',
      });
      const tsconfigApp = readJson(appTree, 'my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.types).toEqual([
        'node',
        '@nx/react/typings/cssmodule.d.ts',
        '@nx/react/typings/image.d.ts',
        'vite/client',
      ]);
      const tsconfigSpec = readJson(appTree, 'my-app/tsconfig.spec.json');
      expect(tsconfigSpec.compilerOptions.types).toEqual([
        'vitest/globals',
        'vitest/importMeta',
        'vite/client',
        'node',
        'vitest',
        '@nx/react/typings/cssmodule.d.ts',
        '@nx/react/typings/image.d.ts',
      ]);
      expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should setup cypress correctly for vite', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        bundler: 'vite',
        unitTestRunner: 'vitest',
        addPlugin: true,
      });

      expect(
        appTree.read('my-app-e2e/cypress.config.ts', 'utf-8')
      ).toMatchInlineSnapshot(
        `
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, {
              "cypressDir": "src",
              "bundler": "vite",
              "webServerCommands": {
                "default": "${packageCmd} nx run my-app:serve",
                "production": "${packageCmd} nx run my-app:preview"
              },
              "ciWebServerCommand": "${packageCmd} nx run my-app:preview",
              "ciBaseUrl": "http://localhost:4300"
            }),
            baseUrl: 'http://localhost:4200'
          }
        });
        "
      `
      );
    });

    it('should setup playwright correctly for vite', async () => {
      const nxJson = readNxJson(appTree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/vite/plugin',
        options: {
          buildTargetName: 'build',
          previewTargetName: 'preview',
        },
      });
      updateNxJson(appTree, nxJson);

      await applicationGenerator(appTree, {
        ...schema,
        bundler: 'vite',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'playwright',
        addPlugin: true,
      });
      const snapshot = `
        "import { defineConfig, devices } from '@playwright/test';
        import { nxE2EPreset } from '@nx/playwright/preset';

        import { workspaceRoot } from '@nx/devkit';

        // For CI, you may want to set BASE_URL to the deployed application.
        const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

        /**
         * Read environment variables from file.
         * https://github.com/motdotla/dotenv
         */
        // require('dotenv').config();

        /**
         * See https://playwright.dev/docs/test-configuration.
         */
        export default defineConfig({
          ...nxE2EPreset(__filename, { testDir: './src' }),
          /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
          use: {
            baseURL,
            /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
            trace: 'on-first-retry',
          },
          /* Run your local dev server before starting the tests */
          webServer: {
            command: '${packageCmd} nx run my-app:preview',
            url: 'http://localhost:4300',
            reuseExistingServer: !process.env.CI,
            cwd: workspaceRoot
          },
          projects: [
            {
              name: "chromium",
              use: { ...devices["Desktop Chrome"] },
            },

            {
              name: "firefox",
              use: { ...devices["Desktop Firefox"] },
            },

            {
              name: "webkit",
              use: { ...devices["Desktop Safari"] },
            },
            
            // Uncomment for mobile browsers support
            /* {
              name: 'Mobile Chrome',
              use: { ...devices['Pixel 5'] },
            },
            {
              name: 'Mobile Safari',
              use: { ...devices['iPhone 12'] },
            }, */

            // Uncomment for branded browsers
            /* {
              name: 'Microsoft Edge',
              use: { ...devices['Desktop Edge'], channel: 'msedge' },
            },
            {
              name: 'Google Chrome',
              use: { ...devices['Desktop Chrome'], channel: 'chrome' },
            } */
          ],
        });
        "
      `;
      expect(
        appTree.read('my-app-e2e/playwright.config.ts', 'utf-8')
      ).toMatchInlineSnapshot(snapshot);
    });

    it('should use preview vite types to tsconfigs', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        skipFormat: false,
        bundler: 'vite',
        unitTestRunner: 'vitest',
      });
      const tsconfigApp = readJson(appTree, 'my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.types).toEqual([
        'node',
        '@nx/react/typings/cssmodule.d.ts',
        '@nx/react/typings/image.d.ts',
        'vite/client',
      ]);
      const tsconfigSpec = readJson(appTree, 'my-app/tsconfig.spec.json');
      expect(tsconfigSpec.compilerOptions.types).toEqual([
        'vitest/globals',
        'vitest/importMeta',
        'vite/client',
        'node',
        'vitest',
        '@nx/react/typings/cssmodule.d.ts',
        '@nx/react/typings/image.d.ts',
      ]);
      expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should not overwrite default project if already set', async () => {
      const nxJson = readNxJson(appTree);
      nxJson.defaultProject = 'some-awesome-project';
      updateNxJson(appTree, nxJson);

      await applicationGenerator(appTree, schema);

      const { defaultProject } = readNxJson(appTree);
      expect(defaultProject).toBe('some-awesome-project');
    });

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(appTree, { ...schema, tags: 'one,two' });

      const projects = Object.fromEntries(getProjects(appTree));
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
      await applicationGenerator(appTree, { ...schema, skipFormat: false });

      expect(appTree.exists('my-app/.babelrc')).toBeTruthy();
      expect(appTree.exists('my-app/src/main.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.read('my-app/src/app/app.tsx', 'utf-8')).toMatchSnapshot();
      expect(appTree.exists('my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.module.css')).toBeTruthy();

      const jestConfig = appTree.read('my-app/jest.config.ts').toString();
      expect(jestConfig).toContain('@nx/react/plugins/jest');

      const tsconfig = readJson(appTree, 'my-app/tsconfig.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(tsconfig.compilerOptions.strict).toEqual(true);
      const tsconfigApp = readJson(appTree, 'my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');
      expect(tsconfigApp.exclude).toEqual([
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.tsx',
        'src/**/*.test.tsx',
        'src/**/*.spec.js',
        'src/**/*.test.js',
        'src/**/*.spec.jsx',
        'src/**/*.test.jsx',
        'jest.config.ts',
      ]);

      const eslintJson = readJson(appTree, 'my-app/.eslintrc.json');
      expect(eslintJson.extends).toEqual([
        'plugin:@nx/react',
        '../.eslintrc.json',
      ]);

      expect(appTree.exists('my-app-e2e/cypress.config.ts')).toBeTruthy();
      const tsconfigE2E = readJson(appTree, 'my-app-e2e/tsconfig.json');
      expect(tsconfigE2E).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "module": "commonjs",
            "outDir": "../dist/out-tsc",
            "sourceMap": false,
            "types": [
              "cypress",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "**/*.ts",
            "**/*.js",
            "cypress.config.ts",
            "**/*.cy.ts",
            "**/*.cy.tsx",
            "**/*.cy.js",
            "**/*.cy.jsx",
            "**/*.d.ts",
          ],
        }
      `);
    });

    it('should extend from root tsconfig.base.json', async () => {
      await applicationGenerator(appTree, schema);

      const tsConfig = readJson(appTree, 'my-app/tsconfig.json');
      expect(tsConfig.extends).toEqual('../tsconfig.base.json');
    });
  });

  describe('nested', () => {
    it('should create project configurations', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'my-dir/my-app',
      });

      const projectsConfigurations = getProjects(appTree);

      expect(projectsConfigurations.get('my-app').root).toEqual(
        'my-dir/my-app'
      );
      expect(projectsConfigurations.get('my-app-e2e').root).toEqual(
        'my-dir/my-app-e2e'
      );
    }, 35000);

    it('should update tags and implicit deps', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'my-dir/my-app',
        tags: 'one,two',
      });

      const projects = Object.fromEntries(getProjects(appTree));
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

    it("should generate correct directory for window's style paths", async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'my-outer-dir\\my-inner-dir\\my-app',
      });

      const projectsConfigurations = getProjects(appTree);

      expect(projectsConfigurations.get('my-app').root).toEqual(
        'my-outer-dir/my-inner-dir/my-app'
      );
      expect(projectsConfigurations.get('my-app-e2e').root).toEqual(
        'my-outer-dir/my-inner-dir/my-app-e2e'
      );
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJson(appTree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'my-dir/my-app',
      });

      // Make sure these exist
      [
        'my-dir/my-app/src/main.tsx',
        'my-dir/my-app/src/app/app.tsx',
        'my-dir/my-app/src/app/app.spec.tsx',
        'my-dir/my-app/src/app/app.module.css',
      ].forEach((path) => {
        expect(appTree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: [
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
            'src/**/*.spec.tsx',
            'src/**/*.test.tsx',
            'src/**/*.spec.js',
            'src/**/*.test.js',
            'src/**/*.spec.jsx',
            'src/**/*.test.jsx',
            'jest.config.ts',
          ],
        },
        {
          path: 'my-dir/my-app-e2e/tsconfig.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['plugin:@nx/react', '../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });

    it('should setup playwright', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'my-dir/my-app',
        e2eTestRunner: 'playwright',
      });

      expect(
        appTree.exists('my-dir/my-app-e2e/playwright.config.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('my-dir/my-app-e2e/src/example.spec.ts')
      ).toBeTruthy();
    });
  });

  it('should create Nx specific template', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-dir/my-app',
    });

    expect(
      appTree.read('my-dir/my-app/src/app/app.tsx', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read('my-dir/my-app/src/app/nx-welcome.tsx').toString()
    ).toContain('Hello there');
  });

  it.each`
    style
    ${'styled-components'}
    ${'styled-jsx'}
    ${'@emotion/styled'}
  `(
    'should generate valid .babelrc JSON config for CSS-in-JS solutions',
    async ({ style }) => {
      await applicationGenerator(appTree, {
        ...schema,
        style,
      });

      expect(() => {
        readJson(appTree, `my-app/.babelrc`);
      }).not.toThrow();
      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toMatchSnapshot();
    }
  );

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'scss' });
      expect(appTree.exists('my-app/src/app/app.module.scss')).toEqual(true);
      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toMatchSnapshot();
    });
  });

  describe('--style tailwind', () => {
    it('should generate tailwind setup', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'tailwind' });
      expect(appTree.exists('my-app/tailwind.config.js')).toEqual(true);
      expect(appTree.read('my-app/src/styles.css', 'utf-8'))
        .toMatchInlineSnapshot(`
        "@tailwind base;
        @tailwind components;
        @tailwind utilities;
        /* You can add global styles to this file, and also import other style files */
        "
      `);
    });

    it('should not generate any styles files', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'tailwind' });

      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.css')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.scss')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.module.css')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.module.scss')).toBeFalsy();

      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toMatchSnapshot();
    });
  });

  it('should setup jest with tsx support', async () => {
    await applicationGenerator(appTree, { ...schema, directory: 'my-app' });

    expect(appTree.read('my-app/jest.config.ts').toString()).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with babel-jest support', async () => {
    await applicationGenerator(appTree, { ...schema, directory: 'my-app' });

    expect(appTree.read('my-app/jest.config.ts').toString()).toContain(
      "['babel-jest', { presets: ['@nx/react/babel'] }]"
    );
  });

  it('should setup jest without serializers', async () => {
    await applicationGenerator(appTree, { ...schema, directory: 'my-app' });

    expect(appTree.read('my-app/jest.config.ts').toString()).not.toContain(
      `'jest-preset-angular/build/AngularSnapshotSerializer.js',`
    );
  });

  it('should setup webpack', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-app',
      bundler: 'webpack',
    });

    expect(appTree.read('my-app/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should setup vite if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-app',
      bundler: 'vite',
    });

    expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(appTree.read('my-app/index.html', 'utf-8')).toContain('main.tsx');
  });

  it('should setup vite if bundler is vite (--js)', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-app',
      bundler: 'vite',
      js: true,
    });

    expect(appTree.read('my-app/index.html', 'utf-8')).toContain('main.jsx');
    expect(appTree.exists('my-app/src/main.jsx')).toBeTruthy();
  });

  it('should setup the nx vite dev server builder if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-app',
      bundler: 'vite',
    });

    expect(appTree.exists('my-app/vite.config.ts')).toBeTruthy();
  });

  it('should setup the eslint builder', async () => {
    await applicationGenerator(appTree, { ...schema, directory: 'my-app' });

    expect(appTree.exists('my-app/.eslintrc.json')).toBeTruthy();
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        unitTestRunner: 'none',
      });

      expect(appTree.exists('jest.config.ts')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.spec.tsx')).toBeFalsy();
      expect(appTree.exists('my-app/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('my-app/jest.config.ts')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(appTree, { ...schema, e2eTestRunner: 'none' });

      expect(appTree.exists('my-app-e2e')).toBeFalsy();
      expect(appTree.exists('my-app-e2e/cypress.config.ts')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner playwright', () => {
    it('should setup playwright', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        e2eTestRunner: 'playwright',
      });

      expect(appTree.exists('my-app-e2e/playwright.config.ts')).toBeTruthy();
      expect(appTree.exists('my-app-e2e/src/example.spec.ts')).toBeTruthy();
    });
  });

  it('should generate functional components by default', async () => {
    await applicationGenerator(appTree, schema);

    const appContent = appTree.read('my-app/src/app/app.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

  it(`should use the correct case for file import in the spec file`, async () => {
    await applicationGenerator(appTree, { ...schema });

    const appSpecContent = appTree
      .read('my-app/src/app/app.spec.tsx')
      .toString();

    expect(appSpecContent).toMatch(/import App from '.\/app'/);
  });

  it('should add .eslintrc.json and dependencies', async () => {
    await applicationGenerator(appTree, { ...schema, linter: Linter.EsLint });

    const packageJson = readJson(appTree, '/package.json');

    expect(packageJson.devDependencies.eslint).toBeDefined();
    expect(packageJson.devDependencies['@nx/eslint']).toBeDefined();
    expect(packageJson.devDependencies['@nx/eslint-plugin']).toBeDefined();
    expect(packageJson.devDependencies['eslint-plugin-react']).toBeDefined();
    expect(
      packageJson.devDependencies['eslint-plugin-react-hooks']
    ).toBeDefined();
    expect(
      packageJson.devDependencies['@typescript-eslint/parser']
    ).toBeDefined();
    expect(
      packageJson.devDependencies['@typescript-eslint/eslint-plugin']
    ).toBeDefined();
    expect(packageJson.devDependencies['eslint-config-prettier']).toBeDefined();

    const eslintJson = readJson(appTree, '/my-app/.eslintrc.json');
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

  describe('--class-component', () => {
    it('should generate class components', async () => {
      await applicationGenerator(appTree, { ...schema, classComponent: true });

      const appContent = appTree.read('my-app/src/app/app.tsx').toString();

      expect(appContent).toMatch(/extends Component/);
    });
  });

  describe('--style none', () => {
    it('should not generate any styles', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'none' });

      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.css')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.scss')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.module.css')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.module.scss')).toBeFalsy();

      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).not.toContain('styled-components');
      expect(content).not.toContain('<StyledApp>');
      expect(content).not.toContain('@emotion/styled');
      expect(content).not.toContain('<StyledApp>');

      //for imports
      expect(content).not.toContain('app.css');
      expect(content).not.toContain('app.scss');
      expect(content).not.toContain('app.module.css');
      expect(content).not.toContain('app.module.scss');
    });

    it('should set defaults when style: none', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'none' });

      const nxJson = readNxJson(appTree);
      expect(nxJson.generators['@nx/react']).toMatchObject({
        application: {
          style: 'none',
        },
        component: {
          style: 'none',
        },
        library: {
          style: 'none',
        },
      });
    });

    it('should exclude styles', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'none',
        bundler: 'webpack',
      });

      expect(
        appTree.read('my-app/webpack.config.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not break if bundler is vite', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'none',
        bundler: 'vite',
      });

      expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('--style styled-components', () => {
    it('should use styled-components as the styled API library', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-components',
      });

      expect(
        appTree.exists('my-app/src/app/app.styled-components')
      ).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/styles.styled-components')).toBeFalsy();

      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toContain('styled-component');
      expect(content).toContain('<StyledApp>');
    });

    it('should add dependencies to package.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-components',
      });

      const packageJSON = readJson(appTree, 'package.json');
      expect(packageJSON.dependencies['styled-components']).toBeDefined();
    });
  });

  describe('--style @emotion/styled', () => {
    it('should use @emotion/styled as the styled API library', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
      });

      expect(appTree.exists('my-app/src/app/app.@emotion/styled')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();

      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toContain('@emotion/styled');
      expect(content).toContain('<StyledApp>');
    });

    it('should add jsxImportSource to tsconfig.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
      });

      const tsconfigJson = readJson(appTree, 'my-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions['jsxImportSource']).toEqual(
        '@emotion/react'
      );
    });

    it('should exclude styles', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
        bundler: 'webpack',
      });

      expect(
        appTree.read('my-app/webpack.config.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not break if bundler is vite', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
        bundler: 'vite',
      });

      expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should add dependencies to package.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
      });

      const packageJSON = readJson(appTree, 'package.json');
      expect(packageJSON.dependencies['@emotion/react']).toBeDefined();
      expect(packageJSON.dependencies['@emotion/styled']).toBeDefined();
    });
  });

  describe('--style styled-jsx', () => {
    it('should use styled-jsx as the styled API library', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-jsx',
      });

      expect(appTree.exists('my-app/src/app/app.styled-jsx')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();

      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toContain('<style jsx>');
    });

    it('should add dependencies to package.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-jsx',
      });

      const packageJSON = readJson(appTree, 'package.json');
      expect(packageJSON.dependencies['styled-jsx']).toBeDefined();
    });

    it('should update babel config', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-jsx',
      });

      const babelrc = readJson(appTree, 'my-app/.babelrc');
      expect(babelrc.plugins).toContain('styled-jsx/babel');
    });
  });

  describe('--routing', () => {
    it('should add routes to the App component', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        routing: true,
      });

      const mainSource = appTree.read('my-app/src/main.tsx').toString();

      const componentSource = appTree.read('my-app/src/app/app.tsx').toString();

      expect(mainSource).toContain('react-router-dom');
      expect(mainSource).toContain('<BrowserRouter>');
      expect(mainSource).toContain('</BrowserRouter>');
      expect(componentSource).toMatch(/<Route\s*path="\/"/);
      expect(componentSource).toMatch(/<Link\s*to="\/"/);
    });
  });

  it('should add custom webpack config', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      bundler: 'webpack',
    });

    expect(appTree.read('my-app/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should NOT add custom webpack config if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      bundler: 'vite',
    });

    expect(appTree.exists('my-app/webpack.config.js')).toBeFalsy();
  });

  describe('--skipNxJson', () => {
    it('should update workspace with defaults when --skipprojectsConfigurations=false', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-components',
        skipNxJson: false,
      });

      const nxJson = readNxJson(appTree);
      expect(nxJson.generators['@nx/react']).toMatchObject({
        application: {
          babel: true,
          style: 'styled-components',
        },
        component: {
          style: 'styled-components',
        },
        library: {
          style: 'styled-components',
        },
      });
    });
  });

  describe('--minimal', () => {
    it('should create default application without Nx welcome component', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'plain',
        minimal: true,
      });
      expect(appTree.exists('plain/src/app/nx-welcome.tsx')).toBeFalsy();
      expect(appTree.read('plain/src/app/app.tsx', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('--js', () => {
    it('generates JS files', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        js: true,
      });

      expect(appTree.exists('/my-app/src/app/app.js')).toBe(true);
      expect(appTree.exists('/my-app/src/main.js')).toBe(true);
    });
  });

  describe('--no-strict', () => {
    it('should not add options for strict mode', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        strict: false,
      });
      const tsconfigJson = readJson(appTree, '/my-app/tsconfig.json');

      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).not.toBeDefined();
      expect(tsconfigJson.compilerOptions.strict).toEqual(false);
    });
  });

  describe('--compiler', () => {
    it('should install swc packages if --compiler=swc', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        compiler: 'swc',
      });
      const packageJson = readJson(appTree, '/package.json');

      expect(packageJson.devDependencies).toMatchObject({
        '@swc/core': expect.any(String),
        'swc-loader': expect.any(String),
      });
    });

    it('should add .swcrc when --compiler=swc', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        compiler: 'swc',
      });

      expect(readJson(appTree, '/my-app/.swcrc')).toEqual({
        jsc: { target: 'es2016' },
      });
    });
  });

  describe('--directory="." (--root-project)', () => {
    it('should create files at the root', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        name: 'my-app2',
        directory: '.',
        bundler: 'vite',
      });
      expect(appTree.read('/src/main.tsx')).toBeDefined();
      expect(appTree.read('/e2e/cypress.config.ts')).toBeDefined();

      const rootTsConfig = readJson(appTree, '/tsconfig.json');
      expect(rootTsConfig.extends).toBeUndefined();
      expect(rootTsConfig.compilerOptions.sourceMap).toBe(true);
    });

    it('should setup playwright', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        name: 'my-app3',
        directory: '.',
        e2eTestRunner: 'playwright',
      });

      expect(appTree.exists('e2e/playwright.config.ts')).toBeTruthy();
      expect(appTree.exists('e2e/src/example.spec.ts')).toBeTruthy();
    });
  });

  describe('setup React app with --bundler=vite', () => {
    let viteAppTree: Tree;

    beforeEach(async () => {
      viteAppTree = createTreeWithEmptyWorkspace();
      await applicationGenerator(viteAppTree, { ...schema, bundler: 'vite' });
    });

    it('should setup targets with vite configuration', () => {
      expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should add dependencies in package.json', () => {
      const packageJson = readJson(viteAppTree, '/package.json');

      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
        '@vitejs/plugin-react': expect.any(String),
      });
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(viteAppTree, '/my-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions.jsx).toBe('react-jsx');
    });

    it('should create index.html and vite.config file at the root of the app', () => {
      expect(viteAppTree.exists('/my-app/index.html')).toBe(true);
      expect(viteAppTree.exists('/my-app/vite.config.ts')).toBe(true);
    });

    it('should not include a spec file when the bundler or unitTestRunner is vite and insourceTests is false', async () => {
      // check to make sure that the other spec file exists
      expect(viteAppTree.exists('/my-app/src/app/app.spec.tsx')).toBe(true);

      await applicationGenerator(viteAppTree, {
        ...schema,
        directory: 'insourceTests',
        bundler: 'vite',
        inSourceTests: true,
      });

      expect(viteAppTree.exists('/insourceTests/src/app/app.spec.tsx')).toBe(
        false
      );
    });

    it.each`
      style     | pkg
      ${'less'} | ${'less'}
      ${'scss'} | ${'sass'}
    `(
      'should add style preprocessor when vite is used',
      async ({ style, pkg }) => {
        await applicationGenerator(viteAppTree, {
          ...schema,
          style,
          bundler: 'vite',
          unitTestRunner: 'vitest',
          directory: style,
        });

        expect(readJson(viteAppTree, 'package.json')).toMatchObject({
          devDependencies: {
            [pkg]: expect.any(String),
          },
        });
      }
    );
  });

  it('should add targetDefaults to nxJson when addPlugin=false', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    let nxJson = readNxJson(tree);
    delete nxJson.targetDefaults;
    updateNxJson(tree, nxJson);

    // ACT
    await applicationGenerator(tree, {
      directory: 'myapp',
      addPlugin: false,
      linter: Linter.None,
      style: 'none',
      e2eTestRunner: 'none',
    });

    // ASSERT
    nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults.build).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          "^build",
        ],
      }
    `);
  });

  it('should add e2e-ci targetDefaults to nxJson when addPlugin=true with playwright', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    let nxJson = readNxJson(tree);
    delete nxJson.targetDefaults;
    updateNxJson(tree, nxJson);

    // ACT
    await applicationGenerator(tree, {
      directory: 'myapp',
      addPlugin: true,
      linter: Linter.None,
      style: 'none',
      e2eTestRunner: 'playwright',
    });

    // ASSERT
    nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
      }
    `);
  });

  it('should add e2e-ci targetDefaults to nxJson when addPlugin=true with cypress', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    let nxJson = readNxJson(tree);
    delete nxJson.targetDefaults;
    updateNxJson(tree, nxJson);

    // ACT
    await applicationGenerator(tree, {
      directory: 'myapp',
      addPlugin: true,
      linter: Linter.None,
      style: 'none',
      e2eTestRunner: 'cypress',
    });

    // ASSERT
    nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
      }
    `);
  });

  it('should add e2e-ci targetDefaults to nxJson when addPlugin=true with cypress and use the defined webpack buildTargetName', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    let nxJson = readNxJson(tree);
    delete nxJson.targetDefaults;
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/webpack/plugin',
      options: {
        buildTargetName: 'build-base',
      },
    });
    updateNxJson(tree, nxJson);

    // ACT
    await applicationGenerator(tree, {
      directory: 'myapp',
      addPlugin: true,
      linter: Linter.None,
      style: 'none',
      bundler: 'webpack',
      e2eTestRunner: 'cypress',
    });

    // ASSERT
    nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build-base",
          ],
        },
      }
    `);
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      appTree = createTreeWithEmptyWorkspace();
      updateJson(appTree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(appTree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(appTree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await applicationGenerator(appTree, {
        directory: 'myapp',
        addPlugin: true,
        linter: Linter.EsLint,
        style: 'none',
        bundler: 'vite',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'playwright',
      });

      expect(readJson(appTree, 'tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "./myapp-e2e",
          },
          {
            "path": "./myapp",
          },
        ]
      `);
      expect(readJson(appTree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(appTree, 'myapp/tsconfig.app.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "lib": [
              "dom",
            ],
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "out-tsc/myapp",
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/myapp/tsconfig.app.tsbuildinfo",
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
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.tsx",
            "src/**/*.test.tsx",
            "src/**/*.spec.js",
            "src/**/*.test.js",
            "src/**/*.spec.jsx",
            "src/**/*.test.jsx",
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
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
      expect(readJson(appTree, 'myapp/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
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
              "@nx/react/typings/cssmodule.d.ts",
              "@nx/react/typings/image.d.ts",
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
              "path": "./tsconfig.app.json",
            },
          ],
        }
      `);
      expect(readJson(appTree, 'myapp-e2e/tsconfig.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "outDir": "out-tsc/playwright",
            "sourceMap": false,
          },
          "exclude": [
            "out-tsc",
            "test-output",
            "eslint.config.js",
            "eslint.config.mjs",
            "eslint.config.cjs",
          ],
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
          "references": [
            {
              "path": "../myapp",
            },
          ],
        }
      `);
    });
  });
});
