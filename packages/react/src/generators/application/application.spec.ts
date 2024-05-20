import 'nx/src/internal-testing-utils/mock-project-graph';

import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getProjects,
  readJson,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
describe('app', () => {
  let appTree: Tree;
  let schema: Schema = {
    compiler: 'babel',
    e2eTestRunner: 'cypress',
    skipFormat: true,
    name: 'my-app',
    linter: Linter.EsLint,
    style: 'css',
    strict: true,
    projectNameAndRootFormat: 'as-provided',
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
            'jest.config.ts',
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
            'src/**/*.spec.tsx',
            'src/**/*.test.tsx',
            'src/**/*.spec.js',
            'src/**/*.test.js',
            'src/**/*.spec.jsx',
            'src/**/*.test.jsx',
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
    }
  );

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'scss' });
      expect(appTree.exists('my-app/src/app/app.module.scss')).toEqual(true);
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
  });

  it('should setup jest with tsx support', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('my-app/jest.config.ts').toString()).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with babel-jest support', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('my-app/jest.config.ts').toString()).toContain(
      "['babel-jest', { presets: ['@nx/react/babel'] }]"
    );
  });

  it('should setup jest without serializers', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('my-app/jest.config.ts').toString()).not.toContain(
      `'jest-preset-angular/build/AngularSnapshotSerializer.js',`
    );
  });

  it('should setup webpack', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'webpack',
    });

    expect(appTree.read('my-app/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should setup vite if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'vite',
    });

    expect(appTree.read('my-app/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should setup the nx vite dev server builder if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'vite',
    });

    expect(appTree.exists('my-app/vite.config.ts')).toBeTruthy();
  });

  it('should setup the eslint builder', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

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

  describe('--pascalCaseFiles', () => {
    it('should use upper case app file', async () => {
      await applicationGenerator(appTree, { ...schema, pascalCaseFiles: true });

      expect(appTree.exists('my-app/src/app/App.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/App.spec.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/App.module.css')).toBeTruthy();
    });

    it(`should use the correct case for file import in the spec file`, async () => {
      await applicationGenerator(appTree, { ...schema, pascalCaseFiles: true });

      const appSpecContent = appTree
        .read('my-app/src/app/App.spec.tsx')
        .toString();

      expect(appSpecContent).toMatch(/import App from '.\/App'/);
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
        name: 'plain',
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

  describe('--root-project', () => {
    it('should create files at the root', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        name: 'my-app2',
        rootProject: true,
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
        rootProject: true,
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
        name: 'insourceTests',
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
          name: style,
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
      name: 'myapp',
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
});
