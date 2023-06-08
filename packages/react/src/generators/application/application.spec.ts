import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getProjects,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
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
    skipFormat: false,
    name: 'myApp',
    linter: Linter.EsLint,
    style: 'css',
    strict: true,
  };
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('not nested', () => {
    it('should create project configurations', async () => {
      await applicationGenerator(appTree, schema);

      const projects = getProjects(appTree);

      expect(projects.get('my-app').root).toEqual('apps/my-app');
      expect(projects.get('my-app-e2e').root).toEqual('apps/my-app-e2e');
    });

    it('should add vite types to tsconfigs', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        bundler: 'vite',
        unitTestRunner: 'vitest',
      });
      const tsconfigApp = readJson(appTree, 'apps/my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.types).toEqual([
        'node',
        'vite/client',
      ]);
      const tsconfigSpec = readJson(appTree, 'apps/my-app/tsconfig.spec.json');
      expect(tsconfigSpec.compilerOptions.types).toEqual([
        'vitest/globals',
        'vitest/importMeta',
        'vite/client',
        'node',
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
      await applicationGenerator(appTree, schema);

      expect(appTree.exists('apps/my-app/.babelrc')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/main.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();
      expect(
        appTree.read('apps/my-app/src/app/app.tsx', 'utf-8')
      ).toMatchSnapshot();
      expect(appTree.exists('apps/my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.module.css')).toBeTruthy();

      const jestConfig = appTree.read('apps/my-app/jest.config.ts').toString();
      expect(jestConfig).toContain('@nx/react/plugins/jest');

      const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(tsconfig.compilerOptions.strict).toEqual(true);
      const tsconfigApp = readJson(appTree, 'apps/my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
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

      const eslintJson = readJson(appTree, 'apps/my-app/.eslintrc.json');
      expect(eslintJson.extends).toEqual([
        'plugin:@nx/react',
        '../../.eslintrc.json',
      ]);

      expect(appTree.exists('apps/my-app-e2e/cypress.config.ts')).toBeTruthy();
      const tsconfigE2E = readJson(appTree, 'apps/my-app-e2e/tsconfig.json');
      expect(tsconfigE2E).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "outDir": "../../dist/out-tsc",
            "sourceMap": false,
            "types": [
              "cypress",
              "node",
            ],
          },
          "extends": "../../tsconfig.base.json",
          "include": [
            "src/**/*.ts",
            "src/**/*.js",
            "cypress.config.ts",
          ],
        }
      `);
    });

    it('should extend from root tsconfig.base.json', async () => {
      await applicationGenerator(appTree, schema);

      const tsConfig = readJson(appTree, 'apps/my-app/tsconfig.json');
      expect(tsConfig.extends).toEqual('../../tsconfig.base.json');
    });
  });

  describe('nested', () => {
    it('should create project configurations', async () => {
      await applicationGenerator(appTree, { ...schema, directory: 'myDir' });

      const projectsConfigurations = getProjects(appTree);

      expect(projectsConfigurations.get('my-dir-my-app').root).toEqual(
        'apps/my-dir/my-app'
      );
      expect(projectsConfigurations.get('my-dir-my-app-e2e').root).toEqual(
        'apps/my-dir/my-app-e2e'
      );
    });

    it('should update tags and implicit deps', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'myDir',
        tags: 'one,two',
      });

      const projects = Object.fromEntries(getProjects(appTree));
      expect(projects).toMatchObject({
        'my-dir-my-app': {
          tags: ['one', 'two'],
        },
        'my-dir-my-app-e2e': {
          tags: [],
          implicitDependencies: ['my-dir-my-app'],
        },
      });
    });

    it("should generate correct directory for window's style paths", async () => {
      await applicationGenerator(appTree, {
        ...schema,
        directory: 'myOuterDir\\myInnerDir',
      });

      const projectsConfigurations = getProjects(appTree);

      expect(
        projectsConfigurations.get('my-outer-dir-my-inner-dir-my-app').root
      ).toEqual('apps/my-outer-dir/my-inner-dir/my-app');
      expect(
        projectsConfigurations.get('my-outer-dir-my-inner-dir-my-app-e2e').root
      ).toEqual('apps/my-outer-dir/my-inner-dir/my-app-e2e');
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJson(appTree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      await applicationGenerator(appTree, { ...schema, directory: 'myDir' });

      // Make sure these exist
      [
        'apps/my-dir/my-app/src/main.tsx',
        'apps/my-dir/my-app/src/app/app.tsx',
        'apps/my-dir/my-app/src/app/app.spec.tsx',
        'apps/my-dir/my-app/src/app/app.module.css',
      ].forEach((path) => {
        expect(appTree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
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
          path: 'apps/my-dir/my-app-e2e/tsconfig.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['plugin:@nx/react', '../../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });
  });

  it('should create Nx specific template', async () => {
    await applicationGenerator(appTree, { ...schema, directory: 'myDir' });

    expect(
      appTree.read('apps/my-dir/my-app/src/app/app.tsx', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read('apps/my-dir/my-app/src/app/nx-welcome.tsx').toString()
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
        readJson(appTree, `apps/my-app/.babelrc`);
      }).not.toThrow();
    }
  );

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'scss' });
      expect(appTree.exists('apps/my-app/src/app/app.module.scss')).toEqual(
        true
      );
    });
  });

  it('should setup jest with tsx support', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('apps/my-app/jest.config.ts').toString()).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest with babel-jest support', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('apps/my-app/jest.config.ts').toString()).toContain(
      "['babel-jest', { presets: ['@nx/react/babel'] }]"
    );
  });

  it('should setup jest without serializers', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('apps/my-app/jest.config.ts').toString()).not.toContain(
      `'jest-preset-angular/build/AngularSnapshotSerializer.js',`
    );
  });

  it('should setup the nrwl web build builder', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'webpack',
    });

    const projectsConfigurations = getProjects(appTree);
    const targetConfig = projectsConfigurations.get('my-app').targets;
    expect(targetConfig.build.executor).toEqual('@nx/webpack:webpack');
    expect(targetConfig.build.outputs).toEqual(['{options.outputPath}']);
    expect(targetConfig.build.options).toEqual({
      compiler: 'babel',
      assets: ['apps/my-app/src/favicon.ico', 'apps/my-app/src/assets'],
      index: 'apps/my-app/src/index.html',
      main: 'apps/my-app/src/main.tsx',
      baseHref: '/',
      outputPath: 'dist/apps/my-app',
      scripts: [],
      styles: ['apps/my-app/src/styles.css'],
      tsConfig: 'apps/my-app/tsconfig.app.json',
      isolatedConfig: true,
      webpackConfig: 'apps/my-app/webpack.config.js',
    });
    expect(targetConfig.build.configurations.production).toEqual({
      optimization: true,
      extractLicenses: true,
      fileReplacements: [
        {
          replace: 'apps/my-app/src/environments/environment.ts',
          with: 'apps/my-app/src/environments/environment.prod.ts',
        },
      ],
      namedChunks: false,
      outputHashing: 'all',
      sourceMap: false,
      vendorChunk: false,
    });
  });

  it('should setup the nrwl vite builder if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'vite',
    });

    const projectsConfigurations = getProjects(appTree);
    const targetConfig = projectsConfigurations.get('my-app').targets;
    expect(targetConfig.build.executor).toEqual('@nx/vite:build');
    expect(targetConfig.build.outputs).toEqual(['{options.outputPath}']);
    expect(targetConfig.build.options).toEqual({
      outputPath: 'dist/apps/my-app',
    });
    expect(
      appTree.exists(`apps/my-app/environments/environment.ts`)
    ).toBeFalsy();
    expect(
      appTree.exists(`apps/my-app/environments/environment.prod.ts`)
    ).toBeFalsy();
  });

  it('should setup the nrwl web dev server builder', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'webpack',
    });

    const projectsConfigurations = getProjects(appTree);
    const targetConfig = projectsConfigurations.get('my-app').targets;
    expect(targetConfig.serve.executor).toEqual('@nx/webpack:dev-server');
    expect(targetConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
      hmr: true,
    });
    expect(targetConfig.serve.configurations.production).toEqual({
      buildTarget: 'my-app:build:production',
      hmr: false,
    });
  });

  it('should setup the nrwl vite dev server builder if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'vite',
    });

    const projectsConfigurations = getProjects(appTree);
    const targetConfig = projectsConfigurations.get('my-app').targets;
    expect(targetConfig.serve.executor).toEqual('@nx/vite:dev-server');
    expect(targetConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
    });
    expect(targetConfig.serve.configurations.production).toEqual({
      buildTarget: 'my-app:build:production',
      hmr: false,
    });
  });

  it('should setup the eslint builder', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    const projectsConfigurations = getProjects(appTree);
    expect(projectsConfigurations.get('my-app').targets.lint).toEqual({
      executor: '@nx/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: ['apps/my-app/**/*.{ts,tsx,js,jsx}'],
      },
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        unitTestRunner: 'none',
      });

      expect(appTree.exists('jest.config.ts')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.spec.tsx')).toBeFalsy();
      expect(appTree.exists('apps/my-app/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('apps/my-app/jest.config.ts')).toBeFalsy();
      const projectsConfigurations = getProjects(appTree);
      expect(projectsConfigurations.get('my-app').targets.test).toBeUndefined();
      expect(projectsConfigurations.get('my-app').targets.lint)
        .toMatchInlineSnapshot(`
        {
          "executor": "@nx/linter:eslint",
          "options": {
            "lintFilePatterns": [
              "apps/my-app/**/*.{ts,tsx,js,jsx}",
            ],
          },
          "outputs": [
            "{options.outputFile}",
          ],
        }
      `);
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(appTree, { ...schema, e2eTestRunner: 'none' });

      expect(appTree.exists('apps/my-app-e2e')).toBeFalsy();
      const projectsConfigurations = getProjects(appTree);
      expect(projectsConfigurations.get('my-app-e2e')).toBeUndefined();
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should use upper case app file', async () => {
      await applicationGenerator(appTree, { ...schema, pascalCaseFiles: true });

      expect(appTree.exists('apps/my-app/src/app/App.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/App.spec.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/App.module.css')).toBeTruthy();
    });

    it(`should use the correct case for file import in the spec file`, async () => {
      await applicationGenerator(appTree, { ...schema, pascalCaseFiles: true });

      const appSpecContent = appTree
        .read('apps/my-app/src/app/App.spec.tsx')
        .toString();

      expect(appSpecContent).toMatch(/import App from '.\/App'/);
    });
  });

  it('should generate functional components by default', async () => {
    await applicationGenerator(appTree, schema);

    const appContent = appTree.read('apps/my-app/src/app/app.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

  it(`should use the correct case for file import in the spec file`, async () => {
    await applicationGenerator(appTree, { ...schema });

    const appSpecContent = appTree
      .read('apps/my-app/src/app/app.spec.tsx')
      .toString();

    expect(appSpecContent).toMatch(/import App from '.\/app'/);
  });

  it('should add .eslintrc.json and dependencies', async () => {
    await applicationGenerator(appTree, { ...schema, linter: Linter.EsLint });

    const packageJson = readJson(appTree, '/package.json');

    expect(packageJson.devDependencies.eslint).toBeDefined();
    expect(packageJson.devDependencies['@nx/linter']).toBeDefined();
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

    const eslintJson = readJson(appTree, '/apps/my-app/.eslintrc.json');
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

  describe('--class-component', () => {
    it('should generate class components', async () => {
      await applicationGenerator(appTree, { ...schema, classComponent: true });

      const appContent = appTree.read('apps/my-app/src/app/app.tsx').toString();

      expect(appContent).toMatch(/extends Component/);
    });
  });

  describe('--style none', () => {
    it('should not generate any styles', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'none' });

      expect(appTree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.css')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.scss')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.styl')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.module.css')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.module.scss')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.module.styl')).toBeFalsy();

      const content = appTree.read('apps/my-app/src/app/app.tsx').toString();
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

      const projectsConfigurations = getProjects(appTree);

      expect(
        projectsConfigurations.get('my-app').targets.build.options.styles
      ).toEqual([]);
    });

    it('should not break if bundler is vite', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'none',
        bundler: 'vite',
      });

      const projectsConfigurations = getProjects(appTree);

      expect(
        projectsConfigurations.get('my-app').targets.build.options.styles
      ).toBeUndefined();
    });
  });

  describe('--style styled-components', () => {
    it('should use styled-components as the styled API library', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-components',
      });

      expect(
        appTree.exists('apps/my-app/src/app/app.styled-components')
      ).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();
      expect(
        appTree.exists('apps/my-app/src/styles.styled-components')
      ).toBeFalsy();

      const content = appTree.read('apps/my-app/src/app/app.tsx').toString();
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

      expect(
        appTree.exists('apps/my-app/src/app/app.@emotion/styled')
      ).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();

      const content = appTree.read('apps/my-app/src/app/app.tsx').toString();
      expect(content).toContain('@emotion/styled');
      expect(content).toContain('<StyledApp>');
    });

    it('should add jsxImportSource to tsconfig.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
      });

      const tsconfigJson = readJson(appTree, 'apps/my-app/tsconfig.json');
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

      const projectsConfigurations = getProjects(appTree);

      expect(
        projectsConfigurations.get('my-app').targets.build.options.styles
      ).toEqual([]);
    });

    it('should not break if bundler is vite', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
        bundler: 'vite',
      });

      const projectsConfigurations = getProjects(appTree);

      expect(
        projectsConfigurations.get('my-app').targets.build.options.styles
      ).toBeUndefined();
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

      expect(appTree.exists('apps/my-app/src/app/app.styled-jsx')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();

      const content = appTree.read('apps/my-app/src/app/app.tsx').toString();
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

      const babelrc = readJson(appTree, 'apps/my-app/.babelrc');
      expect(babelrc.plugins).toContain('styled-jsx/babel');
    });
  });

  describe('--routing', () => {
    it('should add routes to the App component', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        routing: true,
      });

      const mainSource = appTree.read('apps/my-app/src/main.tsx').toString();

      const componentSource = appTree
        .read('apps/my-app/src/app/app.tsx')
        .toString();

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

    const projectsConfigurations = getProjects(appTree);

    expect(
      projectsConfigurations.get('my-app').targets.build.options.webpackConfig
    ).toEqual('apps/my-app/webpack.config.js');
  });

  it('should NOT add custom webpack config if bundler is vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      bundler: 'vite',
    });

    const projectsConfigurations = getProjects(appTree);

    expect(
      projectsConfigurations.get('my-app').targets.build.options.webpackConfig
    ).toBeUndefined();
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
      expect(appTree.exists('apps/plain/src/app/nx-welcome.tsx')).toBeFalsy();
      expect(
        appTree.read('apps/plain/src/app/app.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('--js', () => {
    it('generates JS files', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        js: true,
      });

      expect(appTree.exists('/apps/my-app/src/app/app.js')).toBe(true);
      expect(appTree.exists('/apps/my-app/src/main.js')).toBe(true);
    });
  });

  describe('--no-strict', () => {
    it('should not add options for strict mode', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        strict: false,
      });
      const tsconfigJson = readJson(appTree, '/apps/my-app/tsconfig.json');

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

      expect(
        readProjectConfiguration(appTree, 'my-app2').targets.build.options[
          'outputPath'
        ]
      ).toEqual('dist/my-app2');
    });
  });

  describe('setup React app with --bundler=vite', () => {
    let viteAppTree: Tree;

    beforeEach(async () => {
      viteAppTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await applicationGenerator(viteAppTree, { ...schema, bundler: 'vite' });
    });

    it('should setup targets with vite configuration', () => {
      const projectsConfigurations = getProjects(viteAppTree);
      const targetConfig = projectsConfigurations.get('my-app').targets;
      expect(targetConfig.build.executor).toEqual('@nx/vite:build');
      expect(targetConfig.serve.executor).toEqual('@nx/vite:dev-server');
      expect(targetConfig.serve.options).toEqual({
        buildTarget: 'my-app:build',
      });
    });

    it('should add dependencies in package.json', () => {
      const packageJson = readJson(viteAppTree, '/package.json');

      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
        '@vitejs/plugin-react': expect.any(String),
      });
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(viteAppTree, '/apps/my-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions.types).toMatchObject([
        'vite/client',
        'vitest',
      ]);
    });

    it('should create index.html and vite.config file at the root of the app', () => {
      expect(viteAppTree.exists('/apps/my-app/index.html')).toBe(true);
      expect(viteAppTree.exists('/apps/my-app/vite.config.ts')).toBe(true);
    });

    it('should not include a spec file when the bundler or unitTestRunner is vite and insourceTests is false', async () => {
      // check to make sure that the other spec file exists
      expect(viteAppTree.exists('/apps/my-app/src/app/app.spec.tsx')).toBe(
        true
      );

      await applicationGenerator(viteAppTree, {
        ...schema,
        name: 'insourceTests',
        bundler: 'vite',
        inSourceTests: true,
      });

      expect(
        viteAppTree.exists('/apps/insourceTests/src/app/app.spec.tsx')
      ).toBe(false);
    });

    it.each`
      style     | pkg
      ${'less'} | ${'less'}
      ${'scss'} | ${'sass'}
      ${'styl'} | ${'stylus'}
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
});
