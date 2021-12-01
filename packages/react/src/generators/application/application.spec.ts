import {
  getProjects,
  readJson,
  readWorkspaceConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { applicationGenerator } from './application';
import { Schema } from './schema';
import { Linter } from '@nrwl/linter';

describe('app', () => {
  let appTree: Tree;
  let schema: Schema = {
    babelJest: false,
    e2eTestRunner: 'cypress',
    skipFormat: false,
    unitTestRunner: 'jest',
    name: 'myApp',
    linter: Linter.EsLint,
    style: 'css',
    strict: false,
    standaloneConfig: false,
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(appTree, schema);

      const workspaceJson = readWorkspaceConfiguration(appTree);
      const projects = getProjects(appTree);

      expect(projects.get('my-app').root).toEqual('apps/my-app');
      expect(projects.get('my-app-e2e').root).toEqual('apps/my-app-e2e');
      expect(workspaceJson.defaultProject).toEqual('my-app');
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
      expect(appTree.exists('apps/my-app/.browserslistrc')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/main.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.module.css')).toBeTruthy();

      const jestConfig = appTree.read('apps/my-app/jest.config.js').toString();
      expect(jestConfig).toContain('@nrwl/react/plugins/jest');

      const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(tsconfig.compilerOptions.strict).not.toBeDefined();
      expect(
        tsconfig.compilerOptions.forceConsistentCasingInFileNames
      ).not.toBeDefined();
      expect(tsconfig.compilerOptions.noImplicitReturns).not.toBeDefined();
      expect(
        tsconfig.compilerOptions.noFallthroughCasesInSwitch
      ).not.toBeDefined();

      const tsconfigApp = readJson(appTree, 'apps/my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');
      expect(tsconfigApp.exclude).toEqual([
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.spec.tsx',
        '**/*.test.tsx',
        '**/*.spec.js',
        '**/*.test.js',
        '**/*.spec.jsx',
        '**/*.test.jsx',
      ]);

      const eslintJson = readJson(appTree, 'apps/my-app/.eslintrc.json');
      expect(eslintJson.extends).toEqual([
        'plugin:@nrwl/nx/react',
        '../../.eslintrc.json',
      ]);

      expect(appTree.exists('apps/my-app-e2e/cypress.json')).toBeTruthy();
      const tsconfigE2E = readJson(appTree, 'apps/my-app-e2e/tsconfig.json');
      expect(tsconfigE2E).toMatchInlineSnapshot(`
Object {
  "compilerOptions": Object {
    "allowJs": true,
    "outDir": "../../dist/out-tsc",
    "sourceMap": false,
    "types": Array [
      "cypress",
      "node",
    ],
  },
  "extends": "../../tsconfig.base.json",
  "include": Array [
    "src/**/*.ts",
    "src/**/*.js",
  ],
}
`);
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(appTree, { ...schema, directory: 'myDir' });

      const workspaceJson = getProjects(appTree);

      expect(workspaceJson.get('my-dir-my-app').root).toEqual(
        'apps/my-dir/my-app'
      );
      expect(workspaceJson.get('my-dir-my-app-e2e').root).toEqual(
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
            '**/*.spec.ts',
            '**/*.test.ts',
            '**/*.spec.tsx',
            '**/*.test.tsx',
            '**/*.spec.js',
            '**/*.test.js',
            '**/*.spec.jsx',
            '**/*.test.jsx',
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
          expectedValue: ['plugin:@nrwl/nx/react', '../../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });
  });

  it('should create Nx specific template', async () => {
    await applicationGenerator(appTree, { ...schema, directory: 'myDir' });

    expect(
      appTree.read('apps/my-dir/my-app/src/app/app.tsx').toString()
    ).toContain(`<NxWelcome title="my-dir-my-app"/>`);
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

    expect(appTree.read('apps/my-app/jest.config.js').toString()).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],`
    );
  });

  it('should setup jest without serializers', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    expect(appTree.read('apps/my-app/jest.config.js').toString()).not.toContain(
      `'jest-preset-angular/build/AngularSnapshotSerializer.js',`
    );
  });

  it('should setup the nrwl web build builder', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    const workspaceJson = getProjects(appTree);
    const targetConfig = workspaceJson.get('my-app').targets;
    expect(targetConfig.build.executor).toEqual('@nrwl/web:webpack');
    expect(targetConfig.build.outputs).toEqual(['{options.outputPath}']);
    expect(targetConfig.build.options).toEqual({
      compiler: 'babel',
      assets: ['apps/my-app/src/favicon.ico', 'apps/my-app/src/assets'],
      index: 'apps/my-app/src/index.html',
      main: 'apps/my-app/src/main.tsx',
      baseHref: '/',
      outputPath: 'dist/apps/my-app',
      polyfills: 'apps/my-app/src/polyfills.ts',
      scripts: [],
      styles: ['apps/my-app/src/styles.css'],
      tsConfig: 'apps/my-app/tsconfig.app.json',
      webpackConfig: '@nrwl/react/plugins/webpack',
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

  it('should setup the nrwl web dev server builder', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    const workspaceJson = getProjects(appTree);
    const targetConfig = workspaceJson.get('my-app').targets;
    expect(targetConfig.serve.executor).toEqual('@nrwl/web:dev-server');
    expect(targetConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
      hmr: true,
    });
    expect(targetConfig.serve.configurations.production).toEqual({
      buildTarget: 'my-app:build:production',
      hmr: false,
    });
  });

  it('should setup the eslint builder', async () => {
    await applicationGenerator(appTree, { ...schema, name: 'my-app' });

    const workspaceJson = getProjects(appTree);
    expect(workspaceJson.get('my-app').targets.lint).toEqual({
      executor: '@nrwl/linter:eslint',
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

      expect(appTree.exists('jest.config.js')).toBeFalsy();
      expect(appTree.exists('apps/my-app/src/app/app.spec.tsx')).toBeFalsy();
      expect(appTree.exists('apps/my-app/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('apps/my-app/jest.config.js')).toBeFalsy();
      const workspaceJson = getProjects(appTree);
      expect(workspaceJson.get('my-app').targets.test).toBeUndefined();
      expect(workspaceJson.get('my-app').targets.lint).toMatchInlineSnapshot(`
Object {
  "executor": "@nrwl/linter:eslint",
  "options": Object {
    "lintFilePatterns": Array [
      "apps/my-app/**/*.{ts,tsx,js,jsx}",
    ],
  },
  "outputs": Array [
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
      const workspaceJson = getProjects(appTree);
      expect(workspaceJson.get('my-app-e2e')).toBeUndefined();
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should use upper case app file', async () => {
      await applicationGenerator(appTree, { ...schema, pascalCaseFiles: true });

      expect(appTree.exists('apps/my-app/src/app/App.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/App.spec.tsx')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/App.module.css')).toBeTruthy();
    });
  });

  it('should generate functional components by default', async () => {
    await applicationGenerator(appTree, schema);

    const appContent = appTree.read('apps/my-app/src/app/app.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

  it('should add .eslintrc.json and dependencies', async () => {
    await applicationGenerator(appTree, { ...schema, linter: Linter.EsLint });

    const packageJson = readJson(appTree, '/package.json');

    expect(packageJson.devDependencies.eslint).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/linter']).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/eslint-plugin-nx']).toBeDefined();
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

      const workspaceJson = readWorkspaceConfiguration(appTree);
      expect(workspaceJson.generators['@nrwl/react']).toMatchObject({
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

    it('should exclude styles from workspace.json', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'none' });

      const workspaceJson = getProjects(appTree);

      expect(workspaceJson.get('my-app').targets.build.options.styles).toEqual(
        []
      );
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

    it('should exclude styles from workspace.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: '@emotion/styled',
      });

      const workspaceJson = getProjects(appTree);

      expect(workspaceJson.get('my-app').targets.build.options.styles).toEqual(
        []
      );
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

  it('should adds custom webpack config', async () => {
    await applicationGenerator(appTree, {
      ...schema,
    });

    const workspaceJson = getProjects(appTree);

    expect(
      workspaceJson.get('my-app').targets.build.options.webpackConfig
    ).toEqual('@nrwl/react/plugins/webpack');
  });

  it('should add required polyfills for core-js and regenerator', async () => {
    await applicationGenerator(appTree, {
      ...schema,
    });

    const polyfillsSource = appTree
      .read('apps/my-app/src/polyfills.ts')
      .toString();

    expect(polyfillsSource).toContain('regenerator');
    expect(polyfillsSource).toContain('core-js');
  });

  describe('--skipWorkspaceJson', () => {
    it('should update workspace with defaults when --skipWorkspaceJson=false', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'styled-components',
        skipWorkspaceJson: false,
      });

      const workspaceJson = readWorkspaceConfiguration(appTree);
      expect(workspaceJson.generators['@nrwl/react']).toMatchObject({
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

  describe('--strict', () => {
    it('should update tsconfig.json', async () => {
      await applicationGenerator(appTree, {
        ...schema,
        strict: true,
      });
      const tsconfigJson = readJson(appTree, '/apps/my-app/tsconfig.json');

      expect(tsconfigJson.compilerOptions.strict).toBeTruthy();
      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).toBeTruthy();
      expect(tsconfigJson.compilerOptions.noImplicitReturns).toBeTruthy();
      expect(
        tsconfigJson.compilerOptions.noFallthroughCasesInSwitch
      ).toBeTruthy();
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
});
